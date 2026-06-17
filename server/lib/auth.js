// OIDC authentication + per-endpoint scope authorization.
//
// Two ways in, when enabled:
//   - Browser: OIDC Authorization Code + PKCE -> httpOnly cookie session.
//   - API:     Authorization: Bearer <JWT> -> verified against the IdP JWKS.
//
// When cfg.auth.enabled is false the whole layer becomes a no-op pass-through, so
// the app behaves exactly like the original open, localhost-only console.
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as client from 'openid-client';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const SESSIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sessions');

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// Extract granted scopes/claims from a claims object honoring cfg.auth.scopeClaim.
// The claim value may be a space-delimited string or an array.
function extractScopes(source, scopeClaim) {
  const v = source?.[scopeClaim];
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v).split(/\s+/).filter(Boolean);
}

const passthrough = (_req, _res, next) => next();

export async function initAuth(app, cfg) {
  // --- Disabled: install a no-op layer and return pass-through helpers. ---
  if (cfg.auth.enabled !== true) {
    app.use((req, _res, next) => {
      req.auth = { disabled: true };
      next();
    });
    return {
      enabled: false,
      endpoints: {},
      authenticate: passthrough,
      requireScopes: () => passthrough,
      meHandler: (_req, res) => res.json({ disabled: true }),
    };
  }

  // --- Enabled: discover the IdP and wire up sessions + verification. ---
  const insecure = !cfg.auth.issuer.startsWith('https');
  const config = await client.discovery(
    new URL(cfg.auth.issuer),
    cfg.auth.clientId,
    cfg.auth.clientSecret || undefined,
    undefined,
    insecure ? { execute: [client.allowInsecureRequests] } : undefined,
  );
  const md = config.serverMetadata();
  const JWKS = createRemoteJWKSet(new URL(md.jwks_uri));
  const scopeClaim = cfg.auth.scopeClaim || 'scope';
  const ttlMs = (cfg.auth.session?.ttlHours || 12) * 3600 * 1000;

  const FileStore = FileStoreFactory(session);
  app.use(
    session({
      store: new FileStore({ path: SESSIONS_DIR, ttl: ttlMs / 1000, retries: 1, logFn: () => {} }),
      secret: cfg.auth.session?.secret || 'change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: cfg.auth.redirectUri.startsWith('https'),
        maxAge: ttlMs,
      },
    }),
  );

  // --- Login: start the Authorization Code + PKCE flow. ---
  app.get('/auth/login', async (req, res, next) => {
    try {
      const code_verifier = client.randomPKCECodeVerifier();
      const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
      const state = client.randomState();
      const nonce = client.randomNonce();
      req.session.pkce = { code_verifier, state, nonce, returnTo: String(req.query.returnTo || '/') };
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: cfg.auth.redirectUri,
        scope: cfg.auth.scope,
        code_challenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      });
      res.redirect(url.href);
    } catch (e) {
      next(e);
    }
  });

  // --- Callback: exchange the code, validate, store tokens in the session. ---
  app.get('/auth/callback', async (req, res, next) => {
    try {
      const pkce = req.session.pkce;
      if (!pkce) return res.status(400).send('Login session expired — please retry.');
      const currentUrl = new URL(cfg.auth.redirectUri);
      currentUrl.search = new URL(req.url, cfg.auth.appOrigin).search;
      const tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: pkce.code_verifier,
        expectedState: pkce.state,
        expectedNonce: pkce.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      const scopes = uniq([
        ...String(tokens.scope || '').split(/\s+/),
        ...extractScopes(claims, scopeClaim),
      ]);
      const returnTo = pkce.returnTo || '/';
      delete req.session.pkce;
      req.session.tokens = {
        claims,
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
        scopes,
      };
      res.redirect(returnTo);
    } catch (e) {
      next(e);
    }
  });

  // --- Logout: destroy the session, hand the SPA the IdP end-session URL. ---
  app.post('/auth/logout', (req, res) => {
    const idToken = req.session?.tokens?.idToken;
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      let logoutUrl = cfg.auth.postLogoutRedirectUri;
      if (md.end_session_endpoint) {
        try {
          const u = new URL(md.end_session_endpoint);
          u.searchParams.set('post_logout_redirect_uri', cfg.auth.postLogoutRedirectUri);
          if (idToken) u.searchParams.set('id_token_hint', idToken);
          logoutUrl = u.href;
        } catch {
          /* keep fallback */
        }
      }
      res.json({ ok: true, logoutUrl });
    });
  });

  // --- authenticate: attach req.auth from a Bearer token or the session. ---
  async function authenticate(req, res, next) {
    const authz = req.headers.authorization || '';
    if (authz.startsWith('Bearer ')) {
      try {
        const { payload } = await jwtVerify(authz.slice(7), JWKS, {
          issuer: md.issuer,
          ...(cfg.auth.audience ? { audience: cfg.auth.audience } : {}),
        });
        req.auth = { mode: 'bearer', claims: payload, scopes: extractScopes(payload, scopeClaim) };
        return next();
      } catch (e) {
        return res.status(401).json({ error: 'invalid_token', detail: String(e?.message || e) });
      }
    }

    const tok = req.session?.tokens;
    if (tok) {
      // Refresh the access token if it is about to expire and we hold a refresh token.
      if (tok.refreshToken && tok.expiresAt && Date.now() > tok.expiresAt - 5000) {
        try {
          const r = await client.refreshTokenGrant(config, tok.refreshToken);
          tok.accessToken = r.access_token;
          if (r.refresh_token) tok.refreshToken = r.refresh_token;
          tok.expiresAt = r.expires_in ? Date.now() + r.expires_in * 1000 : tok.expiresAt;
          if (r.scope) tok.scopes = uniq([...r.scope.split(/\s+/), ...extractScopes(tok.claims, scopeClaim)]);
        } catch {
          /* keep existing tokens; downstream scope check still applies */
        }
      }
      req.auth = { mode: 'session', claims: tok.claims, scopes: tok.scopes || [] };
      return next();
    }

    // req.path is relative to the /api mount point, so use originalUrl.
    if ((req.originalUrl || '').startsWith('/api')) return res.status(401).json({ error: 'unauthenticated' });
    return res.redirect('/auth/login');
  }

  // --- requireScopes(group): 403 unless the caller has ANY required scope. ---
  function requireScopes(group) {
    return (req, res, next) => {
      if (req.auth?.disabled) return next();
      const required = cfg.auth.require?.[group] || [];
      if (required.length === 0) return next();
      const have = new Set(req.auth?.scopes || []);
      if (required.some((s) => have.has(s))) return next();
      return res.status(403).json({ error: 'insufficient_scope', required });
    };
  }

  function meHandler(req, res) {
    const tok = req.session?.tokens;
    if (!tok) return res.json({ authenticated: false });
    const c = tok.claims || {};
    res.json({
      authenticated: true,
      user: { sub: c.sub, name: c.name, email: c.email },
      scopes: tok.scopes || [],
    });
  }

  return {
    enabled: true,
    endpoints: { authorizationUrl: md.authorization_endpoint, tokenUrl: md.token_endpoint },
    authenticate,
    requireScopes,
    meHandler,
  };
}
