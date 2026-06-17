import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildOpenApiDoc } from '../lib/openapi.js';
import { createApp } from '../index.js';
import { makeCfg } from './helpers.js';

describe('OpenAPI document', () => {
  const cfg = makeCfg({
    auth: { enabled: true, issuer: 'https://idp.test', require: { read: ['fwknop:read'], knock: ['fwknop:knock'], write: ['fwknop:write'] } },
  });
  const doc = buildOpenApiDoc(cfg, { authorizationUrl: 'https://idp.test/authorize', tokenUrl: 'https://idp.test/token' });

  it('is OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0');
  });

  it('documents every API path', () => {
    for (const p of ['/api/meta', '/api/preview', '/api/knock', '/api/presets', '/api/presets/{id}', '/api/history', '/api/history/{id}', '/api/auth/me']) {
      expect(doc.paths[p], `missing ${p}`).toBeTruthy();
    }
  });

  it('defines both security schemes', () => {
    expect(Object.keys(doc.components.securitySchemes)).toEqual(expect.arrayContaining(['bearerAuth', 'oauth2']));
  });

  it('attaches per-endpoint required scopes', () => {
    expect(doc.paths['/api/knock'].post.security).toContainEqual({ oauth2: ['fwknop:knock'] });
    expect(doc.paths['/api/presets'].post.security).toContainEqual({ oauth2: ['fwknop:write'] });
    expect(doc.paths['/api/meta'].get.security).toContainEqual({ oauth2: ['fwknop:read'] });
  });

  it('omits security when auth is disabled', () => {
    const open = buildOpenApiDoc(makeCfg());
    expect(open.components?.securitySchemes).toBeUndefined();
    expect(open.paths['/api/knock'].post.security).toBeUndefined();
  });

  it('is served at GET /api/openapi.json without auth', async () => {
    const { app } = await createApp(makeCfg());
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });
});
