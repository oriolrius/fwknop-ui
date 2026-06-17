import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { makeCfg, startMockIdp, bearer } from './helpers.js';

let idp;
let app;

beforeAll(async () => {
  idp = await startMockIdp();
  ({ app } = await createApp(
    makeCfg({
      auth: {
        enabled: true,
        issuer: idp.issuer.url,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        audience: '', // no aud restriction for this suite
      },
    }),
  ));
});
afterAll(async () => idp?.stop());

describe('auth enabled — gate', () => {
  it('rejects unauthenticated API calls with 401', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('reports authenticated:false at /api/auth/me when signed out', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body).toEqual({ authenticated: false });
  });

  it('still serves the OpenAPI doc publicly', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
  });
});

describe('auth enabled — Bearer tokens', () => {
  it('accepts a valid Bearer token', async () => {
    const token = await bearer(idp, { scope: 'openid' });
    const res = await request(app).get('/api/meta').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects an expired token', async () => {
    const token = await bearer(idp, { scope: 'openid', expiresIn: -10 });
    const res = await request(app).get('/api/meta').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('rejects a tampered (bad-signature) token', async () => {
    const token = await bearer(idp, { scope: 'openid' });
    const tampered = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA');
    const res = await request(app).get('/api/meta').set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });
});

describe('auth enabled — browser login round-trip', () => {
  it('logs in via the auth-code flow and exposes the user, then logs out', async () => {
    const agent = request.agent(app);

    const login = await agent.get('/auth/login');
    expect(login.status).toBe(302);
    const authorizeUrl = login.headers.location;
    expect(authorizeUrl).toContain('/authorize');
    expect(authorizeUrl).toContain('code_challenge');

    // The IdP immediately redirects back to our callback with a code.
    const idpRes = await fetch(authorizeUrl, { redirect: 'manual' });
    const cbLocation = idpRes.headers.get('location');
    const cbPath = cbLocation.replace('http://localhost:8787', '');

    const cb = await agent.get(cbPath);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/');

    const me = await agent.get('/api/auth/me');
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.sub).toBeTruthy();

    // Authenticated session can now reach the API.
    const meta = await agent.get('/api/meta');
    expect(meta.status).toBe(200);

    const logout = await agent.post('/auth/logout');
    expect(logout.body.ok).toBe(true);
    expect(logout.body.logoutUrl).toContain('endsession');

    const after = await agent.get('/api/auth/me');
    expect(after.body.authenticated).toBeFalsy();
  });

  it('rejects a callback with no pending login session', async () => {
    const res = await request(app).get('/auth/callback?code=x&state=y');
    expect(res.status).toBe(400);
  });
});
