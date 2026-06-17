// Shared test helpers: a config factory pointing at the fake fwknop + sample rc,
// and a deep merge so individual tests can override just the bits they care about.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(HERE, 'fixtures');
export const FAKE_FWKNOP = join(FIXTURES, 'fake-fwknop.mjs');
export const TEST_RC = join(FIXTURES, 'test.fwknoprc');

function merge(base, src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return src ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(src)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] ?? {}, v) : v;
  }
  return out;
}

// Start a real local OIDC provider for auth tests.
export async function startMockIdp() {
  const { OAuth2Server } = await import('oauth2-mock-server');
  const idp = new OAuth2Server();
  await idp.issuer.keys.generate('RS256');
  await idp.start(0, 'localhost');
  return idp;
}

// Mint a signed access token from the mock IdP with a chosen audience/scope/expiry.
export function bearer(idp, { aud, scope, expiresIn = 3600 } = {}) {
  return idp.issuer.buildToken({ // returns a Promise<string>; callers await it
    expiresIn,
    scopesOrTransform: (_header, payload) => {
      if (aud) payload.aud = aud;
      if (scope !== undefined) payload.scope = scope;
    },
  });
}

export function makeCfg(over = {}) {
  const base = {
    server: { port: 8787 },
    fwknop: { bin: FAKE_FWKNOP, rcFile: TEST_RC },
    auth: {
      enabled: false,
      issuer: '',
      clientId: '',
      clientSecret: '',
      redirectUri: 'http://localhost:8787/auth/callback',
      postLogoutRedirectUri: 'http://localhost:8787/',
      appOrigin: 'http://localhost:8787',
      scope: 'openid profile email',
      audience: '',
      scopeClaim: 'scope',
      session: { secret: 'test-secret', ttlHours: 1 },
      require: { read: [], knock: [], write: [] },
    },
  };
  return merge(base, over);
}
