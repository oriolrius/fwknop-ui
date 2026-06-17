import { describe, it, expect } from 'vitest';
import { listStanzas } from '../lib/rc.js';
import { TEST_RC } from './helpers.js';

describe('listStanzas', () => {
  it('lists stanza names from the rc file', async () => {
    const stanzas = await listStanzas(TEST_RC);
    const names = stanzas.map((s) => s.name);
    expect(names).toContain('prod-ssh');
    expect(names).toContain('web');
  });

  it('surfaces non-secret hints but never keys', async () => {
    const stanzas = await listStanzas(TEST_RC);
    const prod = stanzas.find((s) => s.name === 'prod-ssh');
    expect(prod.hints.ACCESS).toBe('tcp/22');
    expect(prod.hints.SPA_SERVER).toBe('spa.example.com');
    // No key material should ever appear in the hints.
    const serialized = JSON.stringify(stanzas);
    expect(serialized).not.toMatch(/KEY_BASE64/);
    expect(serialized).not.toMatch(/secret-key-must-not-leak/i);
  });

  it('returns [] for a missing file', async () => {
    expect(await listStanzas('/no/such/file.fwknoprc')).toEqual([]);
  });
});
