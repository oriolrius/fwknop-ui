<div align="center">

# fwknop · SPA console

**A modern, responsive web console for the [fwknop](https://github.com/mrash/fwknop) Single Packet Authorization (SPA) client.**

Knock to open a port, manage per‑host favorites and execution history, and inspect a precise wire‑level breakdown of exactly what gets sent — all from a clean tactical UI that drives the *real* `fwknop` binary.

[![release](https://img.shields.io/github/v/release/oriolrius/fwknop-ui?sort=semver)](https://github.com/oriolrius/fwknop-ui/releases)
[![commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
![stack](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)

</div>

---

## Why

[Single Packet Authorization](http://www.cipherdyne.org/fwknop/) hides a service (typically SSH) behind a default‑drop firewall and only opens it after a single, encrypted, authenticated, replay‑proof UDP packet — a hardened successor to port knocking. The reference client, `fwknop`, is a powerful CLI with a *lot* of flags.

**fwknop · SPA console** wraps that CLI in a UI so you can:

- send a knock without memorizing flags,
- keep one reusable preset per host,
- see your history and re‑fire any past knock in one click,
- and understand precisely what the packet contains and what the server will do with it.

It does **not** reimplement the SPA protocol — the backend executes the audited `fwknop` binary, so the crypto and on‑wire format are exactly the real client's.

## Features

- 🎯 **Full option coverage** — every meaningful `fwknop` client flag mapped to a form field: target, source‑IP mode (`-a` / `-R` / `-s`), crypto & keys, transport, NAT (`-N`), server‑command (`-C`), spoofing, GPG mode, verbosity, and a raw passthrough for anything else.
- ⭐ **Favorites (presets)** — save a complete configuration and relaunch it in one click. One preset per host.
- 🕓 **History** — every execution is logged; click to reload its settings, ▶ to re‑run.
- ℹ️ **SPA spec sheet** — an `(i)` button renders a compact, precise, wire‑level description derived from the current options: transport, FKO payload fields, cipher/HMAC and key source, and the exact ordered steps `fwknopd` performs server‑side.
- ⏱️ **Access‑window countdown** — after a successful knock, a ring visualizes the estimated firewall‑rule lifetime.
- 🧪 **Dry run** — the `-T` toggle builds the SPA packet without sending it.
- 🌓 **Dark / light themes** — a tactical dark deck and a blueprint‑paper light mode; follows system preference, toggle persists.
- 📱 **Fully responsive** — desktop (sidebar + form/output columns), tablet (single‑column), and phone (sidebar collapses to a hamburger drawer, larger tap targets, 16px inputs to avoid iOS zoom).
- 🔑 **Live command preview** — the exact `fwknop …` invocation updates as you type, with all secrets redacted.

## Security model

This tool can open firewall ports on your behalf — treat it accordingly.

- **It runs the real client.** The backend builds an **argv array** and calls `fwknop` via `execFile` — no shell, so values can't be injected.
- **Secrets never leave their home.** The recommended setup keeps keys in `~/.fwknoprc` stanzas; the UI only reads stanza *names* (plus non‑secret hints) and passes `-n <stanza>` so `fwknop` reads the keys itself. Keys are **never** stored by the app in that mode.
- **Redaction everywhere.** Any keys entered inline are shown as `••••••` in the command preview and history. (Their real values are kept only locally in `server/data/`, gitignored, solely to support relaunch — prefer the stanza approach to avoid storing them at all.)
- **Bind localhost.** The server listens on `localhost` by default. Do not expose its port to untrusted networks.

> fwknop SPA is symmetric: the AES (Rijndael) key and the HMAC key are **shared secrets** that must match on both client and server. Guard `~/.fwknoprc` and each server's `access.conf`.

## Architecture

```
web/      React + Vite + TypeScript SPA  (framer-motion, lucide-react)
server/   Node / Express — spawns the fwknop binary, JSON store
          lib/fwknop.js   option-object → argv mapper + runner (+ secret redaction)
          lib/store.js    presets.json / history.json   (server/data/, gitignored)
          lib/rc.js       parses ~/.fwknoprc to list named stanzas (names + non-secret hints only)
```

The frontend talks to a thin REST API (`/api/meta`, `/api/preview`, `/api/knock`, `/api/presets`, `/api/history`). In production the server also serves the built UI, so it's a single process.

## Requirements

- **Node ≥ 18**
- The **fwknop client** installed and on `PATH` (Debian/Ubuntu: `apt install fwknop-client`). Override with `FWKNOP_BIN`.
- A working SPA **server** (`fwknopd`) to knock — see the [fwknop docs](https://github.com/mrash/fwknop).

## Quick start

```bash
git clone https://github.com/oriolrius/fwknop-ui.git
cd fwknop-ui

npm run setup        # install server + web dependencies

# production (single process serves the built UI)
npm run build
npm start            # → http://localhost:8787

# development (hot reload; Vite on :5173 proxies /api to :8787)
npm run dev          # → http://localhost:5173
```

Run it on the machine where `fwknop` and `~/.fwknoprc` live.

### Configuration

| Env var     | Default       | Purpose                                  |
|-------------|---------------|------------------------------------------|
| `PORT`      | `8787`        | server / API port                        |
| `FWKNOP_BIN`| `fwknop`      | path to the fwknop client binary         |
| `FWKNOPRC`  | `~/.fwknoprc` | rc file scanned for named stanzas         |

## Managing multiple hosts

Two supported workflows:

1. **One `~/.fwknoprc` stanza per host (recommended).** Each stanza holds its own keys, server, access request and allow‑IP. The UI lists every stanza in the **Config stanza** dropdown; selecting one runs `fwknop -n <host>` and the keys stay in the rc file. Save a favorite per host that references its stanza.

   Add a host with the CLI:
   ```bash
   fwknop -A tcp/22 -a <your-ip> -D host.example.com -n host \
     --key-gen --use-hmac --save-rc-stanza
   ```
   (then publish the generated keys in that server's `access.conf`).

2. **Favorites with inline keys.** Paste a host's base64 keys in the Crypto card and save as a favorite. Convenient, but the keys are stored in `server/data/presets.json` — workflow 1 avoids that.

## Development

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and the project uses [Commitizen](https://commitizen-tools.github.io/commitizen/) for versioning and changelog:

```bash
cz commit          # guided conventional commit
cz bump            # bump version + update CHANGELOG.md from commit history
```

## License

[MIT](LICENSE) © Oriol Rius
