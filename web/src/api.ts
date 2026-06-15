import type { HistoryEntry, KnockOptions, KnockResult, Meta, Preset } from './types';

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => fetch('/api/meta').then(j<Meta>),

  preview: (options: KnockOptions) =>
    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options }),
    }).then(j<{ command: string }>),

  knock: (options: KnockOptions, name?: string | null) =>
    fetch('/api/knock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options, name }),
    }).then(j<{ result: KnockResult; historyId: string }>),

  presets: () => fetch('/api/presets').then(j<Preset[]>),
  savePreset: (p: { id?: string; name: string; options: KnockOptions }) =>
    fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }).then(j<Preset>),
  deletePreset: (id: string) =>
    fetch(`/api/presets/${id}`, { method: 'DELETE' }).then(j<{ ok: boolean }>),

  history: () => fetch('/api/history').then(j<HistoryEntry[]>),
  deleteHistory: (id: string) =>
    fetch(`/api/history/${id}`, { method: 'DELETE' }).then(j<{ ok: boolean }>),
  clearHistory: () => fetch('/api/history', { method: 'DELETE' }).then(j<{ ok: boolean }>),
};
