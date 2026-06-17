import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
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
        require: { read: ['fwknop:read'], knock: ['fwknop:knock'], write: ['fwknop:write'] },
      },
    }),
  ));
});
afterAll(async () => idp?.stop());
beforeEach(() => rmSync(process.env.FWKNOP_DATA_DIR, { recursive: true, force: true }));

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('per-endpoint scope enforcement', () => {
  it('allows read but blocks knock for a read-only token', async () => {
    const token = await bearer(idp, { scope: 'fwknop:read' });
    const meta = await request(app).get('/api/meta').set(auth(token));
    expect(meta.status).toBe(200);

    const knock = await request(app).post('/api/knock').set(auth(token)).send({ options: { access: 'tcp/22' } });
    expect(knock.status).toBe(403);
    expect(knock.body.error).toBe('insufficient_scope');
    expect(knock.body.required).toEqual(['fwknop:knock']);
  });

  it('blocks writes for a read-only token', async () => {
    const token = await bearer(idp, { scope: 'fwknop:read' });
    const res = await request(app).post('/api/presets').set(auth(token)).send({ name: 'x', options: {} });
    expect(res.status).toBe(403);
  });

  it('allows knock when the token carries the knock scope', async () => {
    const token = await bearer(idp, { scope: 'fwknop:read fwknop:knock' });
    const res = await request(app).post('/api/knock').set(auth(token)).send({ options: { access: 'tcp/22' } });
    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(true);
  });
});
