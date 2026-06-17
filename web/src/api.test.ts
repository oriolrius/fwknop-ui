import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, InsufficientScopeError } from './api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let assign: ReturnType<typeof vi.fn>;

describe('api client', () => {
  beforeEach(() => {
    assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the session cookie (credentials: include) on requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: '1', bin: 'fwknop', stanzas: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith('/api/meta', expect.objectContaining({ credentials: 'include' }));
  });

  it('redirects to /auth/login on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(api.presets()).rejects.toThrow();
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('/auth/login'));
  });

  it('throws InsufficientScopeError on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ required: ['fwknop:knock'] }, 403)));
    await expect(api.knock({})).rejects.toBeInstanceOf(InsufficientScopeError);
  });

  it('me() resolves without redirecting (it is the probe)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ disabled: true })));
    expect(await api.me()).toEqual({ disabled: true });
    expect(assign).not.toHaveBeenCalled();
  });
});
