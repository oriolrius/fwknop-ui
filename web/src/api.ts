import type { AuthState, HistoryEntry, KnockOptions, KnockResult, Meta, Preset } from './types';

// Thrown when the server returns 403 — the caller is authenticated but lacks the
// required scope for the operation. Surfaced to the user as a toast.
export class InsufficientScopeError extends Error {
  required: string[];
  constructor(required: string[]) {
    super(`Insufficient scope${required.length ? ` (need ${required.join(' or ')})` : ''}`);
    this.name = 'InsufficientScopeError';
    this.required = required;
  }
}

// Central fetch wrapper: always sends the session cookie, bounces to the OIDC
// login on 401, and turns 403 into an InsufficientScopeError.
async function req<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: 'include', ...init });
  if (res.status === 401) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    window.location.assign(`/auth/login?returnTo=${returnTo}`);
    throw new Error('unauthenticated');
  }
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { required?: string[] };
    throw new InsufficientScopeError(body.required || []);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const postJson = (input: string, data: unknown): Promise<Response> =>
  fetch(input, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

const reqJson = <T>(input: string, data: unknown): Promise<T> =>
  postJson(input, data).then((res) => {
    if (res.status === 401) {
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`);
      throw new Error('unauthenticated');
    }
    if (res.status === 403) {
      return res.json().then((b: { required?: string[] }) => {
        throw new InsufficientScopeError(b.required || []);
      });
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  });

export const api = {
  // Auth state probe (public, never redirects).
  me: () => fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json() as Promise<AuthState>),
  logout: (): Promise<{ ok: boolean; logoutUrl?: string }> =>
    postJson('/auth/logout', {})
      .then((r) => r.json() as Promise<{ ok: boolean; logoutUrl?: string }>)
      .catch(() => ({ ok: false })),

  meta: () => req<Meta>('/api/meta'),

  preview: (options: KnockOptions) => reqJson<{ command: string }>('/api/preview', { options }),

  knock: (options: KnockOptions, name?: string | null) =>
    reqJson<{ result: KnockResult; historyId: string }>('/api/knock', { options, name }),

  presets: () => req<Preset[]>('/api/presets'),
  savePreset: (p: { id?: string; name: string; options: KnockOptions }) => reqJson<Preset>('/api/presets', p),
  deletePreset: (id: string) => req<{ ok: boolean }>(`/api/presets/${id}`, { method: 'DELETE' }),

  history: () => req<HistoryEntry[]>('/api/history'),
  deleteHistory: (id: string) => req<{ ok: boolean }>(`/api/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => req<{ ok: boolean }>('/api/history', { method: 'DELETE' }),
};
