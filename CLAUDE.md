# fwknop-ui — agent instructions

Web console for the **fwknop** Single Packet Authorization (SPA) client. It does **not**
reimplement SPA — the backend executes the real `fwknop` binary. Keep that property.

## Layout

- `web/` — React + Vite + TypeScript SPA (framer-motion, lucide-react). Bespoke CSS in `web/src/styles.css` (CSS variables, dark + light themes). No Tailwind. `web/src/api.ts` is the single API client (sends `credentials:'include'`, redirects to `/auth/login` on 401, throws `InsufficientScopeError` on 403).
- `server/` — Node/Express, `index.js` exports `createApp(cfg)` (so tests mount it with supertest) and self-boots when run directly. `lib/fwknop.js` (option→argv mapper + runner), `lib/store.js` (presets/history JSON in `server/data/`, gitignored; dir overridable via `FWKNOP_DATA_DIR`), `lib/rc.js` (lists `~/.fwknoprc` stanza names), `lib/config.js` (YAML config loader), `lib/auth.js` (OIDC + Bearer + per-endpoint scopes), `lib/openapi.js` (zod schemas → OpenAPI 3.1, also reused for request validation).

## Config, auth & API

- Runtime config is `config.yaml` (gitignored; see `config.example.yaml`), loaded by `lib/config.js`. Secrets via `${ENV}` interpolation; `PORT`/`FWKNOP_BIN`/`FWKNOPRC`/`CONFIG_FILE` env vars still override.
- Auth (`lib/auth.js`) is **off by default**. When `auth.enabled` is false the whole layer is a no-op pass-through and the app behaves exactly like the original open console. When true: browser uses OIDC Authorization Code + PKCE (cookie session), API also accepts `Authorization: Bearer` (verified against the IdP JWKS), and `requireScopes('read'|'knock'|'write')` gates each route.
- The OpenAPI 3.1 doc is generated from the zod schemas in `lib/openapi.js` — those same schemas validate request bodies in `index.js`. Add a new endpoint/field in **one** place (the schema), not two. Served at `/api/openapi.json`; Swagger UI at `/api/docs`.
- These features add mainstream deps (`openid-client`, `jose`, `express-session`, `zod`, `@asteasolutions/zod-to-openapi`, `swagger-ui-express`, `yaml`) — an intentional exception to "keep it dependency-light".

## Commands

```bash
npm run setup     # install server + web deps
npm run build     # build the frontend (web/dist)
npm start         # prod: server serves built UI → http://localhost:8787
npm run dev       # dev: Vite :5173 proxies /api AND /auth to server :8787
npm test          # server (vitest+supertest+mock OIDC) + web (vitest+jsdom)
```

Requires the `fwknop` client on PATH (override `FWKNOP_BIN`); config via `config.yaml` (see `config.example.yaml`). The Vite dev proxy **must** forward both `/api` and `/auth` (the OIDC round-trip uses `/auth/*`).

## Hard invariants (do not break)

1. **No shell.** Build an **argv array** and call `fwknop` via `execFile` — never string-interpolate into a shell. (`server/lib/fwknop.js`)
2. **Redact secrets.** Keys must render as `••••••` in the command preview and history. Any new secret option must be added to `SECRET_FIELDS` in `server/lib/fwknop.js`. Real values live only in `server/data/` (gitignored).
3. **Wrap, don't reinvent.** No JS reimplementation of the FKO/SPA crypto.
4. **Keys-in-rc by default.** The UI reads stanza *names* + non-secret hints only; passing `-n <stanza>` keeps keys in `~/.fwknoprc`, out of the app.
5. **Never commit `config.yaml` or secrets.** It's gitignored; real secrets come from `${ENV}` interpolation, not the file. Only `config.example.yaml` is committed.
6. **One schema source.** Request shapes live as zod schemas in `server/lib/openapi.js` — they drive both the OpenAPI doc and server-side validation. Don't duplicate them.

## Adding a fwknop client flag (touch all that apply)

1. `web/src/types.ts` — add to `KnockOptions`.
2. `server/lib/openapi.js` — add it to the `KnockOptions` zod schema (drives the OAS + validation).
3. `web/src/components/KnockForm.tsx` — add the field.
4. `server/lib/fwknop.js` — map it in `buildArgv()` (and add to `SECRET_FIELDS` if it's a key).
5. `web/src/components/SpecModal.tsx` — reflect it if it changes the on-wire packet/server behavior.

## Versioning & release

Commitizen (`.cz.toml`, `version_provider = npm` on root `package.json`, `major_version_zero`).

```bash
cz bump                 # bumps version from conventional commits, writes CHANGELOG.md, tags v$version
```

Don't hand-edit versions. After bump: `git push && git push --tags`, then `gh release create` with hand-written notes.

## Don'ts

- Don't commit `server/data/`, `config.yaml`, `node_modules/`, or `web/dist/` (see `.gitignore`).
- Don't put real infrastructure (IPs, hostnames, private paths) in source or docs — use example values (`example.com`, `203.0.113.0/24`).
- No per-subfolder `CLAUDE.md` — this single root file is intentionally the only one for a project this size.
