import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/* ---- Field ---- */
export function Field({
  label,
  flag,
  help,
  className,
  children,
}: {
  label: string;
  flag?: string;
  help?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${className || ''}`}>
      <span className="field-label">
        {label}
        {flag && <span className="field-flag">{flag}</span>}
      </span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

/* ---- Text input ---- */
export function Text({
  value,
  onChange,
  placeholder,
  secret,
  type = 'text',
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  type?: string;
}) {
  return (
    <input
      type={secret ? 'password' : type}
      className={secret ? 'input-secret' : undefined}
      value={value ?? ''}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ---- Select ---- */
export function Select({
  value,
  onChange,
  options,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---- Segmented control ---- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {active && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---- Toggle ---- */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={!!checked}>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
      <span className="toggle-label">{label}</span>
    </button>
  );
}

/* ---- Collapsible card ---- */
export function Card({
  num,
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  num: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <div className={`card-head ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="card-num">{num}</span>
        <span className="card-title">{title}</span>
        {hint && <span className="card-hint">{hint}</span>}
        <ChevronRight className="chev" size={16} />
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}
