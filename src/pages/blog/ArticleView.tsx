// Vista previa del artículo (React, sin HTML crudo): refleja cómo lo renderiza el servidor (blog-render.ts).
import { fmtDate } from '../../lib/fmt';
import { cx } from '../../components/ui';
import { parseVideo, safeLink, type Block, type PostDoc, type Runs } from './types';

export const TONES: Record<string, { label: string; box: string; title: string; icon: string }> = {
  info: { label: 'Información', box: 'border-[#9CC7E8] bg-[#EAF4FC]', title: 'text-[#0C3064]', icon: 'i' },
  tip: { label: 'Consejo', box: 'border-[#9AD3B6] bg-[#EAF7F0]', title: 'text-[#0B6B47]', icon: '✓' },
  warning: { label: 'Atención', box: 'border-[#E9C477] bg-[#FDF5E3]', title: 'text-[#8A5A0B]', icon: '!' },
  success: { label: 'Resultado', box: 'border-[#B9C8F2] bg-[#EFF2FD]', title: 'text-[#2F4BA8]', icon: '★' },
};
export function RunsView({ runs }: { runs: Runs }) {
  return <>{runs.map((r, i) => {
    let n: React.ReactNode = r.t.split('\n').flatMap((l, j) => (j ? [<br key={`b${j}`} />, l] : [l]));
    if (r.i) n = <em>{n}</em>; if (r.b) n = <strong>{n}</strong>;
    if (r.a && safeLink(r.a.href)) n = <a href={r.a.href} onClick={e => e.preventDefault()} rel="noopener noreferrer" className="text-link underline decoration-link/40 underline-offset-2">{n}</a>;
    return <span key={i}>{n}</span>;
  })}</>;
}
const IMG_W: Record<string, string> = { small: 'max-w-[260px]', medium: 'max-w-[420px]', large: 'max-w-[640px]', full: 'max-w-none' };
const IMG_A: Record<string, string> = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' };

export function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case 'heading': return b.level === 2 ? <h2 className="mb-3 mt-9 font-display text-[26px] font-bold leading-tight text-navy">{b.text}</h2> : b.level === 3 ? <h3 className="mb-2 mt-7 font-display text-[20px] font-bold leading-snug text-navy">{b.text}</h3> : <h4 className="mb-2 mt-5 text-[16px] font-bold text-ink">{b.text}</h4>;
    case 'paragraph': return <p className="mb-4 text-[16px] leading-[1.75] text-ink"><RunsView runs={b.runs} /></p>;
    case 'list': { const T = b.ordered ? 'ol' : 'ul'; return <T className={cx('mb-4 space-y-1.5 pl-6 text-[16px] leading-[1.7] text-ink', b.ordered ? 'list-decimal' : 'list-disc')}>{b.items.map((it, i) => <li key={i}><RunsView runs={it} /></li>)}</T>; }
    case 'quote': return <blockquote className="my-6 border-l-4 border-brand pl-4 text-[18px] italic leading-relaxed text-navy"><p><RunsView runs={b.runs} /></p>{b.cite && <footer className="mt-1 text-[13px] not-italic text-slate">— {b.cite}</footer>}</blockquote>;
    case 'image': return b.src ? <figure className={cx('my-6 w-full', IMG_W[b.width], IMG_A[b.align])}><img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-lg" />{b.caption && <figcaption className="mt-1.5 text-center text-[13px] text-slate">{b.caption}</figcaption>}</figure> : null;
    case 'callout': { const t = TONES[b.tone]; return <aside role="note" className={cx('my-5 rounded-xl border p-4', t.box)}>{b.title && <strong className={cx('mb-1 block text-[15px]', t.title)}>{b.title}</strong>}<div className="text-[15px] leading-relaxed text-ink"><RunsView runs={b.runs} /></div></aside>; }
    case 'cta': return <p className="my-6"><a href={b.url || '#'} onClick={e => e.preventDefault()} className={cx('inline-flex h-11 items-center rounded-lg px-5 text-[15px] font-semibold', b.style === 'primary' ? 'bg-brand-600 text-white' : 'border border-navy text-navy')}>{b.text}</a>{b.note && <small className="ml-3 text-[13px] text-slate">{b.note}</small>}</p>;
    case 'divider': return <hr className="my-8 border-line-2" />;
    case 'video': { const v = parseVideo(b.url); return v ? <figure className="my-6"><div className="relative aspect-video overflow-hidden rounded-lg bg-black"><iframe src={v.embed} title={b.caption || 'Video'} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" className="absolute inset-0 h-full w-full" /></div>{b.caption && <figcaption className="mt-1.5 text-center text-[13px] text-slate">{b.caption}</figcaption>}</figure> : null; }
    case 'table': { const head = b.header ? b.rows[0] : null; const body = b.header ? b.rows.slice(1) : b.rows; return <div className="my-5 overflow-x-auto"><table className="w-full border-collapse text-[14.5px]">{b.caption && <caption className="mb-1 text-left text-[13px] text-slate">{b.caption}</caption>}{head && <thead><tr>{head.map((c, i) => <th key={i} scope="col" className="border border-line-2 bg-sky px-3 py-2 text-left font-bold text-navy">{c}</th>)}</tr></thead>}<tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-line-2 px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody></table></div>; }
    case 'faq': return <dl className="my-5 divide-y divide-line rounded-xl border border-line">{b.items.map((it, i) => <div key={i} className="px-4 py-3"><dt className="font-bold text-navy">{it.q}</dt><dd className="mt-1 text-[15px] leading-relaxed text-ink"><RunsView runs={it.a} /></dd></div>)}</dl>;
  }
}
export function ArticleView({ doc, authorName }: { doc: PostDoc; authorName?: string }) {
  const mins = Math.max(1, Math.ceil(doc.blocks.reduce((n, b) => n + JSON.stringify(b).split(/\s+/).length, 0) / 220));
  return <article className="mx-auto w-full max-w-[720px] bg-white px-5 py-8 sm:px-8">
    {doc.categories[0] && <p className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand-600">{doc.categories[0]}</p>}
    <h1 className="font-display text-[34px] font-bold leading-[1.15] text-navy">{doc.title || <span className="text-mute">Título del artículo</span>}</h1>
    <p className="mb-6 mt-3 text-[13.5px] text-slate">{(authorName ?? doc.author) || 'Nexa Home'} · {doc.publishedAt ? fmtDate(doc.publishedAt) : 'Sin fecha'} · {mins} min de lectura</p>
    {doc.featuredImage?.src && <img src={doc.featuredImage.src} alt={doc.featuredImage.alt} className="mb-7 w-full rounded-xl" />}
    {doc.blocks.length === 0 ? <p className="text-mute">El artículo aún no tiene contenido.</p> : doc.blocks.map(b => <BlockView key={b.id} b={b} />)}
  </article>;
}
