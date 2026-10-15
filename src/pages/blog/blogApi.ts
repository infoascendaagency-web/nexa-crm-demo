// Acceso a datos del blog. Conectado: API real (/site/posts…). Demo: localStorage (misma forma, sin servidor).
import { api, ApiError } from '../../lib/backend';
import { CONNECTED } from '../../lib/db';
import { cleanDoc, slugify, uid, type Block, type Layout, type PostDoc, type PostFull, type PostRow, type Status } from './types';
import { words } from './analysis';
import { blockPlain } from './analysis';

export type ListQuery = { status?: Status | ''; category?: string; q?: string; limit?: number; offset?: number };
export type ListRes = { results: PostRow[]; total: number; counts: { all: number; draft: number; scheduled: number; published: number } };
export type Revision = { id: number; title: string; status: Status; reason: string; by: string; at: string; words: number };
export type Taxonomy = { categories: { name: string; n: number }[]; tags: { name: string; n: number }[]; authors: string[] };
export type SlugCheck = { valid: boolean; available: boolean; suggestion: string | null };

const MSG: Record<string, string> = {
  sample_content: 'Quedan textos de ejemplo de la plantilla. Reemplázalos o bórralos antes de publicar.', invalid_domain: 'Hay un dominio no válido.', admin_only: 'Solo un administrador puede cambiar esto.', empty_text: 'Pega primero el texto que quieres convertir.',
  slug_in_use: 'Ya existe un artículo con ese slug (dirección). Cámbialo para guardar.', alt_required: 'Faltan textos alternativos en algunas imágenes. Descríbelas antes de publicar.', edit_conflict: 'Otra persona guardó cambios en este artículo mientras lo editabas. Recarga para ver su versión.',
  scheduled_requires_date: 'Para programar elige fecha y hora de publicación.', invalid_input: 'Hay datos no válidos en el artículo.', section_not_permitted: 'No tienes permiso para el blog.', forbidden: 'No tienes permiso para esta acción.', payload_too_large: 'El artículo es demasiado grande (máx. ~400 KB). Divídelo en dos.', rate_limited: 'Demasiadas peticiones. Espera un momento.',
};
export const errMsg = (e: unknown) => { if (e instanceof ApiError) { const d = (e.detail as any)?.message; return e.code === 'invalid_input' && d ? `Datos no válidos — ${String(d).slice(0, 200)}` : (['alt_required', 'sample_content', 'invalid_domain'].includes(e.code) && d ? d : MSG[e.code]) ?? `Error del servidor (${e.code})`; } return (e as Error)?.message || 'Error inesperado'; };
export const errCode = (e: unknown) => (e instanceof ApiError ? e.code : '');

