// Loads runtime configuration from a YAML file (config.yaml) once at startup and
// merges it over built-in defaults. Secrets are interpolated from the environment
// (e.g. `${AUTH_CLIENT_SECRET}`) so the file itself need not hold secrets, and a
// few well-known env vars still override scalar settings for backward compat.
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  server: { port: 8787 },
  fwknop: { bin: 'fwknop', rcFile: null }, // null rcFile → lib/rc.js falls back to ~/.fwknoprc
  auth: {
    enabled: false, // off by default → behaves exactly like the original open, localhost-only app
    issuer: '',
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:8787/auth/callback',
    postLogoutRedirectUri: 'http://localhost:8787/',
    appOrigin: 'http://localhost:8787', // used for CORS when auth is enabled
    scope: 'openid profile email',
    audience: '',
    scopeClaim: 'scope',
    session: { secret: '', ttlHours: 12 },
    require: { read: [], knock: [], write: [] },
  },
};

// Recursively interpolate `${VAR}` references in string values from process.env.
// An unset variable interpolates to an empty string.
function interpolate(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] ?? '');
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v);
    return out;
  }
  return value;
}

// Deep-merge plain objects (source wins). Arrays and scalars are replaced wholesale.
function merge(base, src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return src ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base?.[k] ?? {}, v) : v;
  }
  return out;
}

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

// Resolve the config file path: explicit CONFIG_FILE, else ./config.yaml next to the server.
function resolveConfigPath() {
  if (process.env.CONFIG_FILE) {
    return isAbsolute(process.env.CONFIG_FILE)
      ? process.env.CONFIG_FILE
      : join(process.cwd(), process.env.CONFIG_FILE);
  }
  return join(SERVER_DIR, '..', 'config.yaml');
}

export function loadConfig({ path = resolveConfigPath() } = {}) {
  let fileConfig = {};
  if (existsSync(path)) {
    const parsed = parseYaml(readFileSync(path, 'utf8')); // throws on malformed YAML
    if (parsed && typeof parsed === 'object') fileConfig = interpolate(parsed);
  }

  const cfg = merge(DEFAULTS, fileConfig);

  // Legacy env overrides (env wins) so existing PORT/FWKNOP_BIN/FWKNOPRC setups keep working.
  if (process.env.PORT) cfg.server.port = Number(process.env.PORT);
  if (process.env.FWKNOP_BIN) cfg.fwknop.bin = process.env.FWKNOP_BIN;
  if (process.env.FWKNOPRC) cfg.fwknop.rcFile = process.env.FWKNOPRC;

  cfg.fwknop.rcFile = expandHome(cfg.fwknop.rcFile) || join(homedir(), '.fwknoprc');
  cfg.configPath = existsSync(path) ? path : null;
  return cfg;
}
