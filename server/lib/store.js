// Tiny JSON-file store for presets (favorites) and execution history.
// Lives in server/data/ (gitignored). No external deps.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Data dir is overridable (FWKNOP_DATA_DIR) so tests can use a throwaway location.
const DATA_DIR = process.env.FWKNOP_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const PRESETS = join(DATA_DIR, 'presets.json');
const HISTORY = join(DATA_DIR, 'history.json');
const HISTORY_LIMIT = 200;

async function ensure() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

async function read(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function write(file, data) {
  await ensure();
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// --- Presets (favorites) ---
export async function listPresets() {
  return read(PRESETS, []);
}

export async function savePreset({ id, name, options }) {
  const presets = await read(PRESETS, []);
  const now = Date.now();
  if (id) {
    const idx = presets.findIndex((p) => p.id === id);
    if (idx >= 0) {
      presets[idx] = { ...presets[idx], name, options, updatedAt: now };
      await write(PRESETS, presets);
      return presets[idx];
    }
  }
  const preset = { id: randomUUID(), name, options, createdAt: now, updatedAt: now };
  presets.unshift(preset);
  await write(PRESETS, presets);
  return preset;
}

export async function deletePreset(id) {
  const presets = (await read(PRESETS, [])).filter((p) => p.id !== id);
  await write(PRESETS, presets);
  return true;
}

// --- History ---
export async function listHistory() {
  return read(HISTORY, []);
}

export async function addHistory(entry) {
  const history = await read(HISTORY, []);
  const record = { id: randomUUID(), at: Date.now(), ...entry };
  history.unshift(record);
  if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
  await write(HISTORY, history);
  return record;
}

export async function clearHistory() {
  await write(HISTORY, []);
  return true;
}

export async function deleteHistory(id) {
  const history = (await read(HISTORY, [])).filter((h) => h.id !== id);
  await write(HISTORY, history);
  return true;
}

// Seed a neutral example favorite on first run so the UI isn't empty.
export async function seedIfEmpty() {
  const presets = await read(PRESETS, []);
  if (presets.length) return;
  await write(PRESETS, [
    {
      id: randomUUID(),
      name: 'Example · SSH (tcp/22)',
      options: { access: 'tcp/22', destination: 'spa.example.com', ipMode: 'allow', useHmac: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seeded: true,
    },
  ]);
}