/* ============ DEMO (localStorage) ============ */
type DemoDB = { posts: PostFull[]; revs: Record<string, (Revision & { snap: PostDoc })[]>; rid: number };
const KEY = 'nx-crm-blog-demo-v1';
const dload = (): DemoDB => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* */ } return { posts: [], revs: {}, rid: 1 }; };
let mem: DemoDB | null = null; const D = () => (mem ??= dload()); const dsave = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* */ } };
const wc = (d: PostDoc) => d.blocks.reduce((n, b) => n + words(blockPlain(b)), 0);
const row = (p: PostFull): PostRow => ({ id: p.id, slug: p.slug, title: p.title, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt, createdAt: p.createdAt, author: p.author, categories: p.categories, tags: p.tags, excerpt: p.excerpt, featuredImage: p.featuredImage, wordCount: wc(p), readingMinutes: Math.max(1, Math.ceil(wc(p) / 200)), hasDraft: !!p.draft, legacy: false });
function dSnap(id: string, p: PostFull, reason: string) { const list = (D().revs[id] ??= []); const snap = JSON.parse(JSON.stringify(cleanDoc(p))); if (list[0] && JSON.stringify(list[0].snap) === JSON.stringify(snap)) return; list.unshift({ id: D().rid++, title: p.title, status: p.status, reason, by: 'Tú (demo)', at: new Date().toISOString(), words: wc(p), snap }); list.length = Math.min(list.length, 50); }
const demo = {
  async list(q: ListQuery): Promise<ListRes> {
    const all = D().posts; const ql = (q.q ?? '').toLowerCase().trim();
    const f = all.filter(p => (!q.status || p.status === q.status) && (!q.category || p.categories.includes(q.category)) && (!ql || p.title.toLowerCase().includes(ql) || p.slug.includes(ql)));
    const c = (s: Status) => all.filter(p => p.status === s).length;
    return { results: f.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).map(row), total: f.length, counts: { all: all.length, draft: c('draft'), scheduled: c('scheduled'), published: c('published') } };
  },
  async get(id: string): Promise<PostFull> { const p = D().posts.find(x => x.id === id); if (!p) throw new ApiError(404, 'not_found'); return JSON.parse(JSON.stringify(p)); },
  async save(id: string | null, doc: PostDoc): Promise<PostFull> {
    const d = D(); const now = new Date().toISOString(); if (d.posts.some(p => p.slug === doc.slug && p.id !== id)) throw new ApiError(409, 'slug_in_use');
    let status = doc.status; let pub = doc.publishedAt;
    if (status !== 'draft' && [...doc.blocks].some(b => b.type === 'image' && !b.alt.trim())) throw new ApiError(422, 'alt_required');
    if (status === 'scheduled' && !pub) throw new ApiError(400, 'scheduled_requires_date'); if (status === 'published') { pub = pub ?? now; if (new Date(pub).getTime() > Date.now() + 60000) status = 'scheduled'; } if (status === 'scheduled' && new Date(pub!).getTime() <= Date.now()) status = 'published'; if (status === 'draft') pub = null;
    const cur = id ? d.posts.find(p => p.id === id) : null; const p: PostFull = { ...(doc as PostDoc), status, publishedAt: pub, id: cur?.id ?? uid(), createdAt: cur?.createdAt ?? now, updatedAt: now, draft: null, draftUpdatedAt: null };
    if (cur) d.posts[d.posts.indexOf(cur)] = p; else d.posts.unshift(p); dSnap(p.id, p, status === 'draft' ? 'save' : 'publish'); dsave(); return JSON.parse(JSON.stringify(p));
  },
  async autosave(id: string, doc: PostDoc) { const p = D().posts.find(x => x.id === id); if (!p) throw new ApiError(404, 'not_found'); p.draft = doc; p.draftUpdatedAt = new Date().toISOString(); dsave(); return { ok: true, draftUpdatedAt: p.draftUpdatedAt }; },
  async discardDraft(id: string) { const p = D().posts.find(x => x.id === id); if (p) { p.draft = null; p.draftUpdatedAt = null; dsave(); } },
  async remove(id: string) { const d = D(); d.posts = d.posts.filter(p => p.id !== id); delete d.revs[id]; dsave(); },
  async duplicate(id: string): Promise<PostFull> { const d = D(); const s = d.posts.find(p => p.id === id); if (!s) throw new ApiError(404, 'not_found'); let slug = `${s.slug}-copia`, n = 1; while (d.posts.some(p => p.slug === slug)) slug = `${s.slug}-copia-${++n}`; const now = new Date().toISOString(); const p: PostFull = { ...JSON.parse(JSON.stringify(s)), id: uid(), slug, title: `${s.title} (copia)`, status: 'draft', publishedAt: null, createdAt: now, updatedAt: now, draft: null, draftUpdatedAt: null }; d.posts.unshift(p); dSnap(p.id, p, 'save'); dsave(); return p; },
  async batch(ids: string[], action: string, category?: string) {
    const d = D(); let updated = 0; const skipped: { id: string; reason: string }[] = [];
    for (const id of ids) { const p = d.posts.find(x => x.id === id); if (!p) continue;
      if (action === 'delete') { d.posts = d.posts.filter(x => x.id !== id); updated++; } else if (action === 'draft') { p.status = 'draft'; p.publishedAt = null; updated++; }
      else if (action === 'publish') { if (p.blocks.some(b => b.type === 'image' && !b.alt.trim())) { skipped.push({ id, reason: 'imagen(es) sin texto alternativo' }); continue; } p.status = 'published'; p.publishedAt = p.publishedAt ?? new Date().toISOString(); updated++; }
      else if (action === 'add_category' && category) { if (!p.categories.includes(category)) p.categories.push(category); updated++; } else if (action === 'remove_category' && category) { p.categories = p.categories.filter(c => c !== category); updated++; } }
    dsave(); return { ok: true, updated, skipped };
  },
  async taxonomy(): Promise<Taxonomy> { const c = new Map<string, number>(), t = new Map<string, number>(); const au = new Set<string>(); for (const p of D().posts) { p.categories.forEach(x => c.set(x, (c.get(x) ?? 0) + 1)); p.tags.forEach(x => t.set(x, (t.get(x) ?? 0) + 1)); if (p.author) au.add(p.author); } const arr = (m: Map<string, number>) => [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n); return { categories: arr(c), tags: arr(t), authors: [...au] }; },
  async slugCheck(slug: string, exclude?: string): Promise<SlugCheck> { const ok = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug); const taken = (s: string) => D().posts.some(p => p.slug === s && p.id !== exclude); let sug: string | null = null; if (ok && taken(slug)) for (let i = 2; i < 50; i++) if (!taken(`${slug}-${i}`)) { sug = `${slug}-${i}`; break; } return { valid: ok, available: ok && !taken(slug), suggestion: sug }; },
  async revisions(id: string): Promise<{ results: Revision[]; max: number }> { return { results: (D().revs[id] ?? []).map(({ snap: _s, ...r }) => r), max: 50 }; },
  async revision(id: string, rid: number): Promise<PostDoc & { id: number }> { const r = (D().revs[id] ?? []).find(x => x.id === rid); if (!r) throw new ApiError(404, 'not_found'); return { ...JSON.parse(JSON.stringify(r.snap)), id: r.id }; },
  async restore(id: string, rid: number): Promise<PostFull> { const d = D(); const p = d.posts.find(x => x.id === id); const r = (d.revs[id] ?? []).find(x => x.id === rid); if (!p || !r) throw new ApiError(404, 'not_found'); dSnap(id, p, 'before_restore'); Object.assign(p, JSON.parse(JSON.stringify(r.snap)), { status: p.status, publishedAt: p.publishedAt, updatedAt: new Date().toISOString(), draft: null, draftUpdatedAt: null }); dSnap(id, p, 'restore'); dsave(); return JSON.parse(JSON.stringify(p)); },
};

