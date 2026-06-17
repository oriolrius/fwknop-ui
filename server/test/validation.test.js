import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { makeCfg } from './helpers.js';

let app;
beforeAll(async () => {
  ({ app } = await createApp(makeCfg())); // auth disabled
});

describe('request validation (zod-backed)', () => {
  it('rejects a malformed preview body with 400', async () => {
    const res = await request(app).post('/api/preview').send({ options: { ipMode: 'bogus' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(res.body.issues).toBeInstanceOf(Array);
  });

  it('accepts a valid preview body', async () => {
    const res = await request(app).post('/api/preview').send({ options: { access: 'tcp/22', ipMode: 'source' } });
    expect(res.status).toBe(200);
    expect(res.body.command).toContain('-A tcp/22');
    expect(res.body.command).toContain('-s');
  });

  it('rejects a knock with a non-string name', async () => {
    const res = await request(app).post('/api/knock').send({ options: {}, name: 123 });
    expect(res.status).toBe(400);
  });

  it('rejects a preset without a name', async () => {
    const res = await request(app).post('/api/presets').send({ options: { access: 'tcp/22' } });
    expect(res.status).toBe(400);
  });
});
