import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { makeCfg } from './helpers.js';

let app;
beforeAll(async () => {
  ({ app } = await createApp(makeCfg())); // auth.enabled = false
});

describe('auth disabled (open mode)', () => {
  it('reports disabled at /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body).toEqual({ disabled: true });
  });

  it('allows API access with no token', async () => {
    const meta = await request(app).get('/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.version).toBe('9.9.9'); // from the fake fwknop --version
  });

  it('does not activate the OIDC login flow', async () => {
    // No redirect to an IdP — /auth/login is just served by the SPA catch-all (or 404).
    const res = await request(app).get('/auth/login');
    expect(res.status).not.toBe(302);
    // And there is no session-clearing logout endpoint.
    const logout = await request(app).post('/auth/logout');
    expect(logout.status).toBe(404);
  });

  it('uses a permissive CORS origin', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
