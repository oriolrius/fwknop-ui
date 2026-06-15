import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArgv, runFwknop, redactOptions, fwknopVersion } from './lib/fwknop.js';
import { listStanzas } from './lib/rc.js';
import {
  listPresets, savePreset, deletePreset,
  listHistory, addHistory, clearHistory, deleteHistory, seedIfEmpty,
} from './lib/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const app = express();
app.use(express.json({ limit: '256kb' }));

// Permissive CORS for the local dev frontend (same machine only).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: String(e?.message || e) });
});

// --- Meta: version + rc stanzas ---
app.get('/api/meta', wrap(async (_req, res) => {
  const [version, stanzas] = await Promise.all([fwknopVersion(), listStanzas()]);
  res.json({ version, bin: process.env.FWKNOP_BIN || 'fwknop', stanzas });
}));

// --- Preview the command without running it ---
app.post('/api/preview', wrap((req, res) => {
  res.json({ command: buildArgv(req.body?.options || {}).display });
}));

// --- Execute a knock ---
app.post('/api/knock', wrap(async (req, res) => {
  const options = req.body?.options || {};
  const result = await runFwknop(options);
  const record = await addHistory({
    options: redactOptions(options),
    optionsFull: options, // kept locally for relaunch; never rendered raw in the UI
    name: req.body?.name || null,
    ok: result.ok,
    exitCode: result.exitCode,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
  });
  res.json({ result, historyId: record.id });
}));

// --- Presets (favorites) ---
app.get('/api/presets', wrap(async (_req, res) => res.json(await listPresets())));
app.post('/api/presets', wrap(async (req, res) => res.json(await savePreset(req.body))));
app.delete('/api/presets/:id', wrap(async (req, res) => res.json({ ok: await deletePreset(req.params.id) })));

// --- History ---
app.get('/api/history', wrap(async (_req, res) => res.json(await listHistory())));
app.delete('/api/history/:id', wrap(async (req, res) => res.json({ ok: await deleteHistory(req.params.id) })));
app.delete('/api/history', wrap(async (_req, res) => res.json({ ok: await clearHistory() })));

// --- Serve the built frontend in production ---
const dist = join(__dirname, '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

await seedIfEmpty();
app.listen(PORT, () => {
  console.log(`fwknop-ui server on http://localhost:${PORT}`);
  if (!existsSync(dist)) console.log('(dev mode — run the Vite frontend separately)');
});
