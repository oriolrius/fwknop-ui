import { describe, it, expect, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import {
  listPresets, savePreset, deletePreset,
  listHistory, addHistory, clearHistory, deleteHistory, seedIfEmpty,
} from '../lib/store.js';

// store.js resolves its data dir from FWKNOP_DATA_DIR (set in vitest.config.js).
const DATA_DIR = process.env.FWKNOP_DATA_DIR;

describe('store', () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('creates, updates and deletes presets', async () => {
    const created = await savePreset({ name: 'ssh', options: { access: 'tcp/22' } });
    expect(created.id).toBeTruthy();
    expect(await listPresets()).toHaveLength(1);

    const updated = await savePreset({ id: created.id, name: 'ssh-2', options: { access: 'tcp/2222' } });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('ssh-2');
    expect(await listPresets()).toHaveLength(1);

    await deletePreset(created.id);
    expect(await listPresets()).toHaveLength(0);
  });

  it('appends history and trims to the limit', async () => {
    for (let i = 0; i < 205; i++) await addHistory({ ok: true, command: `c${i}` });
    const all = await listHistory();
    expect(all).toHaveLength(200);
    expect(all[0].command).toBe('c204'); // newest first
  });

  it('clears and deletes individual history entries', async () => {
    const a = await addHistory({ ok: true, command: 'a' });
    await addHistory({ ok: false, command: 'b' });
    await deleteHistory(a.id);
    expect((await listHistory()).map((h) => h.command)).toEqual(['b']);
    await clearHistory();
    expect(await listHistory()).toEqual([]);
  });

  it('seeds an example preset only when empty', async () => {
    await seedIfEmpty();
    const first = await listPresets();
    expect(first).toHaveLength(1);
    expect(first[0].seeded).toBe(true);
    await seedIfEmpty(); // no-op second time
    expect(await listPresets()).toHaveLength(1);
  });
});
