import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../index.js';
import { makeCfg } from './helpers.js';

let app;
beforeAll(async () => {
  ({ app } = await createApp(makeCfg())); // auth disabled, fake fwknop
});
beforeEach(() => rmSync(process.env.FWKNOP_DATA_DIR, { recursive: true, force: true }));

describe('POST /api/knock', () => {
  it('runs the client and records redacted history', async () => {
    const res = await request(app)
      .post('/api/knock')
      .send({ options: { access: 'tcp/22', allowIp: '203.0.113.9', keyB64Rijndael: 'TOPSECRETKEY' }, name: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(true);
    expect(res.body.historyId).toBeTruthy();

    const hist = await request(app).get('/api/history');
    expect(hist.body).toHaveLength(1);
    const entry = hist.body[0];
    // Redacted view masks the key; the full (relaunch) copy retains it locally.
    expect(entry.options.keyB64Rijndael).toBe('••••••');
    expect(entry.optionsFull.keyB64Rijndael).toBe('TOPSECRETKEY');
    expect(entry.command).not.toContain('TOPSECRETKEY');
  });

  it('surfaces a non-zero exit as data, not a 500', async () => {
    const res = await request(app)
      .post('/api/knock')
      .send({ options: { access: 'tcp/22', extraArgs: '--make-it-fail' } });
    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(false);
    expect(res.body.result.exitCode).toBe(2);
  });

  it('supports the dry-run (-T) path', async () => {
    const res = await request(app).post('/api/knock').send({ options: { access: 'tcp/22', test: true } });
    expect(res.status).toBe(200);
    expect(res.body.result.command).toContain('-T');
    expect(res.body.result.ok).toBe(true);
  });
});
