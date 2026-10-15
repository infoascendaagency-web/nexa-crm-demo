// Editor de artículo: bloques + panel lateral (Esquema / SEO / Ajustes) + vista previa + autoguardado + historial.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Empty, ErrorState, IconButton, Modal, Popover, MenuItem, Skeleton, Spinner, Tabs, cx, useToast } from '../../components/ui';
import Icon from '../../components/Icon';
import { relTime } from '../../lib/fmt';
import { OWNERS } from '../../lib/schema';
import BlockEditor, { type Media } from './BlockEditor';
import PreviewPane from './PreviewPane';
import ImagePicker, { OK_IMG, type PickedImage } from './ImagePicker';
import PasteImport, { type ImportMode } from './PasteImport';
import TemplateGallery from './TemplateGallery';
import { useThemes } from './themeAssets';
import OutlinePanel, { HeadingGuide, TemplateCards } from './OutlinePanel';
import SeoPanel, { Meter, ScoreRing } from './SeoPanel';
import SettingsPanel from './SettingsPanel';
import Revisions from './Revisions';
import { ArticleView } from './ArticleView';
import { BIcon } from './icons';
import { analyze, scoreTone, type Issue } from './analysis';
import { blogApi, blog2, errCode, errMsg, mediaStatus, uploadImage, type ImportRes, type SlugCheck, type TemplateInfo, type Taxonomy } from './blogApi';
import { CONNECTED } from '../../lib/db';
import { cleanDoc, defaultLayout, isBlank, makeBlock, newDoc, setEmbedHosts, slugify, uid, type Block, type PostDoc, type PostFull, type Seo, type Status } from './types';
import type { Template } from './templates';
import { mdToBlocks } from './legacy';

const toDoc = (p: PostFull | PostDoc): PostDoc => ({ theme: p.theme || 'nx', layout: { ...defaultLayout(), ...(p.layout ?? {}) }, title: p.title, slug: p.slug, status: p.status, publishedAt: p.publishedAt ?? null, excerpt: p.excerpt ?? '', author: p.author ?? '', authorUserId: p.authorUserId ?? null, categories: p.categories ?? [], tags: p.tags ?? [], featuredImage: p.featuredImage ?? null, seo: { ...newDoc().seo, ...(p.seo ?? {}) }, blocks: p.blocks ?? [], ...(p.body ? { body: p.body } : {}) });
const sig = (d: PostDoc) => JSON.stringify(cleanDoc(d));
type Save = { state: 'idle' | 'saving' | 'saved' | 'auto' | 'error'; at: number; msg?: string };

