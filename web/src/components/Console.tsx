import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Terminal, Timer } from 'lucide-react';
import type { KnockResult } from '../types';

function CommandPreview({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const tokens = command.split(' ');
  return (
    <div className="cmd-preview">
      <button
        className="icon-btn cmd-copy"
        title="Copy command"
        onClick={() => {
          navigator.clipboard?.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {tokens.map((t, i) => (
        <span key={i} className={i === 0 ? 'tok-bin' : t.startsWith('-') ? 'tok-flag' : undefined}>
          {t}
          {i < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}

/* Access-window countdown ring — visualises the server-side rule lifetime. */
function AccessWindow({ seconds, startedAt }: { seconds: number; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - startedAt) / 1000;
  const remaining = Math.max(0, seconds - elapsed);
  const frac = Math.max(0, Math.min(1, remaining / seconds));
  const R = 19;
  const C = 2 * Math.PI * R;
  if (remaining <= 0) return null;
  return (
    <motion.div className="window" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="window-ring">
        <svg width="46" height="46" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r={R} fill="none" stroke="var(--ok-dim)" strokeWidth="3" opacity="0.4" />
          <circle
            cx="23"
            cy="23"
            r={R}
            fill="none"
            stroke="var(--ok)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
          />
        </svg>
        <span className="window-ring-num">{Math.ceil(remaining)}</span>
      </div>
      <div className="window-text">
        Access window <b>open</b> — connect now.
        <br />
        Estimated rule lifetime {seconds}s (matches server <code>FW_ACCESS_TIMEOUT</code>).
      </div>
    </motion.div>
  );
}

export function Console({
  command,
  result,
  busy,
  windowSeconds,
  runStartedAt,
}: {
  command: string;
  result: KnockResult | null;
  busy: boolean;
  windowSeconds: number;
  runStartedAt: number | null;
}) {
  const status = busy ? 'run' : result ? (result.ok ? 'ok' : 'fail') : 'idle';
  return (
    <>
      <div className="out-head">
        <Terminal size={15} color="var(--ink-dim)" />
        <span className="out-title">Operation</span>
        <span className={`status-chip ${status === 'ok' ? 'ok' : status === 'fail' ? 'fail' : ''}`}>
          <span className="status-dot" />
          {status === 'run' ? 'sending' : status === 'ok' ? 'opened' : status === 'fail' ? 'failed' : 'standby'}
        </span>
      </div>

      <CommandPreview command={command} />

      <AnimatePresence>
        {result?.ok && !result.command.includes(' -T') && runStartedAt && (
          <AccessWindow key={runStartedAt} seconds={windowSeconds} startedAt={runStartedAt} />
        )}
      </AnimatePresence>

      <div className="term">
        <div className="term-bar">
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="lbl">fwknop output</span>
          {result && (
            <span className="lbl" style={{ marginLeft: 'auto' }}>
              exit {result.exitCode} · {result.durationMs}ms
            </span>
          )}
        </div>
        <div className="term-body">
          {!result && !busy && (
            <div className="term-empty">
              <div>
                <Timer size={20} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div>
                  Configure a target and send a knock.
                  <br />
                  Output streams here. <span className="blink">▋</span>
                </div>
              </div>
            </div>
          )}
          {busy && <div className="term-line out">→ sending SPA packet…</div>}
          {result && (
            <>
              {result.stdout?.trim() &&
                result.stdout.trimEnd().split('\n').map((l, i) => (
                  <div key={`o${i}`} className="term-line out">
                    {l}
                  </div>
                ))}
              {result.stderr?.trim() &&
                result.stderr.trimEnd().split('\n').map((l, i) => (
                  <div key={`e${i}`} className="term-line err">
                    {l}
                  </div>
                ))}
              {!result.stdout?.trim() && !result.stderr?.trim() && (
                <div className="term-line out">
                  {result.ok ? '✓ SPA packet sent (no output).' : '✗ failed (no output).'}
                </div>
              )}
              <div className="term-line term-meta">
                ── {result.ok ? 'done' : 'error'} · exit {result.exitCode} ──
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
