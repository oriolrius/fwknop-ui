import { describe, it, expect } from 'vitest';
import { buildArgv, redactOptions } from '../lib/fwknop.js';

describe('buildArgv', () => {
  it('maps target + allow-IP options to flags', () => {
    const { argv } = buildArgv({ namedConfig: 'prod', access: 'tcp/22', destination: 'spa.example.com', ipMode: 'allow', allowIp: '203.0.113.5' }, 'fwknop');
    expect(argv).toEqual(['-n', 'prod', '-A', 'tcp/22', '-D', 'spa.example.com', '-a', '203.0.113.5']);
  });

  it('handles the resolve and source ipModes', () => {
    expect(buildArgv({ ipMode: 'resolve', resolveUrl: 'https://ip.example' }).argv).toEqual(['-R', '--resolve-url', 'https://ip.example']);
    expect(buildArgv({ ipMode: 'source' }).argv).toEqual(['-s']);
  });

  it('clamps verbosity to 0..3', () => {
    expect(buildArgv({ verbose: 9 }).argv.filter((a) => a === '-v')).toHaveLength(3);
    expect(buildArgv({ verbose: -5 }).argv.filter((a) => a === '-v')).toHaveLength(0);
  });

  it('tokenizes raw extraArgs respecting quotes', () => {
    const { argv } = buildArgv({ extraArgs: '--foo "a b" \'c d\' bare' });
    expect(argv).toEqual(['--foo', 'a b', 'c d', 'bare']);
  });

  it('uses the provided binary name in the display string', () => {
    expect(buildArgv({ access: 'tcp/22' }, '/usr/bin/fwknop').display).toBe('/usr/bin/fwknop -A tcp/22');
  });

  it('redacts secret keys in the display but keeps them in argv', () => {
    const { argv, display } = buildArgv({ keyB64Rijndael: 'SUPERSECRETKEY', keyB64Hmac: 'HMACSECRET' });
    expect(argv).toContain('SUPERSECRETKEY');
    expect(argv).toContain('HMACSECRET');
    expect(display).not.toContain('SUPERSECRETKEY');
    expect(display).not.toContain('HMACSECRET');
    expect(display).toContain('••••••');
  });
});

describe('redactOptions', () => {
  it('masks every secret field', () => {
    const r = redactOptions({ keyRijndael: 'a', keyB64Rijndael: 'b', keyB64Hmac: 'c', access: 'tcp/22' });
    expect(r.keyRijndael).toBe('••••••');
    expect(r.keyB64Rijndael).toBe('••••••');
    expect(r.keyB64Hmac).toBe('••••••');
    expect(r.access).toBe('tcp/22'); // non-secret untouched
  });
});
