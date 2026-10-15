// Lista de artículos: filtros (estado, categoría), búsqueda, acciones en lote, duplicar y eliminar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Empty, ErrorState, IconButton, Input, Modal, PageHeader, Popover, MenuItem, Select, TableSkeleton, Tabs, cx, useToast } from '../../components/ui';
import Icon from '../../components/Icon';
import { fmtDate } from '../../lib/fmt';
import { CONNECTED } from '../../lib/db';
import { BIcon } from './icons';
import EmbedSettings from './EmbedSettings';
import { blogApi, errMsg, type ListRes, type Taxonomy } from './blogApi';
import type { PostRow, Status } from './types';

export function StatusBadge({ s }: { s: Status }) {
  const m = { published: ['Publicado', 'bg-[#E6F4EC] text-[#00704A]'], scheduled: ['Programado', 'bg-[#FDF5E3] text-[#8A5A0B]'], draft: ['Borrador', 'bg-[#DDE3EA] text-ink'] }[s];
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-[1px] text-[12px] font-semibold leading-5', m[1])}>{s === 'scheduled' && <BIcon n="clock" s={12} />}{m[0]}</span>;
}

export default function BlogList() {
  const nav = useNavigate(); const toast = useToast();
  const [status, setStatus] = useState<Status | ''>(''); const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [qd, setQd] = useState('');
  const [data, setData] = useState<ListRes | null>(null); const [err, setErr] = useState(''); const [tax, setTax] = useState<Taxonomy | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false); const [sel, setSel] = useState<Set<string>>(new Set()); const [del, setDel] = useState<PostRow[] | null>(null); const [busy, setBusy] = useState(false); const [newCat, setNewCat] = useState('');
  const req = useRef(0);
  useEffect(() => { const t = setTimeout(() => setQd(q), 300); return () => clearTimeout(t); }, [q]);
  const reload = useCallback(() => { const n = ++req.current; blogApi.list({ status, category: cat, q: qd }).then(r => { if (n === req.current) { setData(r); setErr(''); setSel(s => new Set([...s].filter(id => r.results.some(x => x.id === id)))); } }).catch(e => n === req.current && setErr(errMsg(e))); }, [status, cat, qd]);
  useEffect(reload, [reload]);
  useEffect(() => { blogApi.taxonomy().then(setTax).catch(() => {}); }, [data?.total]);
  const rows = data?.results ?? []; const all = rows.length > 0 && rows.every(r => sel.has(r.id)); const some = sel.size > 0 && !all;
  const toggleAll = (v: boolean) => setSel(v ? new Set(rows.map(r => r.id)) : new Set());
  const run = async (label: string, fn: () => Promise<{ updated?: number; skipped?: { id: string; reason: string }[] } | void>) => {
    setBusy(true); try { const r = await fn(); const sk = (r as any)?.skipped as { reason: string }[] | undefined; toast(sk?.length ? `${label}: ${(r as any).updated ?? 0} listo(s), ${sk.length} omitido(s) — ${sk[0].reason}` : label, sk?.length ? 'err' : 'ok'); setSel(new Set()); reload(); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };
  const ids = [...sel];
  const tabs = useMemo(() => [{ id: '' as const, label: 'Todos', count: data?.counts.all }, { id: 'published' as const, label: 'Publicados', count: data?.counts.published }, { id: 'scheduled' as const, label: 'Programados', count: data?.counts.scheduled }, { id: 'draft' as const, label: 'Borradores', count: data?.counts.draft }], [data]);
  const filtering = !!(status || cat || qd);

  return <div>
    <PageHeader title="Blog" sub="Escribe con bloques, cuida la estructura de encabezados y publica con SEO. El contenido se entrega a la web ya renderizado y seguro." actions={<>{CONNECTED && <><button type="button" onClick={() => setEmbedOpen(true)} data-testid="blog-settings" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-link hover:underline"><BIcon n="settings" s={14} />Ajustes del blog</button><a href="/api/v1/public/blog/sitemap.xml" target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-link hover:underline"><BIcon n="external" s={14} />Sitemap</a><a href="/api/v1/public/blog/rss.xml" target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-link hover:underline"><BIcon n="external" s={14} />RSS</a></>}<Button variant="primary" icon="plus" onClick={() => nav('/site/blog/new')}>Crear artículo</Button></>} />
    <Tabs value={status} onChange={v => { setStatus(v); setSel(new Set()); }} items={tabs} />
    <div className="my-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs"><Icon n="search" s={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título o dirección" aria-label="Buscar artículos" className="!pl-8" /></div>
      <Select value={cat} onChange={e => setCat(e.target.value)} aria-label="Filtrar por categoría" className="!w-auto min-w-[170px]"><option value="">Todas las categorías</option>{(tax?.categories ?? []).map(c => <option key={c.name} value={c.name}>{c.name} ({c.n})</option>)}</Select>
      {filtering && <Button variant="ghost" size="sm" onClick={() => { setStatus(''); setCat(''); setQ(''); }}>Quitar filtros</Button>}
    </div>

    {sel.size > 0 && <div role="region" aria-label="Acciones en lote" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-navy/20 bg-sky px-3 py-2"><strong className="mr-1 text-[13.5px] text-navy">{sel.size} seleccionado{sel.size > 1 ? 's' : ''}</strong>
      <Button size="sm" disabled={busy} onClick={() => run('Artículos publicados', () => blogApi.batch(ids, 'publish'))}>Publicar</Button>
      <Button size="sm" disabled={busy} onClick={() => run('Pasados a borrador', () => blogApi.batch(ids, 'draft'))}>Pasar a borrador</Button>
      <Popover width="w-64" trigger={({ toggle, open }) => <Button size="sm" onClick={toggle} aria-expanded={open}>Añadir categoría</Button>}>{close => <div className="p-1.5"><Input list="batch-cats" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Categoría" aria-label="Categoría a añadir" maxLength={60} data-autofocus /><datalist id="batch-cats">{(tax?.categories ?? []).map(c => <option key={c.name} value={c.name} />)}</datalist><Button size="sm" variant="primary" className="mt-2 w-full" disabled={!newCat.trim()} onClick={() => { const c = newCat.trim(); close(); setNewCat(''); void run(`Categoría «${c}» añadida`, () => blogApi.batch(ids, 'add_category', c)); }}>Aplicar</Button></div>}</Popover>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => setDel(rows.filter(r => sel.has(r.id)))}>Eliminar</Button>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSel(new Set())}>Cancelar</Button></div>}

    {err ? <ErrorState title="No se pudieron cargar los artículos" detail={err} onRetry={reload} />
      : !data ? <div className="overflow-hidden rounded-xl border border-line bg-white"><TableSkeleton rows={6} cols={5} /></div>
      : rows.length === 0 ? <div className="rounded-xl border border-line bg-white">{filtering ? <Empty icon="search" title="Ningún artículo coincide">Prueba con otra búsqueda o quita los filtros.</Empty> : <Empty icon="book" title="Aún no hay artículos">Crea el primero: eliges una plantilla con la estructura de encabezados lista (guía, comparativa, lista Top N, caso de éxito…) y el panel Esquema te avisa si algo está mal.<div className="mt-3"><Button variant="primary" icon="plus" onClick={() => nav('/site/blog/new')}>Crear artículo</Button></div></Empty>}</div>
      : <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="w-10 px-4 py-2.5"><Checkbox checked={all} indeterminate={some} onChange={toggleAll} aria={all ? 'Quitar selección' : 'Seleccionar todos'} /></th><th className="py-2.5">Artículo</th><th>Estado</th><th className="max-md:hidden">Categorías</th><th className="max-lg:hidden">Autor</th><th className="max-md:hidden">Fecha</th><th className="pr-2 text-right max-lg:hidden">Lectura</th><th className="w-20 sm:w-24" /></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id} className={cx('border-b border-line/70 hover:bg-sky/40', sel.has(p.id) && 'bg-sky/50')}>
          <td className="px-4 py-2.5"><Checkbox checked={sel.has(p.id)} onChange={v => setSel(s => { const n = new Set(s); if (v) n.add(p.id); else n.delete(p.id); return n; })} aria={`Seleccionar ${p.title}`} /></td>
          <td className="max-w-[44vw] py-2.5 sm:max-w-[360px]"><div className="flex items-center gap-3">{p.featuredImage?.src ? <img src={p.featuredImage.src} alt="" className="h-10 w-14 shrink-0 rounded-md border border-line object-cover" /> : <span className="grid h-10 w-14 shrink-0 place-items-center rounded-md bg-canvas text-mute-2"><BIcon n="image" s={18} /></span>}
            <div className="min-w-0"><Link to={`/site/blog/${p.id}`} className="block truncate font-semibold text-link hover:underline">{p.title}</Link><span className="block truncate text-[12px] text-mute">/blog/{p.slug}{p.hasDraft && <span className="ml-2 rounded bg-[#FDF5E3] px-1.5 font-semibold text-[#8A5A0B]">cambios sin publicar</span>}{p.legacy && <span className="ml-2 rounded bg-canvas px-1.5 text-slate">editor anterior</span>}</span></div></div></td>
          <td><StatusBadge s={p.status} /></td>
          <td className="max-w-[180px] max-md:hidden"><div className="flex flex-wrap gap-1">{p.categories.slice(0, 2).map(c => <span key={c} className="rounded-full bg-sky px-2 py-0.5 text-[11.5px] font-semibold text-navy">{c}</span>)}{p.categories.length > 2 && <span className="text-[11.5px] text-mute">+{p.categories.length - 2}</span>}{!p.categories.length && <span className="text-mute">—</span>}</div></td>
          <td className="max-w-[140px] truncate max-lg:hidden">{p.author || '—'}</td>
          <td className="whitespace-nowrap max-md:hidden">{p.publishedAt ? fmtDate(p.publishedAt) : <span className="text-mute">{fmtDate(p.updatedAt)} (edit.)</span>}</td>
          <td className="pr-2 text-right tabular text-slate max-lg:hidden">{p.readingMinutes} min</td>
          <td className="pr-3 text-right"><div className="flex justify-end"><IconButton n="copy" label={`Duplicar ${p.title}`} onClick={() => run('Artículo duplicado', async () => { await blogApi.duplicate(p.id); })} /><IconButton n="trash" label={`Eliminar ${p.title}`} className="hover:!text-bad" onClick={() => setDel([p])} /></div></td></tr>)}</tbody></table></div>}
    {data && data.total > rows.length && <p className="mt-2 text-center text-[12.5px] text-slate">Mostrando {rows.length} de {data.total}. Usa la búsqueda o los filtros para acotar.</p>}

    {embedOpen && <EmbedSettings onClose={() => setEmbedOpen(false)} />}
    {del && <Modal title={del.length > 1 ? `Eliminar ${del.length} artículos` : 'Eliminar artículo'} onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={() => { const d = del; setDel(null); void run(d.length > 1 ? 'Artículos eliminados' : 'Artículo eliminado', () => blogApi.batch(d.map(x => x.id), 'delete')); }}>Eliminar</Button></>}>
      <p className="text-[14px]">{del.length > 1 ? 'Se eliminarán estos artículos' : <>Se eliminará «{del[0].title}»</>} con su historial{del.some(x => x.status === 'published') ? ' y los publicados dejarán de verse en la web' : ''}. No se puede deshacer.</p></Modal>}
  </div>;
}
