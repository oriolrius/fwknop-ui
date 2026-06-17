import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildArgv, runFwknop, redactOptions, fwknopVersion } from './lib/fwknop.js';
import { listStanzas } from './lib/rc.js';
import {
  listPresets, savePreset, deletePreset,
  listHistory, addHistory, clearHistory, deleteHistory, seedIfEmpty,
} from './lib/store.js';
import { loadConfig } from './lib/config.js';
import { initAuth } from './lib/auth.js';
import { buildOpenApiDoc, PreviewRequest, KnockRequest, SavePresetRequest } from './lib/openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build the Express app for a given config. Exported so tests can mount it with
// supertest without binding a port. Returns { app, cfg, auth }.
export async function createApp(cfg = loadConfig()) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // CORS. With auth on we must name a concrete origin (credentials + '*' is illegal);
  // with auth off keep the original permissive localhost-dev behavior.
  app.use((req, res, next) => {
    if (cfg.auth.enabled) {
      res.set('Access-Control-Allow-Origin', cfg.auth.appOrigin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Vary', 'Origin');
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const auth = await initAuth(app, cfg);

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: 'invalid_request', issues: e.issues });
      console.error(e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  };

  // --- OpenAPI document + interactive docs (public) ---
  const openapiDoc = buildOpenApiDoc(cfg, auth.endpoints);
  app.get('/api/openapi.json', (_req, res) => res.json(openapiDoc));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));

  // --- Auth state (public, so the SPA can decide whether to show the login gate) ---
  app.get('/api/auth/me', auth.meHandler);

  // --- Everything else under /api requires authentication ---
  app.use('/api', auth.authenticate);

  // --- Meta: version + rc stanzas ---
  app.get('/api/meta', auth.requireScopes('read'), wrap(async (_req, res) => {
    const [version, stanzas] = await Promise.all([
      fwknopVersion(cfg.fwknop.bin),
      listStanzas(cfg.fwknop.rcFile),
    ]);
    res.json({ version, bin: cfg.fwknop.bin, stanzas });
  }));

  // --- Preview the command without running it ---
  app.post('/api/preview', auth.requireScopes('read'), wrap((req, res) => {
    const { options } = PreviewRequest.parse(req.body);
    res.json({ command: buildArgv(options, cfg.fwknop.bin).display });
  }));

  // --- Execute a knock ---
  app.post('/api/knock', auth.requireScopes('knock'), wrap(async (req, res) => {
    const { options, name } = KnockRequest.parse(req.body);
    const result = await runFwknop(options, cfg.fwknop.bin);
    const record = await addHistory({
      options: redactOptions(options),
      optionsFull: options, // kept locally for relaunch; never rendered raw in the UI
      name: name || null,
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
  app.get('/api/presets', auth.requireScopes('read'), wrap(async (_req, res) => res.json(await listPresets())));
  app.post('/api/presets', auth.requireScopes('write'), wrap(async (req, res) =>
    res.json(await savePreset(SavePresetRequest.parse(req.body)))));
  app.delete('/api/presets/:id', auth.requireScopes('write'), wrap(async (req, res) =>
    res.json({ ok: await deletePreset(req.params.id) })));

  // --- History ---
  app.get('/api/history', auth.requireScopes('read'), wrap(async (_req, res) => res.json(await listHistory())));
  app.delete('/api/history/:id', auth.requireScopes('write'), wrap(async (req, res) =>
    res.json({ ok: await deleteHistory(req.params.id) })));
  app.delete('/api/history', auth.requireScopes('write'), wrap(async (_req, res) =>
    res.json({ ok: await clearHistory() })));

  // --- Serve the built frontend in production ---
  const dist = join(__dirname, '..', 'web', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  return { app, cfg, auth };
}

// --- Bootstrap when run directly (not when imported by tests) ---
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig();
  const { app } = await createApp(cfg);
  await seedIfEmpty();
  app.listen(cfg.server.port, () => {
    console.log(`fwknop-ui server on http://localhost:${cfg.server.port}`);
    console.log(`  auth: ${cfg.auth.enabled ? `OIDC (${cfg.auth.issuer})` : 'disabled (open)'}`);
    console.log(`  docs: http://localhost:${cfg.server.port}/api/docs`);
    if (!existsSync(join(__dirname, '..', 'web', 'dist'))) console.log('  (dev mode — run the Vite frontend separately)');
  });
}
