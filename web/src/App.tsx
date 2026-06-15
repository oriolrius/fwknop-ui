import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { api } from './api';
import type { HistoryEntry, KnockOptions, KnockResult, Meta, Preset } from './types';
import { Sidebar } from './components/Sidebar';
import { KnockForm } from './components/KnockForm';
import { Console } from './components/Console';
import { SpecModal } from './components/SpecModal';

const DEFAULT_OPTIONS: KnockOptions = {
  ipMode: 'allow',
  useHmac: true,
  serverProto: '',
  verbose: 0,
};

type Toast = { id: number; kind: 'ok' | 'fail' | 'info'; msg: string };

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [options, setOptions] = useState<KnockOptions>(DEFAULT_OPTIONS);
  const [command, setCommand] = useState('fwknop');
  const [result, setResult] = useState<KnockResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [fired, setFired] = useState(0); // bump to replay packet animation
  const [saveOpen, setSaveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false); // SPA spec modal
  const [navOpen, setNavOpen] = useState(false); // mobile sidebar drawer
  const [presetName, setPresetName] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((kind: Toast['kind'], msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const set = useCallback(<K extends keyof KnockOptions>(key: K, value: KnockOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  }, []);

  // initial load
  useEffect(() => {
    api.meta().then(setMeta).catch(() => toast('fail', 'backend unreachable'));
    api.presets().then(setPresets).catch(() => {});
    api.history().then(setHistory).catch(() => {});
  }, [toast]);

  // live command preview (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      api.preview(options).then((r) => setCommand(r.command)).catch(() => {});
    }, 120);
    return () => clearTimeout(id);
  }, [options]);

  const windowSeconds = useMemo(() => {
    const n = Number(options.fwTimeout);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }, [options.fwTimeout]);

  const runKnock = useCallback(
    async (opts: KnockOptions, name?: string | null) => {
      setBusy(true);
      setResult(null);
      setFired((f) => f + 1);
      try {
        const { result: res } = await api.knock(opts, name);
        setResult(res);
        setRunStartedAt(Date.now());
        toast(res.ok ? 'ok' : 'fail', res.ok ? (opts.test ? 'packet built' : 'knock sent') : `failed (exit ${res.exitCode})`);
        api.history().then(setHistory).catch(() => {});
      } catch {
        toast('fail', 'request failed');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const onKnock = () => runKnock(options, options.namedConfig ? `${options.namedConfig} · ${options.access || ''}`.trim() : null);

  // presets
  const openSave = () => {
    setPresetName(options.namedConfig ? `${options.namedConfig} · ${options.access || ''}`.trim() : options.destination || 'New preset');
    setSaveOpen(true);
  };
  const confirmSave = async () => {
    if (!presetName.trim()) return;
    const p = await api.savePreset({ name: presetName.trim(), options });
    setPresets((list) => [p, ...list.filter((x) => x.id !== p.id)]);
    setSaveOpen(false);
    toast('ok', 'preset saved');
  };
  const deletePreset = async (id: string) => {
    await api.deletePreset(id);
    setPresets((list) => list.filter((p) => p.id !== id));
    toast('info', 'preset removed');
  };

  // history
  const clearHistory = async () => {
    await api.clearHistory();
    setHistory([]);
    toast('info', 'history cleared');
  };

  const dest = options.destination || (meta?.stanzas.find((s) => s.name === options.namedConfig)?.hints.SPA_SERVER) || '—';

  return (
    <div className="app">
      <Sidebar
        meta={meta}
        presets={presets}
        history={history}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onLoadPreset={(p) => {
          setOptions({ ...DEFAULT_OPTIONS, ...p.options });
          setNavOpen(false);
          toast('info', `loaded “${p.name}”`);
        }}
        onRunPreset={(p) => {
          const opts = { ...DEFAULT_OPTIONS, ...p.options };
          setOptions(opts);
          setNavOpen(false);
          runKnock(opts, p.name);
        }}
        onDeletePreset={deletePreset}
        onLoadHistory={(h) => {
          setOptions({ ...DEFAULT_OPTIONS, ...h.optionsFull });
          setNavOpen(false);
          toast('info', 'settings loaded from history');
        }}
        onRerunHistory={(h) => {
          const opts = { ...DEFAULT_OPTIONS, ...h.optionsFull };
          setOptions(opts);
          setNavOpen(false);
          runKnock(opts, h.name);
        }}
        onClearHistory={clearHistory}
      />
      <AnimatePresence>
        {navOpen && (
          <motion.div
            className="nav-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNavOpen(false)}
          />
        )}
      </AnimatePresence>

      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="topbar-target">
            <div className="topbar-label">Target server</div>
            <div className="topbar-dest">
              <span className="muted">spa://</span>
              <span className="accent">{dest}</span>
              <span className="muted">:{options.serverPort || '62201'}</span>
              <span className="muted"> · {options.access || 'tcp/?'}</span>
            </div>
          </div>
          {/* packet-fire pulse */}
          <div style={{ position: 'relative', width: 14, height: 14 }}>
            <AnimatePresence>
              {fired > 0 && (
                <motion.span
                  key={fired}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '1.5px solid var(--accent)',
                  }}
                  initial={{ scale: 0.6, opacity: 0.9 }}
                  animate={{ scale: 4.5, opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>
            <span
              style={{
                position: 'absolute',
                inset: 4,
                borderRadius: '50%',
                background: busy ? 'var(--accent)' : 'var(--ink-faint)',
                boxShadow: busy ? '0 0 10px var(--accent)' : 'none',
                transition: 'background .2s',
              }}
            />
          </div>
        </div>

        <div className="content">
          <KnockForm
            options={options}
            set={set}
            meta={meta}
            busy={busy}
            onKnock={onKnock}
            onSavePreset={openSave}
            onInfo={() => setInfoOpen(true)}
            onReset={() => {
              setOptions(DEFAULT_OPTIONS);
              setResult(null);
              toast('info', 'form reset');
            }}
          />
          <div className="out-col">
            <Console command={command} result={result} busy={busy} windowSeconds={windowSeconds} runStartedAt={runStartedAt} />
          </div>
        </div>
      </main>

      {/* SPA spec modal */}
      <AnimatePresence>{infoOpen && <SpecModal options={options} meta={meta} onClose={() => setInfoOpen(false)} />}</AnimatePresence>

      {/* save preset modal */}
      <AnimatePresence>
        {saveOpen && (
          <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSaveOpen(false)}>
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, y: 8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div className="modal-head">Save favorite</div>
              <div className="modal-body">
                <label className="field">
                  <span className="field-label">Preset name</span>
                  <input
                    autoFocus
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
                    placeholder="prod · ssh"
                  />
                  <span className="field-help">Stores the full current configuration for one-click relaunch.</span>
                </label>
              </div>
              <div className="modal-foot">
                <button className="btn" onClick={() => setSaveOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={confirmSave}>
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toasts */}
      <div className="toast-wrap">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.kind === 'ok' ? 'ok' : t.kind === 'fail' ? 'fail' : ''}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
