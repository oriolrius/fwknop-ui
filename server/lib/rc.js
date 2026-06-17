// Parse ~/.fwknoprc to surface the available named stanzas (so the UI can offer them in a
// dropdown). We only expose stanza names + a few non-secret hints — never the keys.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_RC_PATH = process.env.FWKNOPRC || join(homedir(), '.fwknoprc');
const HINT_KEYS = new Set(['ALLOW_IP', 'ACCESS', 'SPA_SERVER', 'SPA_SERVER_PORT', 'SPA_SERVER_PROTO', 'USE_HMAC']);

export async function listStanzas(rcPath = DEFAULT_RC_PATH) {
  let text;
  try {
    text = await readFile(rcPath, 'utf8');
  } catch {
    return [];
  }
  const stanzas = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      current = { name: header[1], hints: {} };
      stanzas.push(current);
      continue;
    }
    if (!current) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (m && HINT_KEYS.has(m[1].toUpperCase())) current.hints[m[1].toUpperCase()] = m[2];
  }
  return stanzas.filter((s) => s.name.toLowerCase() !== 'default' || stanzas.length === 1).length
    ? stanzas
    : stanzas;
}