/* ============ CONECTADO ============ */
const qs = (q: ListQuery) => { const u = new URLSearchParams(); if (q.status) u.set('status', q.status); if (q.category) u.set('category', q.category); if (q.q?.trim()) u.set('q', q.q.trim()); u.set('limit', String(q.limit ?? 100)); u.set('offset', String(q.offset ?? 0)); return u.toString(); };
const body = (d: PostDoc, extra?: object) => ({ ...cleanDoc(d), ...extra });
const real = {
  list: (q: ListQuery) => api<ListRes>('GET', '/site/posts?' + qs(q)),
  get: (id: string) => api<PostFull>('GET', `/site/posts/${encodeURIComponent(id)}`),
  save: (id: string | null, d: PostDoc, base?: string) => (id ? api<PostFull>('PUT', `/site/posts/${id}`, body(d, { baseUpdatedAt: base ?? null })) : api<PostFull>('POST', '/site/posts', body(d))),
  autosave: (id: string, d: PostDoc) => api<{ ok: true; draftUpdatedAt: string }>('PUT', `/site/posts/${id}/draft`, body(d)),
  discardDraft: (id: string) => api('DELETE', `/site/posts/${id}/draft`),
  remove: (id: string) => api('DELETE', `/site/posts/${id}`),
  duplicate: (id: string) => api<PostFull>('POST', `/site/posts/${id}/duplicate`, {}),
  batch: (ids: string[], action: string, category?: string) => api<{ ok: true; updated: number; skipped: { id: string; reason: string }[] }>('POST', '/site/posts/batch', { ids, action, ...(category ? { category } : {}) }),
  taxonomy: () => api<Taxonomy>('GET', '/site/posts/taxonomy'),
  slugCheck: (slug: string, exclude?: string) => api<SlugCheck>('GET', `/site/posts/slug-check?slug=${encodeURIComponent(slug)}${exclude ? `&exclude=${encodeURIComponent(exclude)}` : ''}`),
  revisions: (id: string) => api<{ results: Revision[]; max: number }>('GET', `/site/posts/${id}/revisions`),
  revision: (id: string, rid: number) => api<PostDoc & { id: number }>('GET', `/site/posts/${id}/revisions/${rid}`),
  restore: (id: string, rid: number) => api<PostFull>('POST', `/site/posts/${id}/revisions/${rid}/restore`, {}),
};
export const blogApi = {
  list: (q: ListQuery) => (CONNECTED ? real.list(q) : demo.list(q)),
  get: (id: string) => (CONNECTED ? real.get(id) : demo.get(id)),
  save: (id: string | null, d: PostDoc, base?: string) => (CONNECTED ? real.save(id, d, base) : demo.save(id, cleanDoc(d))),
  autosave: (id: string, d: PostDoc) => (CONNECTED ? real.autosave(id, d) : demo.autosave(id, cleanDoc(d))),
  discardDraft: (id: string) => (CONNECTED ? real.discardDraft(id) : demo.discardDraft(id)),
  remove: (id: string) => (CONNECTED ? real.remove(id) : demo.remove(id)),
  duplicate: (id: string) => (CONNECTED ? real.duplicate(id) : demo.duplicate(id)),
  batch: (ids: string[], action: string, category?: string) => (CONNECTED ? real.batch(ids, action, category) : demo.batch(ids, action, category)),
  taxonomy: () => (CONNECTED ? real.taxonomy() : demo.taxonomy()),
  slugCheck: (slug: string, exclude?: string) => (CONNECTED ? real.slugCheck(slug, exclude) : demo.slugCheck(slug, exclude)),
  revisions: (id: string) => (CONNECTED ? real.revisions(id) : demo.revisions(id)),
  revision: (id: string, rid: number) => (CONNECTED ? real.revision(id, rid) : demo.revision(id, rid)),
  restore: (id: string, rid: number) => (CONNECTED ? real.restore(id, rid) : demo.restore(id, rid)),
};