export default function BlogEditor() {
  const { id: routeId = '' } = useParams(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const isNew = routeId === 'new';
  const [id, setId] = useState<string | null>(isNew ? null : routeId); 
  const [doc, setDoc] = useState<PostDoc>(newDoc()); const [meta, setMeta] = useState<{ createdAt?: string; updatedAt?: string; legacy?: boolean; liveSig?: string }>({});
  const [load, setLoad] = useState<'loading' | 'ok' | 'error' | 'missing'>(isNew ? 'ok' : 'loading'); const [loadErr, setLoadErr] = useState('');
  const [picking, setPicking] = useState(isNew); const [recovered, setRecovered] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew); const [slugState, setSlugState] = useState<(SlugCheck & { checking?: boolean }) | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>(() => { const t = (loc.state as { tab?: string } | null)?.tab; return t === 'preview' || t === 'split' ? t : 'edit'; }); const tabRef = useRef(tab); tabRef.current = tab; const [device, setDevice] = useState<'d' | 'm'>('d'); const [side, setSide] = useState<'outline' | 'seo' | 'settings'>('outline');
  const [save, setSave] = useState<Save>({ state: 'idle', at: 0 }); const [, tick] = useState(0);
  const [tax, setTax] = useState<Taxonomy | null>(null); const [media, setMedia] = useState<Media['status']>('unknown');
  const [focusId, setFocusId] = useState<string | null>(null); const [hist, setHist] = useState(false); const [confirm, setConfirm] = useState<null | { next: Status; items: string[] }>(null); const [del, setDel] = useState(false); const [conflict, setConflict] = useState(false);
  const themes = useThemes(); const [imgModal, setImgModal] = useState<null | { file?: File }>(null); const [pasteOpen, setPasteOpen] = useState(false); const [tplOpen, setTplOpen] = useState(false); const [pendingTpl, setPendingTpl] = useState<TemplateInfo | null>(null); const [tplBusy, setTplBusy] = useState<string | null>(null); const focusedBlock = useRef<string | null>(null);   // ref (no estado): enfocar un bloque no debe re-renderizar todo el editor
  const panelRef = useRef<HTMLDivElement>(null); const synced = useRef(isNew ? sig(newDoc()) : ''); const docRef = useRef(doc); docRef.current = doc; const metaRef = useRef(meta); metaRef.current = meta; const idRef = useRef(id); idRef.current = id; const creating = useRef(false); const busy = useRef(false);

  useLayoutEffect(() => { const el = document.getElementById('post-title'); if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [doc.title, load, picking, tab]);

  /* ---- carga ---- */
  useEffect(() => {
    if (isNew) return; let on = true; setLoad('loading');
    blogApi.get(routeId).then(p => {
      if (!on) return;
      const live = toDoc(p); const useDraft = p.draft && JSON.stringify(cleanDoc(toDoc(p.draft))) !== JSON.stringify(cleanDoc(live));
      let d = useDraft ? toDoc(p.draft!) : live;
      const kept = (loc.state as { doc?: PostDoc } | null)?.doc; const ids = (x: PostDoc) => cleanDoc(x).blocks.map(b => b.id).join();   // (el JSON del servidor reordena las claves: se compara por ids)
      if (kept && !useDraft && ids(kept) === ids(d)) d = { ...d, blocks: kept.blocks };   // al crear el borrador conservamos los bloques vacíos de la plantilla
      setDoc(d); setId(p.id); idRef.current = p.id; setMeta({ createdAt: p.createdAt, updatedAt: p.updatedAt, legacy: p.legacy, liveSig: sig(live) });
      synced.current = sig(d); setRecovered(useDraft ? p.draftUpdatedAt ?? '1' : null); setSlugTouched(true); setLoad('ok');
    }).catch(e => { if (!on) return; if (errCode(e) === 'not_found') setLoad('missing'); else { setLoadErr(errMsg(e)); setLoad('error'); } });
    return () => { on = false; };
  }, [routeId, isNew]); // eslint-disable-line
  useEffect(() => { blogApi.taxonomy().then(setTax).catch(() => {}); mediaStatus().then(setMedia); if (CONNECTED) blog2.embedDomains().then(r => setEmbedHosts(r.domains)).catch(() => {}); }, []);
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }); }, [side]);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t); }, []);
  const mediaApi = useMemo<Media>(() => ({ status: media, upload: uploadImage }), [media]);

  /* ---- análisis en vivo ---- */
  const an = useMemo(() => analyze(doc), [doc]);
  const issuesByBlock = useMemo(() => { const m = new Map<string, Issue[]>(); for (const i of an.issues) if (i.blockId) m.set(i.blockId, [...(m.get(i.blockId) ?? []), i]); return m; }, [an]);
  const dirty = sig(doc) !== synced.current;

  /* ---- slug ---- */
  const patch = useCallback((p: Partial<PostDoc>) => setDoc(d => ({ ...d, ...p })), []);
  const setTitle = (t: string) => setDoc(d => ({ ...d, title: t, ...(!slugTouched ? { slug: slugify(t) } : {}) }));
  const setSlug = (s: string) => { setSlugTouched(true); patch({ slug: s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 120) }); };
  useEffect(() => {
    if (!doc.slug) { setSlugState(null); return; } setSlugState(s => ({ valid: true, available: true, suggestion: null, ...s, checking: true }));
    const t = setTimeout(() => { blogApi.slugCheck(doc.slug, idRef.current ?? undefined).then(r => setSlugState(r)).catch(() => setSlugState(null)); }, 350); return () => clearTimeout(t);
  }, [doc.slug, id]);

  /* ---- guardar ---- */
  const applyServer = (p: PostFull) => { const d = toDoc(p); setDoc(d); setId(p.id); idRef.current = p.id; setMeta({ createdAt: p.createdAt, updatedAt: p.updatedAt, legacy: p.legacy, liveSig: sig(d) }); synced.current = sig(d); setRecovered(null); };
  const doSave = async (status: Status, opts: { silent?: boolean } = {}) => {
    const cur = docRef.current; if (busy.current) return false;
    if (!cur.title.trim()) { toast('Escribe el título del artículo (H1) antes de guardar.', 'err'); document.getElementById('post-title')?.focus(); return false; }
    if (!cur.slug) { toast('El artículo necesita una dirección (slug).', 'err'); setSide('settings'); return false; }
    if (slugState && !slugState.available) { toast('Esa dirección (slug) ya está en uso. Cámbiala en Ajustes.', 'err'); setSide('settings'); return false; }
    busy.current = true; setSave(s => ({ ...s, state: 'saving' }));
    try {
      const wasNew = !idRef.current; const p = await blogApi.save(idRef.current, { ...cur, status }, metaRef.current.updatedAt); applyServer(p); setSave({ state: 'saved', at: Date.now() });
      if (!opts.silent) toast(status === 'published' ? (cur.status === 'published' && !wasNew ? 'Cambios publicados' : 'Artículo publicado') : status === 'scheduled' ? 'Artículo programado' : 'Borrador guardado');
      if (wasNew) { nav(`/site/blog/${p.id}`, { replace: true, state: { doc: toDoc(p), tab: tabRef.current } }); }
      blogApi.taxonomy().then(setTax).catch(() => {}); return true;
    } catch (e) {
      setSave({ state: 'error', at: Date.now(), msg: errMsg(e) });
      if (errCode(e) === 'edit_conflict') setConflict(true);
      else if (errCode(e) === 'sample_content') { toast(errMsg(e), 'err'); const b = cur.blocks.find(x => x.sample); if (b) jump(b.id); }
      else if (errCode(e) === 'alt_required') { const b = cur.blocks.find(x => x.type === 'image' && !x.alt.trim()); toast(errMsg(e), 'err'); if (b) jump(b.id); else setSide('settings'); }
      else if (errCode(e) === 'slug_in_use') { toast(errMsg(e), 'err'); setSide('settings'); } else toast(errMsg(e), 'err');
      return false;
    } finally { busy.current = false; }
  };
  const tryPublish = (next: Status) => {
    const items: string[] = [];
    const samples = doc.blocks.filter(b => b.sample);
    if (next !== 'draft' && samples.length) { toast(`Quedan ${samples.length} bloque(s) con texto de ejemplo de la plantilla. Reemplázalos (o pulsa «Ya está listo» en cada uno) antes de publicar.`, 'err'); jump(samples[0].id); return; }
    if (next !== 'draft') { for (const c of an.checks) if (c.status === 'bad' && c.id !== 'alt') items.push(`${c.label}: ${c.detail}`); an.issues.filter(i => i.sev === 'error' && !/^(alt|cta|vid)-/.test(i.id)).forEach(i => items.push(`${i.title}. ${i.detail}`)); }
    if (items.length && !(doc.status === next && next === 'published' && false)) { setConfirm({ next, items: items.slice(0, 6) }); return; }
    void doSave(next);
  };

  /* ---- autoguardado (a borrador; nunca toca lo publicado) ---- */
  useEffect(() => {
    if (load !== 'ok' || picking || !dirty || busy.current) return;
    const t = setTimeout(async () => {
      if (busy.current) return; const cur = docRef.current; const s = sig(cur); if (s === synced.current) return;
      try {
        if (!idRef.current) {
          if (!cur.title.trim() || creating.current) return; creating.current = true;
          const base = cur.slug || slugify(cur.title) || `borrador-${Date.now().toString(36)}`; const chk = await blogApi.slugCheck(base).catch(() => null); const slug = chk && !chk.available ? chk.suggestion ?? `${base}-${Date.now().toString(36)}` : base;
          const p = await blogApi.save(null, { ...cur, slug, status: 'draft' }); setId(p.id); idRef.current = p.id; setMeta({ createdAt: p.createdAt, updatedAt: p.updatedAt, liveSig: sig(toDoc(p)) }); setDoc(d => ({ ...d, slug: p.slug })); synced.current = sig({ ...cur, slug: p.slug, status: 'draft' }); setSave({ state: 'auto', at: Date.now() }); nav(`/site/blog/${p.id}`, { replace: true, state: { doc: { ...cur, slug: p.slug, status: 'draft' }, tab: tabRef.current } }); creating.current = false; return;
        }
        setSave(x => ({ ...x, state: 'saving' })); await blogApi.autosave(idRef.current, cur); synced.current = s; setSave({ state: 'auto', at: Date.now() });
      } catch (e) { creating.current = false; setSave({ state: 'error', at: Date.now(), msg: errMsg(e) }); }
    }, 1800);
    return () => clearTimeout(t);
  }, [doc, load, picking, dirty]); // eslint-disable-line
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (sig(docRef.current) !== synced.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(docRef.current.status === 'draft' ? 'draft' : docRef.current.status); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }); // eslint-disable-line

  /* ---- acciones de bloques / plantillas ---- */
  const jump = (bid: string) => { setTab(t => (t === 'preview' ? 'edit' : t)); setTimeout(() => { if (bid === '__title') { document.getElementById('post-title')?.focus(); return; } const el = document.querySelector<HTMLElement>(`[data-block-id="${bid}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.querySelector<HTMLElement>('input,textarea,[role=textbox],button')?.focus({ preventScroll: true }); }, 30); };
  const setBlocks = (blocks: Block[]) => patch({ blocks });
  const applyTemplate = (t: Template) => { const bs = t.make(); const hasContent = docRef.current.blocks.length > 0; setDoc(d => ({ ...d, blocks: hasContent ? [...d.blocks, ...bs] : bs })); setPicking(false); setTab('edit'); if (!hasContent && t.titleHint) toast(`Ejemplo de título: «${t.titleHint}»`); if (hasContent) toast(`Plantilla «${t.name}» añadida al final`); setTimeout(() => document.getElementById('post-title')?.focus(), 80); };
  /** Inserta un bloque nuevo justo después del bloque en el que estás (o al final) y lo deja listo para escribir. */
  const insertAfterFocus = (nb: Block) => { setDoc(d => { const i = focusedBlock.current ? d.blocks.findIndex(b => b.id === focusedBlock.current) : -1; const a = [...d.blocks]; a.splice(i < 0 ? a.length : i + 1, 0, nb); return { ...d, blocks: a }; }); setFocusId(nb.id); setTimeout(() => jump(nb.id), 60); };
  const insertImage = (img: PickedImage) => { setImgModal(null); insertAfterFocus({ id: uid(), type: 'image', src: img.src, alt: img.alt, caption: img.caption, align: 'center', width: 'large' }); toast('Imagen insertada'); };
  const insertKind = (type: 'video' | 'table') => insertAfterFocus(makeBlock(type));
  const applyThemed = async (t: TemplateInfo, confirmed = false) => {
    if (!confirmed && docRef.current.blocks.some(b => !isBlank(b)) ) { setPendingTpl(t); return; }
    setTplBusy(t.id); setPendingTpl(null);
    try { const f = await blog2.template(t.id); setDoc(d => ({ ...d, theme: f.theme, layout: { ...defaultLayout(), ...f.layout }, blocks: f.blocks, excerpt: d.excerpt.trim() ? d.excerpt : f.excerpt, categories: d.categories.length ? d.categories : f.categories })); setPicking(false); setTplOpen(false); setTab('edit'); toast(`Plantilla «${f.name}» cargada. Ejemplo de título: «${f.titleHint}»`); setTimeout(() => document.getElementById('post-title')?.focus(), 120); }
    catch (er) { toast(errMsg(er), 'err'); } finally { setTplBusy(null); }
  };
  const applyImported = (r: ImportRes, mode: ImportMode) => {
    setDoc(d => {
      let blocks: Block[];
      if (mode === 'all') blocks = r.blocks;
      else if (mode === 'samples') { const first = d.blocks.findIndex(b => b.sample); const kept = d.blocks.filter(b => !b.sample); const at = first < 0 ? kept.length : d.blocks.slice(0, first).filter(b => !b.sample).length; blocks = [...kept.slice(0, at), ...r.blocks, ...kept.slice(at)]; }
      else blocks = [...d.blocks, ...r.blocks];
      return { ...d, blocks, ...(r.title ? { title: r.title.slice(0, 300), ...(!slugTouched || !d.slug ? { slug: slugify(r.title) } : {}) } : {}) };
    });
    setPasteOpen(false); setTab(t => (t === 'preview' ? 'edit' : t)); setSide('outline'); toast(`Se insertaron ${r.blocks.length} bloques. Revisa la estructura en el Esquema.`);
  };
  const imgFileOf = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find(f => OK_IMG.includes(f.type));
  const onStatus = (s: Status) => setDoc(d => ({ ...d, status: s, publishedAt: s === 'scheduled' ? (d.publishedAt && new Date(d.publishedAt) > new Date() ? d.publishedAt : new Date(Date.now() + 86400000).toISOString()) : s === 'draft' ? d.publishedAt : d.publishedAt && new Date(d.publishedAt) <= new Date() ? d.publishedAt : null }));
  const setLevel = (bid: string, level: 2 | 3 | 4) => setBlocks(doc.blocks.map(b => (b.id === bid && b.type === 'heading' ? { ...b, level } : b)));
  const onSeo = (p: Partial<Seo>) => patch({ seo: { ...doc.seo, ...p } });
  const discardDraft = async () => { if (!id) return; try { await blogApi.discardDraft(id); const p = await blogApi.get(id); applyServer(p); toast('Volviste a la última versión guardada'); } catch (e) { toast(errMsg(e), 'err'); } };
  const dup = async () => { if (!id) return; if (dirty) await doSave(doc.status); try { const p = await blogApi.duplicate(id); toast('Artículo duplicado como borrador'); nav(`/site/blog/${p.id}`); } catch (e) { toast(errMsg(e), 'err'); } };
  const remove = async () => { if (!id) return nav('/site/blog'); try { await blogApi.remove(id); synced.current = sig(doc); toast('Artículo eliminado'); nav('/site/blog'); } catch (e) { toast(errMsg(e), 'err'); } };

  if (load === 'loading') return <div className="space-y-3" role="status" aria-label="Cargando artículo"><Skeleton className="h-10 w-72" /><Skeleton className="h-14 w-full max-w-3xl" /><Skeleton className="h-64 w-full" /></div>;
  if (load === 'missing') return <Empty icon="book" title="Artículo no encontrado"><Link className="font-semibold text-link hover:underline" to="/site/blog">Volver al blog</Link></Empty>;
  if (load === 'error') return <ErrorState title="No se pudo abrir el artículo" detail={loadErr} onRetry={() => window.location.reload()} />;

  const authorName = doc.author || OWNERS.find(o => o.id === String(doc.authorUserId))?.firstName || '';
  const stateTxt = save.state === 'saving' ? 'Guardando…' : save.state === 'error' ? (save.msg ?? 'No se pudo guardar') : dirty ? 'Cambios sin guardar' : save.state === 'auto' ? `Borrador autoguardado ${relTime(new Date(save.at).toISOString())}` : save.state === 'saved' ? `Guardado ${relTime(new Date(save.at).toISOString())}` : id ? 'Todo guardado' : 'Sin guardar';
  const h1len = doc.title.trim().length;
  const acts = doc.status === 'draft'
    ? { a: ['Guardar borrador', () => void doSave('draft')], b: ['Publicar', () => tryPublish('published')] }
    : doc.status === 'scheduled' ? { a: ['Publicar ya', () => { onStatus('published'); setTimeout(() => tryPublish('published'), 0); }], b: ['Guardar programación', () => tryPublish('scheduled')] }
      : { a: ['Pasar a borrador', () => void doSave('draft')], b: ['Actualizar', () => tryPublish('published')] } as { a: [string, () => void]; b: [string, () => void] };
  const sideTabs = [{ id: 'outline' as const, label: 'Esquema', count: an.issues.filter(i => i.sev === 'error').length || undefined }, { id: 'seo' as const, label: `SEO · ${an.score}` }, { id: 'settings' as const, label: 'Ajustes' }];

  return <div className="mx-auto max-w-[1360px]">
    {/* barra superior */}
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      <Link to="/site/blog" className="inline-flex items-center gap-1 text-[13px] font-semibold text-link hover:underline" onClick={e => { if (dirty && !window.confirm('Tienes cambios que aún no se han autoguardado. ¿Salir de todos modos?')) e.preventDefault(); }}><Icon n="chevL" s={13} />Blog</Link>
      <Badge tone={doc.status === 'published' ? 'Confirmed' : doc.status === 'scheduled' ? 'Call later TODAY' : 'Canceled'}>{doc.status === 'published' ? 'Publicado' : doc.status === 'scheduled' ? 'Programado' : 'Borrador'}</Badge>
      <span role="status" aria-live="polite" className={cx('flex items-center gap-1.5 text-[12.5px]', save.state === 'error' ? 'font-semibold text-bad' : 'text-slate')} data-testid="save-state">{save.state === 'saving' && <Spinner s={13} />}{stateTxt}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
 <button type="button" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 bg-white px-3 text-[13.5px] font-semibold text-navy hover:bg-sky lg:hidden" onClick={() => document.getElementById('post-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><BIcon n="seo" s={15} />Esquema y SEO</button>
        <div role="tablist" aria-label="Modo" className="inline-flex overflow-hidden rounded-lg border border-line-2 bg-white">{([['edit', 'Editar'], ['preview', 'Vista previa'], ['split', 'Dividida']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-9 cursor-pointer px-3 text-[13.5px] font-semibold', k === 'split' && 'max-lg:hidden', tab === k ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}>{l}</button>)}</div>
        {id && <Button icon="clock" onClick={() => setHist(true)} aria-label="Historial de versiones"><span className="max-sm:hidden">Historial</span></Button>}
        <Popover align="right" width="w-52" trigger={({ toggle, open }) => <IconButton n="dotsV" label="Más acciones" aria-expanded={open} onClick={toggle} />}>{close => <><MenuItem icon="copy" disabled={!id} onClick={() => { close(); void dup(); }}>Duplicar como borrador</MenuItem><MenuItem icon="trash" danger onClick={() => { close(); setDel(true); }}>Eliminar artículo</MenuItem></>}</Popover>
        <Button onClick={acts.a[1] as () => void} disabled={save.state === 'saving'}>{acts.a[0] as string}</Button>
        <Button variant="primary" onClick={acts.b[1] as () => void} disabled={save.state === 'saving'}>{acts.b[0] as string}</Button>
      </div>
    </div>

    {recovered && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E9C477] bg-[#FDF5E3] px-4 py-2.5 text-[13.5px] text-[#6B4A0A]"><BIcon n="history" s={16} />Recuperamos tus cambios sin publicar{recovered !== '1' ? ` (${relTime(recovered)})` : ''}. Revísalos y guarda cuando estés lista.<button type="button" onClick={discardDraft} className="ml-auto cursor-pointer font-semibold underline">Descartar y volver a la última versión guardada</button></div>}
    {meta.legacy && doc.body && !doc.blocks.length && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] text-slate"><span className="min-w-0 flex-1">Este artículo se escribió con el editor anterior (Markdown) y se sigue publicando tal cual. Para editarlo con bloques, impórtalo: convertimos encabezados, párrafos, listas, citas, imágenes y enlaces (el texto antiguo queda en el historial).</span><Button variant="primary" onClick={() => { const bs = mdToBlocks(doc.body ?? ''); setDoc(d => ({ ...d, blocks: bs, body: undefined })); toast(`Importados ${bs.length} bloques. Revisa los encabezados en el Esquema.`); }}>Importar a bloques</Button></div>}

    <div className={cx('grid items-start gap-5', tab === 'edit' ? 'lg:grid-cols-[minmax(0,1fr)_368px]' : tab === 'split' ? 'lg:grid-cols-2' : '')}>
      {tab === 'preview' ? (!CONNECTED ? <div className="min-w-0"><p className="mb-3 text-[13px] text-slate">Vista simple (modo demo). Conectado al servidor verás el diseño real con el tema elegido.</p><div className="rounded-xl border border-line bg-[#E9EEF3] p-4"><div data-testid="preview-frame" className="mx-auto max-w-[860px] overflow-hidden rounded-lg border border-line bg-white"><ArticleView doc={doc} authorName={authorName} /></div></div></div> : <div className="min-w-0"><PreviewPane doc={doc} authorName={authorName} themes={themes} media={mediaApi} onBlocks={setBlocks} onPatch={patch} onEdit={bid => { setTab('edit'); setTimeout(() => jump(bid), 60); }} /></div>) : <div className="min-w-0"
        onPasteCapture={e => { const f = imgFileOf(e.clipboardData); if (f) { e.preventDefault(); setImgModal({ file: f }); } }}
        onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDrop={e => { const f = imgFileOf(e.dataTransfer); if (f) { e.preventDefault(); setImgModal({ file: f }); } }}>
        {picking ? <Card title="¿Cómo quieres empezar?"><p className="mb-4 text-[13.5px] text-slate">Elige una plantilla: trae el diseño y un contenido de ejemplo ya armado (solo reemplazas el texto o lo pegas con «Pegar contenido»). Siempre puedes cambiarla después.</p><TemplateGallery onPickTheme={t => void applyThemed(t, true)} onPickStructure={applyTemplate} busyId={tplBusy} /></Card>
        : <div className="rounded-xl border border-line bg-white px-4 py-5 sm:px-8 sm:py-7">
          <label htmlFor="post-title" className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-mute"><span className="rounded bg-brand-600 px-1.5 text-[11px] font-extrabold text-white">H1</span>Título del artículo</label>
          <textarea id="post-title" rows={1} value={doc.title} onChange={e => { setTitle(e.target.value.replace(/\n/g, ' ')); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const first = document.querySelector<HTMLElement>('[data-block-id] [role=textbox],[data-block-id] input,[data-block-id] textarea'); first?.focus(); } }} maxLength={300} placeholder="Promesa clara + palabra clave. Ej. Cuánto cuesta cambiar un techo en Florida" aria-describedby="h1-help" className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-[28px] font-bold leading-tight text-navy placeholder:font-normal placeholder:text-mute-2 hover:border-line focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25 sm:text-[34px]" />
          <div id="h1-help" className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-x-4 px-2 text-[12.5px]"><span className="text-slate">Es el único H1: dice de qué trata y a quién ayuda. Ideal: unos 60 caracteres.</span><span className={cx('tabular', h1len > 70 ? 'font-bold text-[#8A5A0B]' : 'text-mute')}>{h1len}/60</span></div>
          <div role="toolbar" aria-label="Insertar en el artículo" data-testid="editor-toolbar" className="z-20 -mx-2 mb-4 md:sticky md:top-[56px] flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white/95 px-2.5 py-2 shadow-[0_6px_16px_-12px_rgba(12,49,102,.35)] backdrop-blur"><span className="mr-1 text-[12px] font-bold uppercase tracking-wide text-mute max-sm:hidden">Insertar</span>
            <Button variant="primary" size="sm" icon="image" onClick={() => setImgModal({})} data-testid="add-image">Agregar imagen</Button>
            <Button size="sm" onClick={() => insertKind('video')}><BIcon n="video" s={15} />Video</Button>
            <Button size="sm" icon="table" onClick={() => insertKind('table')}>Tabla</Button>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
            <Button size="sm" onClick={() => setPasteOpen(true)} data-testid="paste-content">Pegar contenido</Button>
            <Button size="sm" onClick={() => setTplOpen(true)} data-testid="open-templates">Plantillas</Button></div>
          <BlockEditor blocks={doc.blocks} onChange={setBlocks} issues={issuesByBlock} media={mediaApi} focusId={focusId} onFocused={() => setFocusId(null)} onFeatured={(src, alt) => patch({ featuredImage: { src, alt } })} featuredSrc={doc.featuredImage?.src} onFocusBlock={id => { focusedBlock.current = id; }} onAddImage={() => setImgModal({})} onPasteContent={() => setPasteOpen(true)} />
          {doc.blocks.length === 0 && <div className="mt-6 border-t border-line pt-4"><p className="mb-2 text-[13px] font-semibold text-navy">¿Prefieres partir de una plantilla con diseño?</p><Button icon="plus" onClick={() => setTplOpen(true)}>Ver plantillas</Button></div>}
        </div>}
      </div>}
      {tab === 'split' && CONNECTED && <div className="min-w-0 lg:sticky lg:top-[68px]"><PreviewPane split doc={doc} authorName={authorName} themes={themes} media={mediaApi} onBlocks={setBlocks} onPatch={patch} onEdit={jump} /></div>}

      {tab === 'edit' && <aside id="post-panel" aria-label="Panel del artículo" className="min-w-0 lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-88px)] lg:self-start">
        <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3"><ScoreRing score={an.score} /><div className="min-w-0"><p className="font-display text-[14px] font-bold text-navy">Calidad del artículo</p><p className="text-[12.5px] text-slate">{an.words} palabras · {an.minutes} min · {an.outline.length} encabezados</p>{an.headingErrors > 0 && <p className="text-[12px] font-semibold text-bad">{an.headingErrors} error(es) de estructura</p>}</div></div>
          <div className="shrink-0"><Tabs value={side} onChange={setSide} items={sideTabs} /></div>
          <div ref={panelRef} className="scroll-thin flex-1 overflow-y-auto p-4" role="tabpanel" data-testid={`panel-${side}`}>
            {side === 'outline' && <OutlinePanel doc={doc} an={an} onJump={jump} onSetLevel={setLevel} onTemplate={applyTemplate} />}
            {side === 'seo' && <SeoPanel doc={doc} an={an} onSeo={onSeo} ogFallbackImage={doc.featuredImage?.src ?? ''} />}
            {side === 'settings' && <SettingsPanel themes={themes} doc={doc} set={patch} slug={doc.slug} onSlug={setSlug} slugState={slugState} minutes={an.minutes} tax={tax} media={mediaApi} onStatus={onStatus} />}
          </div>
        </div>
      </aside>}
    </div>

    {imgModal && <ImagePicker media={mediaApi} initialFile={imgModal.file} onClose={() => setImgModal(null)} onInsert={insertImage} />}
    {pasteOpen && <PasteImport hasSamples={doc.blocks.some(b => b.sample)} hasContent={doc.blocks.some(b => !isBlank(b))} titleEmpty={!doc.title.trim()} onClose={() => setPasteOpen(false)} onApply={applyImported} />}
    {tplOpen && <Modal title="Plantillas de artículo" width="max-w-5xl" onClose={() => setTplOpen(false)}><TemplateGallery onPickTheme={t => void applyThemed(t)} onPickStructure={t => { setTplOpen(false); applyTemplate(t); }} busyId={tplBusy} /></Modal>}
    {pendingTpl && <Modal title={`Usar la plantilla «${pendingTpl.name}»`} onClose={() => setPendingTpl(null)} footer={<><Button onClick={() => setPendingTpl(null)}>Cancelar</Button><Button variant="primary" onClick={() => void applyThemed(pendingTpl, true)}>Reemplazar el contenido</Button></>}><p className="text-[14px]">Esto cambia el diseño y <strong>reemplaza el contenido actual</strong> por el ejemplo de la plantilla. El título, la dirección y el SEO se conservan. Si luego te arrepientes, el Historial guarda la versión anterior.</p></Modal>}
    {hist && id && <Revisions id={id} onClose={() => setHist(false)} onRestored={p => { applyServer(p); setHist(false); }} />}
    {confirm && <Modal title={confirm.next === 'draft' ? 'Guardar' : 'Antes de publicar'} onClose={() => setConfirm(null)} footer={<><Button onClick={() => { setConfirm(null); setSide('outline'); }}>Seguir editando</Button><Button variant="primary" onClick={() => { const n = confirm.next; setConfirm(null); void doSave(n); }}>{confirm.next === 'scheduled' ? 'Programar de todos modos' : 'Publicar de todos modos'}</Button></>}>
      <p className="mb-2 text-[14px]">Encontramos cosas que conviene arreglar para que el artículo se lea y posicione bien:</p>
      <ul className="space-y-1.5">{confirm.items.map((t, i) => <li key={i} className="flex items-start gap-2 rounded-lg bg-[#FDECEC]/60 px-3 py-2 text-[13px]"><BIcon n="alert" s={15} className="mt-0.5 shrink-0 text-bad" />{t}</li>)}</ul></Modal>}
    {del && <Modal title="Eliminar artículo" onClose={() => setDel(false)} footer={<><Button onClick={() => setDel(false)}>Cancelar</Button><Button variant="danger" onClick={remove}>Eliminar</Button></>}><p className="text-[14px]">Se eliminará «{doc.title || 'este artículo'}» con todo su historial{doc.status === 'published' ? ' y dejará de estar visible en la web' : ''}. No se puede deshacer.</p></Modal>}
    {conflict && <Modal title="Alguien más editó este artículo" onClose={() => setConflict(false)} footer={<Button variant="primary" onClick={() => window.location.reload()}>Recargar</Button>}><p className="text-[14px]">Otra persona guardó cambios mientras lo editabas. Para no pisar su trabajo, recarga la página y vuelve a aplicar tus cambios (los tuyos siguen en el borrador autoguardado si llegaron a guardarse).</p></Modal>}
  </div>;
}
export { HeadingGuide, Meter, scoreTone, uid };
