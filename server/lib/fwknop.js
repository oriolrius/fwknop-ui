// Maps a UI option object to a fwknop argv array and runs the real client binary.
// Secrets (keys) are never passed through a shell — argv is an array, execFile, no shell.
import { execFile } from 'node:child_process';

export const FWKNOP_BIN = process.env.FWKNOP_BIN || 'fwknop';

const SECRET_FIELDS = new Set(['keyRijndael', 'keyB64Rijndael', 'keyB64Hmac']);

// Tokenize a raw "extra args" string respecting single/double quotes.
function tokenize(str) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// Build the argv. Returns { argv, display } where display redacts secret values.
export function buildArgv(o = {}) {
  const argv = [];
  const display = [];
  const push = (flag, value, { secret = false } = {}) => {
    if (value === undefined || value === null || value === '') return;
    if (flag) {
      argv.push(flag);
      display.push(flag);
    }
    argv.push(String(value));
    display.push(secret ? '••••••' : String(value));
  };
  const flag = (f, on) => {
    if (on) {
      argv.push(f);
      display.push(f);
    }
  };

  // --- Target ---
  push('-n', o.namedConfig);
  push('-A', o.access);
  push('-D', o.destination);

  // --- Source IP mode ---
  switch (o.ipMode) {
    case 'allow':
      push('-a', o.allowIp);
      break;
    case 'resolve':
      flag('-R', true);
      push('--resolve-url', o.resolveUrl);
      break;
    case 'source':
      flag('-s', true);
      break;
    default:
      // if no mode but an allowIp is present, use it
      if (o.allowIp) push('-a', o.allowIp);
  }

  // --- SPA packet transport ---
  push('-p', o.serverPort);
  push('-P', o.serverProto);
  push('-S', o.sourcePort);
  push('-H', o.httpProxy);
  push('-u', o.userAgent);

  // --- Crypto ---
  flag('--use-hmac', o.useHmac);
  push('--key-base64-rijndael', o.keyB64Rijndael, { secret: true });
  push('--key-base64-hmac', o.keyB64Hmac, { secret: true });
  push('--key-rijndael', o.keyRijndael, { secret: true });
  push('-m', o.digestType);
  push('-M', o.encryptionMode);
  push('--hmac-digest-type', o.hmacDigestType);
  push('--gpg-recipient-key', o.gpgRecipient);
  push('--gpg-signer-key', o.gpgSigner);

  // --- Access extras ---
  push('-f', o.fwTimeout);
  push('-N', o.natAccess);
  push('--nat-port', o.natPort);
  flag('--nat-local', o.natLocal);
  flag('--nat-rand-port', o.natRandPort);
  push('-C', o.serverCmd);
  push('-Q', o.spoofSource);
  push('-U', o.spoofUser);
  push('--rc-file', o.rcFile);

  // --- Behaviour ---
  flag('-T', o.test); // dry run — build packet but don't send
  flag('--no-save-args', o.noSaveArgs);
  const vN = Math.max(0, Math.min(3, Number(o.verbose) || 0));
  for (let i = 0; i < vN; i++) flag('-v', true);

  // --- Raw escape hatch ---
  if (o.extraArgs && o.extraArgs.trim()) {
    for (const t of tokenize(o.extraArgs.trim())) {
      argv.push(t);
      display.push(t);
    }
  }

  return { argv, display: [FWKNOP_BIN, ...display].join(' ') };
}

// Run fwknop with the given options. Resolves with a structured result (never rejects on
// non-zero exit — a failed knock is data, not an exception).
export function runFwknop(options) {
  const { argv, display } = buildArgv(options);
  const startedAt = Date.now();
  return new Promise((resolve) => {
    execFile(
      FWKNOP_BIN,
      argv,
      { timeout: 30000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const durationMs = Date.now() - startedAt;
        const exitCode = err && typeof err.code === 'number' ? err.code : err ? 1 : 0;
        const spawnError = err && err.code === 'ENOENT' ? `fwknop binary not found (${FWKNOP_BIN})` : null;
        resolve({
          ok: exitCode === 0 && !spawnError,
          exitCode,
          spawnError,
          command: display,
          stdout: stdout || '',
          stderr: (spawnError ? spawnError + '\n' : '') + (stderr || ''),
          durationMs,
        });
      },
    );
  });
}

export function redactOptions(o = {}) {
  const clean = { ...o };
  for (const f of SECRET_FIELDS) if (clean[f]) clean[f] = '••••••';
  return clean;
}

export function fwknopVersion() {
  return new Promise((resolve) => {
    execFile(FWKNOP_BIN, ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(null);
      const m = (stdout || '').match(/client\s+([\d.]+)/i);
      resolve(m ? m[1] : (stdout || '').trim().split('\n')[0]);
    });
  });
}
