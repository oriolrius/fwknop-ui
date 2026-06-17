import { motion } from 'framer-motion';
import { History, LogOut, Moon, Play, Star, Sun, Trash2, User, X, Zap } from 'lucide-react';
import { useTheme } from '../theme';
import type { AuthState, HistoryEntry, Meta, Preset } from '../types';

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function summary(o: { destination?: string; access?: string; allowIp?: string; namedConfig?: string }): string {
  const bits = [o.access || '', o.allowIp ? `→${o.allowIp}` : '', o.namedConfig ? `@${o.namedConfig}` : ''].filter(Boolean);
  return bits.join(' ') || o.destination || '—';
}

export function Sidebar({
  auth,
  onLogout,
  meta,
  presets,
  history,
  open,
  onClose,
  onLoadPreset,
  onRunPreset,
  onDeletePreset,
  onLoadHistory,
  onRerunHistory,
  onClearHistory,
}: {
  auth: AuthState;
  onLogout: () => void;
  meta: Meta | null;
  presets: Preset[];
  history: HistoryEntry[];
  open: boolean;
  onClose: () => void;
  onLoadPreset: (p: Preset) => void;
  onRunPreset: (p: Preset) => void;
  onDeletePreset: (id: string) => void;
  onLoadHistory: (h: HistoryEntry) => void;
  onRerunHistory: (h: HistoryEntry) => void;
  onClearHistory: () => void;
}) {
  const { theme, toggle } = useTheme();
  const showUser = !auth.disabled && auth.authenticated;
  const userLabel = auth.user?.name || auth.user?.email || auth.user?.sub || 'signed in';

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <span className="brand-glyph">
            <Zap size={17} strokeWidth={2.4} />
          </span>
          <div>
            <div className="brand-name">
              fwknop<b>·</b>spa
            </div>
            <div className="brand-sub">single packet auth</div>
          </div>
          <button className="sb-close icon-btn" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="sb-scroll">
        {/* FAVORITES */}
        <div className="sb-section-head">
          <span className="sb-section-title">
            <Star size={12} /> Favorites
          </span>
          <span className="sb-count">{presets.length}</span>
        </div>
        {presets.length === 0 && <div className="sb-empty">No presets yet. Configure a knock and hit ★ to save it here.</div>}
        {presets.map((p, i) => (
          <motion.button
            key={p.id}
            className="sb-item"
            onClick={() => onLoadPreset(p)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i }}
          >
            <Star size={13} className="sb-item-star" fill="currentColor" />
            <span className="sb-item-body">
              <span className="sb-item-name">{p.name}</span>
              <span className="sb-item-meta">{summary(p.options)}</span>
            </span>
            <span className="sb-item-actions">
              <span
                className="icon-btn"
                title="Run now"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunPreset(p);
                }}
              >
                <Play size={13} />
              </span>
              <span
                className="icon-btn danger"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePreset(p.id);
                }}
              >
                <Trash2 size={13} />
              </span>
            </span>
          </motion.button>
        ))}

        {/* HISTORY */}
        <div className="sb-section-head">
          <span className="sb-section-title">
            <History size={12} /> History
          </span>
          {history.length > 0 ? (
            <button className="sb-clear" onClick={onClearHistory}>
              clear
            </button>
          ) : (
            <span className="sb-count">0</span>
          )}
        </div>
        {history.length === 0 && <div className="sb-empty">Executions land here. Click to reload settings, ▶ to re-run.</div>}
        {history.map((h) => (
          <button key={h.id} className="sb-item" onClick={() => onLoadHistory(h)}>
            <span className={`sb-item-status ${h.ok ? 'ok' : 'fail'}`} />
            <span className="sb-item-body">
              <span className="sb-item-name">{h.name || summary(h.options)}</span>
              <span className="sb-item-meta">
                {ago(h.at)} · {summary(h.options)}
              </span>
            </span>
            <span className="sb-item-actions">
              <span
                className="icon-btn"
                title="Re-run"
                onClick={(e) => {
                  e.stopPropagation();
                  onRerunHistory(h);
                }}
              >
                <Play size={13} />
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="sb-foot">
        {showUser && (
          <div className="sb-user">
            <span className="sb-user-ic">
              <User size={13} />
            </span>
            <span className="sb-user-name" title={userLabel}>
              {userLabel}
            </span>
            <button className="icon-btn" title="Sign out" onClick={onLogout}>
              <LogOut size={14} />
            </button>
          </div>
        )}
        <div className="sb-foot-meta">
          <div>
            client <b>{meta?.version || '—'}</b>
          </div>
          <div>{meta?.bin || 'fwknop'}</div>
        </div>
        <button className="theme-toggle" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'LIGHT' : 'DARK'}
        </button>
      </div>
    </aside>
  );
}
