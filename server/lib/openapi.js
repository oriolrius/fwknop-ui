// OpenAPI 3.1 document generated from zod schemas. The same schemas are reused by
// index.js to validate request bodies, so the spec, the server-side validation and
// the client contract all derive from one source of truth.
import { z } from 'zod';
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// --- Schemas (mirror web/src/types.ts) ---
const str = () => z.string();

export const KnockOptions = z
  .object({
    // Target
    namedConfig: str().optional(),
    access: str().optional(),
    destination: str().optional(),
    // Source IP
    ipMode: z.enum(['allow', 'resolve', 'source']).optional(),
    allowIp: str().optional(),
    resolveUrl: str().optional(),
    // Transport
    serverPort: str().optional(),
    serverProto: str().optional(),
    sourcePort: str().optional(),
    httpProxy: str().optional(),
    userAgent: str().optional(),
    // Crypto
    useHmac: z.boolean().optional(),
    keyB64Rijndael: str().optional(),
    keyB64Hmac: str().optional(),
    keyRijndael: str().optional(),
    digestType: str().optional(),
    encryptionMode: str().optional(),
    hmacDigestType: str().optional(),
    gpgRecipient: str().optional(),
    gpgSigner: str().optional(),
    // Access extras
    fwTimeout: str().optional(),
    natAccess: str().optional(),
    natPort: str().optional(),
    natLocal: z.boolean().optional(),
    natRandPort: z.boolean().optional(),
    serverCmd: str().optional(),
    spoofSource: str().optional(),
    spoofUser: str().optional(),
    rcFile: str().optional(),
    // Behaviour
    test: z.boolean().optional(),
    noSaveArgs: z.boolean().optional(),
    verbose: z.number().optional(),
    extraArgs: str().optional(),
  })
  .openapi('KnockOptions');

export const Stanza = z
  .object({ name: z.string(), hints: z.record(z.string(), z.string()) })
  .openapi('Stanza');

export const Meta = z
  .object({ version: z.string().nullable(), bin: z.string(), stanzas: z.array(Stanza) })
  .openapi('Meta');

export const KnockResult = z
  .object({
    ok: z.boolean(),
    exitCode: z.number(),
    spawnError: z.string().nullable(),
    command: z.string(),
    stdout: z.string(),
    stderr: z.string(),
    durationMs: z.number(),
  })
  .openapi('KnockResult');

export const Preset = z
  .object({
    id: z.string(),
    name: z.string(),
    options: KnockOptions,
    createdAt: z.number(),
    updatedAt: z.number(),
    seeded: z.boolean().optional(),
  })
  .openapi('Preset');

export const HistoryEntry = z
  .object({
    id: z.string(),
    at: z.number(),
    name: z.string().nullable(),
    options: KnockOptions,
    optionsFull: KnockOptions,
    ok: z.boolean(),
    exitCode: z.number(),
    command: z.string(),
    stdout: z.string(),
    stderr: z.string(),
    durationMs: z.number(),
  })
  .openapi('HistoryEntry');

// --- Request bodies (also used for runtime validation) ---
export const PreviewRequest = z.object({ options: KnockOptions }).openapi('PreviewRequest');
export const KnockRequest = z
  .object({ options: KnockOptions, name: z.string().nullable().optional() })
  .openapi('KnockRequest');
export const SavePresetRequest = z
  .object({ id: z.string().optional(), name: z.string().min(1), options: KnockOptions })
  .openapi('SavePresetRequest');

export const AuthMe = z
  .object({
    disabled: z.boolean().optional(),
    authenticated: z.boolean().optional(),
    user: z.object({ sub: z.string(), name: z.string().optional(), email: z.string().optional() }).optional(),
    scopes: z.array(z.string()).optional(),
  })
  .openapi('AuthMe');

