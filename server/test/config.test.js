import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.js';

describe('config loader', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fwknop-cfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.AUTH_CLIENT_SECRET;
    delete process.env.PORT;
    delete process.env.FWKNOP_BIN;
  });

  const write = (yaml) => {
    const p = join(dir, 'config.yaml');
    writeFileSync(p, yaml);
    return p;
  };

  it('returns defaults when no file exists', () => {
    const cfg = loadConfig({ path: join(dir, 'missing.yaml') });
    expect(cfg.auth.enabled).toBe(false);
    expect(cfg.server.port).toBe(8787);
    expect(cfg.fwknop.bin).toBe('fwknop');
    expect(cfg.configPath).toBeNull();
  });

  it('reads values from the file', () => {
    const path = write('server:\n  port: 9100\nauth:\n  enabled: true\n  issuer: https://idp.test\n  require:\n    knock: [fwknop:knock]\n');
    const cfg = loadConfig({ path });
    expect(cfg.server.port).toBe(9100);
    expect(cfg.auth.enabled).toBe(true);
    expect(cfg.auth.issuer).toBe('https://idp.test');
    expect(cfg.auth.require.knock).toEqual(['fwknop:knock']);
    expect(cfg.configPath).toBe(path);
  });

  it('interpolates ${ENV} secrets from the environment', () => {
    process.env.AUTH_CLIENT_SECRET = 's3cr3t-value';
    const path = write('auth:\n  enabled: true\n  clientSecret: ${AUTH_CLIENT_SECRET}\n');
    const cfg = loadConfig({ path });
    expect(cfg.auth.clientSecret).toBe('s3cr3t-value');
  });

  it('interpolates an unset variable to empty string', () => {
    const path = write('auth:\n  clientSecret: ${DEFINITELY_UNSET_VAR}\n');
    const cfg = loadConfig({ path });
    expect(cfg.auth.clientSecret).toBe('');
  });

  it('lets env vars override scalar settings', () => {
    process.env.PORT = '9999';
    process.env.FWKNOP_BIN = '/opt/fwknop';
    const path = write('server:\n  port: 8000\n');
    const cfg = loadConfig({ path });
    expect(cfg.server.port).toBe(9999);
    expect(cfg.fwknop.bin).toBe('/opt/fwknop');
  });

  it('throws on malformed YAML', () => {
    const path = write('auth: [unterminated\n');
    expect(() => loadConfig({ path })).toThrow();
  });
});
