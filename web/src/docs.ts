// Loads the project's Markdown docs (repo-root `docs/`) at build time and exposes them
// as a sorted, grouped tree plus a slug lookup. Adding a .md file under docs/ makes it
// appear automatically — no manifest to maintain. In dev, Vite HMR reflects edits live.
//
// A doc's slug is its path under docs/ without the numeric prefix or extension, e.g.
//   docs/use-cases/02-all-services-gate.md  ->  use-cases/all-services-gate
// Cross-links inside the Markdown use `#/docs/<slug>` and are handled by the viewer.

export interface DocMeta {
  slug: string;
  title: string;
  group: string;
  order: number;
  summary?: string;
}
export interface Doc extends DocMeta {
  body: string;
}
export interface DocGroup {
  group: string;
  items: DocMeta[];
}

// Groups render in this order; anything else falls after, alphabetically.
const GROUP_ORDER = ['Getting started', 'Use cases'];

// Eagerly inline every doc's raw text into the bundle.
const raw = import.meta.glob('../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Minimal front-matter parser: a leading `---\n key: value \n---` block. Values may
// contain colons, so we split on the first `: ` only. Good enough for our simple keys.
function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  }
  return { data, body: text.slice(m[0].length) };
}

function slugFromPath(path: string): string {
  const after = path.slice(path.indexOf('/docs/') + '/docs/'.length); // getting-started/01-set-up-a-host.md
  return after
    .replace(/\.md$/, '')
    .split('/')
    .map((seg) => seg.replace(/^\d+[-_]/, '')) // drop ordering prefixes on each segment
    .join('/');
}

const docs: Doc[] = Object.entries(raw).map(([path, text]) => {
  const { data, body } = parseFrontmatter(text);
  const slug = slugFromPath(path);
  return {
    slug,
    title: data.title || slug,
    group: data.group || 'Docs',
    order: Number(data.order) || 999,
    summary: data.summary,
    body,
  };
});

const bySlug = new Map(docs.map((d) => [d.slug, d]));

export function getDoc(slug: string): Doc | undefined {
  return bySlug.get(slug);
}

export const docGroups: DocGroup[] = (() => {
  const groups = new Map<string, DocMeta[]>();
  for (const d of docs) {
    const list = groups.get(d.group) || [];
    list.push({ slug: d.slug, title: d.title, group: d.group, order: d.order, summary: d.summary });
    groups.set(d.group, list);
  }
  const groupRank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i === -1 ? GROUP_ORDER.length : i;
  };
  return [...groups.entries()]
    .sort((a, b) => groupRank(a[0]) - groupRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([group, items]) => ({ group, items: items.sort((a, b) => a.order - b.order) }));
})();

// The doc shown by default / when a hash points nowhere valid.
export const firstSlug: string = docGroups[0]?.items[0]?.slug ?? '';
