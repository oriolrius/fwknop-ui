import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, FileWarning } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDoc } from '../docs';

/* Fenced code block with a copy button — matches the console's mono aesthetic. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = ref.current?.innerText ?? '';
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="doc-code">
      <button type="button" className="doc-copy" onClick={copy} aria-label="Copy code">
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'copied' : 'copy'}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

export function DocView({ slug, onNavigate }: { slug: string; onNavigate: (slug: string) => void }) {
  const doc = getDoc(slug);

  if (!doc) {
    return (
      <div className="doc-article doc-missing">
        <FileWarning size={22} />
        <p>That document doesn’t exist.</p>
      </div>
    );
  }

  return (
    <motion.article
      key={doc.slug}
      className="doc-article"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="doc-eyebrow">{doc.group}</div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => {
            if (href && href.startsWith('/docs/')) {
              const target = href.slice('/docs/'.length);
              return (
                <a
                  href={`#${href}`}
                  className="doc-link"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(target);
                  }}
                >
                  {children}
                </a>
              );
            }
            const external = !!href && /^https?:/.test(href);
            return (
              <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {children}
              </a>
            );
          },
        }}
      >
        {doc.body}
      </ReactMarkdown>
    </motion.article>
  );
}