// Collect every scope referenced in config, for the oauth2 flow `scopes` map.
function scopeMap(cfg) {
  const map = {};
  for (const tok of String(cfg.auth.scope || '').split(/\s+/).filter(Boolean)) map[tok] = tok;
  for (const group of Object.values(cfg.auth.require || {})) {
    for (const s of group || []) map[s] = `required for ${s.split(':')[1] || s} operations`;
  }
  return map;
}

// Build the OpenAPI 3.1 document. `endpoints` carries discovered IdP URLs (may be empty
// when auth is disabled). Security requirements are only emitted when auth is enabled.
export function buildOpenApiDoc(cfg, endpoints = {}) {
  const registry = new OpenAPIRegistry();
  const authOn = cfg.auth.enabled === true;

  let bearer, oauth2;
  if (authOn) {
    bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    oauth2 = registry.registerComponent('securitySchemes', 'oauth2', {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: endpoints.authorizationUrl || `${cfg.auth.issuer}/authorize`,
          tokenUrl: endpoints.tokenUrl || `${cfg.auth.issuer}/token`,
          scopes: scopeMap(cfg),
        },
      },
    });
  }

  // Security requirement for an endpoint group ('read' | 'knock' | 'write').
  const sec = (group) => {
    if (!authOn) return undefined;
    const scopes = cfg.auth.require?.[group] || [];
    return [{ [bearer.name]: [] }, { [oauth2.name]: scopes }];
  };

  const json = (schema) => ({ content: { 'application/json': { schema } } });
  const add = (method, path, { summary, group, request, ok, okSchema }) =>
    registry.registerPath({
      method,
      path,
      summary,
      security: sec(group),
      request,
      responses: {
        [ok || 200]: { description: 'Success', ...(okSchema ? json(okSchema) : {}) },
        ...(authOn ? { 401: { description: 'Unauthenticated' }, 403: { description: 'Insufficient scope' } } : {}),
        ...(request?.body ? { 400: { description: 'Invalid request body' } } : {}),
      },
    });

  const body = (schema) => ({ body: { content: { 'application/json': { schema } } } });

  add('get', '/api/meta', { summary: 'fwknop version + rc stanza names', group: 'read', okSchema: Meta });
  add('post', '/api/preview', {
    summary: 'Render the fwknop command without running it',
    group: 'read',
    request: body(PreviewRequest),
    okSchema: z.object({ command: z.string() }),
  });
  add('post', '/api/knock', {
    summary: 'Execute a knock (run the fwknop client)',
    group: 'knock',
    request: body(KnockRequest),
    okSchema: z.object({ result: KnockResult, historyId: z.string() }),
  });
  add('get', '/api/presets', { summary: 'List saved presets', group: 'read', okSchema: z.array(Preset) });
  add('post', '/api/presets', {
    summary: 'Create or update a preset',
    group: 'write',
    request: body(SavePresetRequest),
    okSchema: Preset,
  });
  add('delete', '/api/presets/{id}', {
    summary: 'Delete a preset',
    group: 'write',
    request: { params: z.object({ id: z.string() }) },
    okSchema: z.object({ ok: z.boolean() }),
  });
  add('get', '/api/history', { summary: 'List execution history', group: 'read', okSchema: z.array(HistoryEntry) });
  add('delete', '/api/history/{id}', {
    summary: 'Delete a history entry',
    group: 'write',
    request: { params: z.object({ id: z.string() }) },
    okSchema: z.object({ ok: z.boolean() }),
  });
  add('delete', '/api/history', { summary: 'Clear all history', group: 'write', okSchema: z.object({ ok: z.boolean() }) });

  // Unsecured informational endpoint.
  registry.registerPath({
    method: 'get',
    path: '/api/auth/me',
    summary: 'Current authentication state',
    responses: { 200: { description: 'Auth state', ...json(AuthMe) } },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'fwknop-ui API',
      version: '0.1.0',
      description: 'REST API for the fwknop Single Packet Authorization web console.',
    },
    servers: [{ url: cfg.auth.appOrigin || `http://localhost:${cfg.server.port}` }],
  });
}