/* ============ Medios (subida de imágenes por URL prefirmada de S3) ============ */
export async function mediaStatus(): Promise<'ready' | 'unconfigured'> {
  if (!CONNECTED) return 'unconfigured';
  try { const r = await api<{ configured: boolean }>('GET', '/site/files?folder=blog'); return r.configured ? 'ready' : 'unconfigured'; } catch { return 'unconfigured'; }
}
export async function uploadImage(f: File): Promise<string> {
  if (!CONNECTED) throw new Error('La subida de imágenes solo funciona conectado al servidor. Pega la dirección (https://) de la imagen.');
  let pre: { id: string; uploadUrl: string; headers: Record<string, string> };
  try { pre = await api('POST', '/site/files/presign', { folder: 'blog', name: f.name, mime: f.type, size: f.size }); }
  catch (e) { if (errCode(e) === 'files_not_configured') throw new Error('La subida de archivos no está configurada en este entorno. Pega la dirección (https://) de la imagen.'); if (errCode(e) === 'file_type_not_allowed') throw new Error('Tipo de archivo no permitido.'); throw e; }
  const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: pre.headers, body: f }); if (!put.ok) throw new Error('No se pudo subir el archivo al almacenamiento.');
  await api('POST', `/site/files/${pre.id}/complete`, {});
  try { return (await api<{ url: string }>('GET', `/site/posts/media/${pre.id}/public-url`)).url; }
  catch (e) { if (errCode(e) === 'media_not_public') throw new Error('La imagen se subió, pero falta configurar la dirección pública de las imágenes del blog (BLOG_MEDIA_BASE_URL).'); throw e; }
}

/* ============ Blog 2.0: temas, plantillas, vista previa del servidor, importar texto, dominios de incrustado ============ */
export type ThemeInfo = { id: string; name: string; tagline: string; bestFor: string; container: 'narrow' | 'normal' | 'wide'; swatch: [string, string, string, string]; fontsUrl: string; cssUrl: string };
export type TemplateInfo = { id: string; name: string; theme: string; tagline: string; bestFor: string; titleHint: string; excerpt: string; categories: string[]; layout: Layout; swatch: [string, string, string, string]; wrapperClass: string; html: string; blockCount: number };
export type TemplateFull = { id: string; name: string; theme: string; titleHint: string; excerpt: string; categories: string[]; layout: Partial<Layout>; blocks: Block[] };
export type PreviewRes = { html: string; article?: string; wrapperClass?: string; theme?: string; themeCssUrl?: string; words: number; minutes: number };
export type ImportRes = { blocks: Block[]; title: string; warnings: string[]; stats: Record<string, number> };
export type EmbedDomains = { builtin: { id: string; name: string; example: string }[]; domains: string[]; max: number };
const needServer = () => new Error('Esta función necesita estar conectado al servidor.');
export const blog2 = {
  themes: (): Promise<{ default: string; themes: ThemeInfo[] }> => (CONNECTED ? api('GET', '/site/posts/themes') : Promise.reject(needServer())),
  templates: (): Promise<{ results: TemplateInfo[] }> => (CONNECTED ? api('GET', '/site/posts/templates') : Promise.reject(needServer())),
  template: (id: string): Promise<TemplateFull> => (CONNECTED ? api('GET', `/site/posts/templates/${encodeURIComponent(id)}`) : Promise.reject(needServer())),
  /** Render del servidor (el mismo HTML que verá el visitante). Las imágenes sin archivo salen como recuadro y cada bloque lleva data-bid. */
  preview: (d: PostDoc, authorName: string): Promise<PreviewRes> => {
    if (!CONNECTED) return Promise.reject(needServer());
    const c = cleanDoc(d, true);
    return api('POST', '/site/posts/preview', { blocks: c.blocks, doc: { title: c.title, excerpt: c.excerpt, author: authorName, categories: c.categories, tags: c.tags, featuredImage: c.featuredImage?.src ? { src: c.featuredImage.src, alt: c.featuredImage.alt } : null, publishedAt: c.publishedAt, theme: c.theme, layout: c.layout } });
  },
  importText: (text: string, o: { plainHeadings: boolean; firstLineTitle: boolean }): Promise<ImportRes> => (CONNECTED ? api('POST', '/site/posts/import', { text, ...o }) : Promise.reject(needServer())),
  embedDomains: (): Promise<EmbedDomains> => (CONNECTED ? api('GET', '/site/posts/embed-domains') : Promise.reject(needServer())),
  saveEmbedDomains: (domains: string[]): Promise<EmbedDomains> => api('PUT', '/site/posts/embed-domains', { domains }),
};
export { slugify };
