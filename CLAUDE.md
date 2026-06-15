# fwknop-ui — agent instructions

Web console for the **fwknop** Single Packet Authorization (SPA) client. It does **not**
reimplement SPA — the backend executes the real `fwknop` binary. Keep that property.

## Layout

- `web/` — React + Vite + TypeScript SPA (framer-motion, lucide-react). Bespoke CSS in `web/src/styles.css` (CSS variables, dark + light themes). No Tailwind.
- `server/` — Node/Express. `lib/fwknop.js` (option→argv mapper + runner), `lib/store.js` (presets/history JSON in `server/data/`, gitignored), `lib/rc.js` (lists `~/.fwknoprc` stanza names).

## Commands

```bash
npm run setup     # install server + web deps
npm run build     # build the frontend (web/dist)
npm start         # prod: server serves built UI → http://localhost:8787
npm run dev       # dev: Vite :5173 proxies /api to server :8787
```

Requires the `fwknop` client on PATH (override `FWKNOP_BIN`); env: `PORT`, `FWKNOPRC`.

## Hard invariants (do not break)

1. **No shell.** Build an **argv array** and call `fwknop` via `execFile` — never string-interpolate into a shell. (`server/lib/fwknop.js`)
2. **Redact secrets.** Keys must render as `••••••` in the command preview and history. Any new secret option must be added to `SECRET_FIELDS` in `server/lib/fwknop.js`. Real values live only in `server/data/` (gitignored).
3. **Wrap, don't reinvent.** No JS reimplementation of the FKO/SPA crypto.
4. **Keys-in-rc by default.** The UI reads stanza *names* + non-secret hints only; passing `-n <stanza>` keeps keys in `~/.fwknoprc`, out of the app.

## Adding a fwknop client flag (touch all that apply)

1. `web/src/types.ts` — add to `KnockOptions`.
2. `web/src/components/KnockForm.tsx` — add the field.
3. `server/lib/fwknop.js` — map it in `buildArgv()` (and add to `SECRET_FIELDS` if it's a key).
4. `web/src/components/SpecModal.tsx` — reflect it if it changes the on-wire packet/server behavior.

## Versioning & release

Commitizen (`.cz.toml`, `version_provider = npm` on root `package.json`, `major_version_zero`).

```bash
cz bump                 # bumps version from conventional commits, writes CHANGELOG.md, tags v$version
```

Don't hand-edit versions. After bump: `git push && git push --tags`, then `gh release create` with hand-written notes.

## Don'ts

- Don't commit `server/data/`, `node_modules/`, or `web/dist/` (see `.gitignore`).
- Don't put real infrastructure (IPs, hostnames, private paths) in source or docs — use example values (`example.com`, `203.0.113.0/24`).
- No per-subfolder `CLAUDE.md` — this single root file is intentionally the only one for a project this size.
