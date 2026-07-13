import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../theme';

/* Mermaid diagrams, themed to the console's palette so they read the same in dark
   (terminal) and light (blueprint) modes. Fenced ```mermaid blocks in the docs are
   routed here by DocView; everything else stays a plain code block. */

const MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

// Concrete hex (not var()) — mermaid does color math on these, which breaks on CSS vars.
// Values mirror the --tokens in styles.css for each theme.
const PALETTES: Record<'dark' | 'light', Record<string, string>> = {
  dark: {
    background: 'transparent',
    fontFamily: MONO,
    primaryColor: '#14171f',
    primaryBorderColor: '#ffb000',
    primaryTextColor: '#e7e9ef',
    secondaryColor: '#131620',
    tertiaryColor: '#101218',
    lineColor: '#9298a7',
    textColor: '#e7e9ef',
    actorBkg: '#14171f',
    actorBorder: '#ffb000',
    actorTextColor: '#e7e9ef',
    actorLineColor: '#5b6273',
    signalColor: '#9298a7',
    signalTextColor: '#e7e9ef',
    labelBoxBkgColor: '#131620',
    labelBoxBorderColor: '#232733',
    labelTextColor: '#ffb000',
    loopTextColor: '#9298a7',
    noteBkgColor: '#131620',
    noteTextColor: '#e7e9ef',
    noteBorderColor: '#ffb000',
    activationBkgColor: '#232733',
    activationBorderColor: '#ffb000',
    sequenceNumberColor: '#08090c',
  },
  light: {
    background: 'transparent',
    fontFamily: MONO,
    primaryColor: '#f7f4ec',
    primaryBorderColor: '#b9610a',
    primaryTextColor: '#1a1c22',
    secondaryColor: '#fbf9f2',
    tertiaryColor: '#f3efe4',
    lineColor: '#565a64',
    textColor: '#1a1c22',
    actorBkg: '#f7f4ec',
    actorBorder: '#b9610a',
    actorTextColor: '#1a1c22',
    actorLineColor: '#918a78',
    signalColor: '#565a64',
    signalTextColor: '#1a1c22',
    labelBoxBkgColor: '#fbf9f2',
    labelBoxBorderColor: '#cfc8b4',
    labelTextColor: '#b9610a',
    loopTextColor: '#565a64',
    noteBkgColor: '#fbf9f2',
    noteTextColor: '#1a1c22',
    noteBorderColor: '#b9610a',
    activationBkgColor: '#e3dece',
    activationBorderColor: '#b9610a',
    sequenceNumberColor: '#fbf9f2',
  },
};

export function Mermaid({ chart }: { chart: string }) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = 'mmd-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Dynamic import keeps mermaid (~large) out of the main bundle — it loads only
    // on doc pages that actually contain a diagram.
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: PALETTES[theme],
          sequence: { useMaxWidth: true, mirrorActors: false, messageAlign: 'center' },
        });
        const { svg } = await mermaid.render(id, chart);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chart, theme, id]);

  // If mermaid can't parse the diagram, fall back to the raw source so nothing is lost.
  if (failed) {
    return (
      <pre className="doc-mermaid-fallback">
        <code>{chart}</code>
      </pre>
    );
  }
  return <div className="doc-mermaid" ref={ref} role="img" aria-label="Sequence diagram" />;
}
