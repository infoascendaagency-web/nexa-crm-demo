// Tipos y utilidades del blog por bloques (espejo del esquema del servidor: backend/src/lib/blog-schema.ts).
export type Run = { t: string; b?: boolean; i?: boolean; a?: { href: string; nofollow?: boolean; blank?: boolean } };
export type Runs = Run[];
export type Align = 'left' | 'center' | 'right';
export type Width = 'small' | 'medium' | 'large' | 'full';
export type Tone = 'info' | 'tip' | 'warning' | 'success';
/** Ancho del bloque dentro del artículo. */
export type BW = 'narrow' | 'normal' | 'wide' | 'full';
export const BW_LABEL: Record<BW, string> = { narrow: 'Angosto', normal: 'Normal', wide: 'Ancho', full: 'Completo' };
/** `w` = ancho del bloque; `sample` = texto de ejemplo de una plantilla (no se puede publicar mientras exista). */
type Extra = { w?: BW; sample?: boolean };
export type Block = (
  | { id: string; type: 'heading'; level: 2 | 3 | 4; text: string }
  | { id: string; type: 'paragraph'; runs: Runs; hint?: string }
  | { id: string; type: 'list'; ordered: boolean; items: Runs[] }
  | { id: string; type: 'quote'; runs: Runs; cite?: string; hint?: string }
  | { id: string; type: 'image'; src: string; alt: string; caption?: string; align: Align; width: Width }
  | { id: string; type: 'callout'; tone: Tone; title?: string; runs: Runs; hint?: string }
  | { id: string; type: 'cta'; text: string; url: string; style: 'primary' | 'secondary'; note?: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'video'; url: string; caption?: string }
  | { id: string; type: 'table'; header: boolean; rows: string[][]; caption?: string }
  | { id: string; type: 'faq'; items: { q: string; a: Runs }[] }) & Extra;
export type BlockType = Block['type'];
export type Seo = { title: string; description: string; keyword: string; canonical: string; noindex: boolean; ogTitle: string; ogDescription: string; ogImage: string };
export type Status = 'draft' | 'scheduled' | 'published';
/** Lo editable de un artículo (lo que viaja al servidor). */
export type Container = 'narrow' | 'normal' | 'wide';
export type Layout = { container: Container; toc: boolean; authorBox: boolean; heroImage: boolean };
export const defaultLayout = (): Layout => ({ container: 'normal', toc: false, authorBox: true, heroImage: true });
export type PostDoc = {
  theme: string; layout: Layout;
  title: string; slug: string; status: Status; publishedAt: string | null; excerpt: string; author: string; authorUserId?: string | number | null;
  categories: string[]; tags: string[]; featuredImage: { src: string; alt: string } | null; seo: Seo; blocks: Block[]; body?: string;
};
export type PostFull = PostDoc & { id: string; createdAt: string; updatedAt: string; legacy?: boolean; draft?: PostDoc | null; draftUpdatedAt?: string | null; wordCount?: number; readingMinutes?: number };
export type PostRow = { id: string; slug: string; title: string; status: Status; publishedAt: string | null; updatedAt: string; createdAt: string; author: string; categories: string[]; tags: string[]; excerpt: string; featuredImage: { src: string; alt: string } | null; wordCount: number; readingMinutes: number; hasDraft: boolean; legacy: boolean };

let seq = 0;
export const uid = () => 'b' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
export const emptySeo = (): Seo => ({ title: '', description: '', keyword: '', canonical: '', noindex: false, ogTitle: '', ogDescription: '', ogImage: '' });
export const newDoc = (): PostDoc => ({ theme: 'nx', layout: defaultLayout(), title: '', slug: '', status: 'draft', publishedAt: null, excerpt: '', author: '', authorUserId: null, categories: [], tags: [], featuredImage: null, seo: emptySeo(), blocks: [] });
export const runsText = (r: Runs) => r.map(x => x.t).join('');
export const plain = (t: string): Runs => (t ? [{ t }] : []);

export const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

/** Mismo criterio que el servidor: https, mailto, /ruta o #ancla (nunca javascript:, data:, http:). */
export function safeLink(raw: string): string | null {
  const u = raw.trim();
  if (!u || u.length > 2000 || /[\s<>"'`\\]/.test(u)) return null;
  if (u.startsWith('/')) return u.startsWith('//') ? null : u;
  if (u.startsWith('#')) return u.length > 1 ? u : null;
  if (u.slice(0, 7).toLowerCase() === 'mailto:') { const a = u.slice(7); const at = a.indexOf('@'); return at > 0 && at < a.length - 3 ? u : null; }
  if (u.slice(0, 8).toLowerCase() !== 'https://') return null;
  try { const p = new URL(u); return p.protocol === 'https:' && p.hostname.includes('.') && !p.username ? u : null; } catch { return null; }
}
/** Intenta arreglar lo que escribe una persona normal: "www.sitio.com" → https://www.sitio.com, http:// → https://. */
export function fixLink(raw: string): string {
  let u = raw.trim(); if (!u) return u;
  if (/^http:\/\//i.test(u)) u = 'https://' + u.slice(7);
  else if (!/^(https:\/\/|\/|#|mailto:)/i.test(u) && /^[\w-]+(\.[\w-]+)+(\/|$|\?)/.test(u)) u = 'https://' + u;
  else if (!/^(https:\/\/|\/|#|mailto:)/i.test(u) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) u = 'mailto:' + u;
  return u;
}
/* Incrustados: mismas reglas FIJAS que el servidor (blog-schema.ts). El servidor es quien decide al guardar/renderizar; esto solo da respuesta inmediata. */
export type Embed = { provider: string; id: string; embed: string; kind: 'video' | 'map' | 'tall' | 'audio'; custom?: boolean };
export const BUILTIN_EMBEDS = [
  { id: 'youtube', name: 'YouTube', example: 'https://www.youtube.com/watch?v=…' }, { id: 'vimeo', name: 'Vimeo', example: 'https://vimeo.com/123456789' },
  { id: 'loom', name: 'Loom', example: 'https://www.loom.com/share/…' }, { id: 'wistia', name: 'Wistia', example: 'https://empresa.wistia.com/medias/…' },
  { id: 'dailymotion', name: 'Dailymotion', example: 'https://www.dailymotion.com/video/…' }, { id: 'gmaps', name: 'Google Maps', example: 'https://www.google.com/maps/embed?pb=…' },
  { id: 'calendly', name: 'Calendly', example: 'https://calendly.com/usuario/reunion' }, { id: 'spotify', name: 'Spotify', example: 'https://open.spotify.com/episode/…' },
];
let extraHosts: string[] = [];
export const setEmbedHosts = (l: string[]) => { extraHosts = l.slice(); };
const hostAllowed = (h: string) => extraHosts.some(e => (e.startsWith('*.') ? h.endsWith(e.slice(1)) : h === e || h === 'www.' + e));
const seg1 = (s?: string) => !!s && s.length <= 80 && /^[A-Za-z0-9_.-]+$/.test(s);
export function parseVideo(raw: string): Embed | null {
  const u = raw.trim(); if (!u || u.length > 500 || /\s/.test(u)) return null;
  let p: URL; try { p = new URL(u); } catch { return null; }
  if (p.protocol !== 'https:' || p.username || p.password || (p.port && p.port !== '443')) return null;
  const host = p.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, ''); const seg = p.pathname.split('/').filter(Boolean);
  const mk = (provider: string, id: string, embed: string, kind: Embed['kind'] = 'video'): Embed => ({ provider, id, embed, kind });
  const yt = (id?: string) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? mk('youtube', id, `https://www.youtube-nocookie.com/embed/${id}`) : null);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') { if (seg[0] === 'watch') return yt(p.searchParams.get('v') ?? undefined); if (['embed', 'shorts', 'live', 'v'].includes(seg[0])) return yt(seg[1]); return null; }
  if (host === 'youtu.be') return yt(seg[0]);
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const id = host === 'player.vimeo.com' ? (seg[0] === 'video' ? seg[1] : undefined) : seg.find(s => /^\d+$/.test(s)); return id && /^\d{1,12}$/.test(id) ? mk('vimeo', id, `https://player.vimeo.com/video/${id}?dnt=1`) : null; }
  if (host === 'loom.com') { const id = seg[0] === 'share' || seg[0] === 'embed' ? seg[1] : undefined; return id && /^[a-f0-9]{32}$/.test(id) ? mk('loom', id, `https://www.loom.com/embed/${id}`) : null; }
  if (host === 'dailymotion.com' || host === 'dai.ly') { const id = host === 'dai.ly' ? seg[0] : seg[0] === 'video' ? seg[1] : seg[0] === 'embed' && seg[1] === 'video' ? seg[2] : undefined; return id && /^[a-z0-9]{5,12}$/.test(id) ? mk('dailymotion', id, `https://www.dailymotion.com/embed/video/${id}`) : null; }
  if (host.endsWith('.wistia.com') || host === 'wistia.com' || host.endsWith('.wistia.net') || host === 'wistia.net') { const id = seg[0] === 'medias' ? seg[1] : seg[0] === 'embed' && seg[1] === 'iframe' ? seg[2] : undefined; return id && /^[a-z0-9]{10}$/.test(id) ? mk('wistia', id, `https://fast.wistia.net/embed/iframe/${id}`) : null; }
  if ((host === 'google.com' || host === 'maps.google.com') && seg[0] === 'maps') {
    if (seg[1] === 'embed') { const pb = p.searchParams.get('pb'); return pb && pb.length <= 1800 && /^[A-Za-z0-9!%._:,;=+~*()/-]+$/.test(pb) ? mk('gmaps', 'pb', 'https://www.google.com/maps/embed', 'map') : null; }
    const qv = p.searchParams.get('q'); return qv && p.searchParams.get('output') === 'embed' && qv.length <= 200 && !seg[1] ? mk('gmaps', 'q', 'https://www.google.com/maps', 'map') : null;
  }
  if (host === 'calendly.com') return seg.length >= 1 && seg.length <= 2 && seg.every(s => seg1(s)) ? mk('calendly', seg.join('/'), `https://calendly.com/${seg.join('/')}`, 'tall') : null;
  if (host === 'open.spotify.com') { const k = seg[0] === 'embed' ? seg.slice(1) : seg; return ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(k[0]) && /^[A-Za-z0-9]{22}$/.test(k[1] ?? '') ? mk('spotify', k[1], `https://open.spotify.com/embed/${k[0]}/${k[1]}`, 'audio') : null; }
  if (hostAllowed(p.hostname.toLowerCase())) return { provider: 'custom', id: p.hostname.toLowerCase(), embed: `https://${p.hostname.toLowerCase()}${p.pathname}${p.search}`, kind: 'video', custom: true };
  return null;
}
export const isSafeImage = (u: string) => { const s = safeLink(u); return !!s && !s.startsWith('#') && !s.toLowerCase().startsWith('mailto:'); };

export const blockLabel: Record<BlockType, string> = { heading: 'Encabezado', paragraph: 'Párrafo', list: 'Lista', quote: 'Cita', image: 'Imagen', callout: 'Aviso', cta: 'Botón', divider: 'Separador', video: 'Video / incrustado', table: 'Tabla', faq: 'Preguntas frecuentes' };

export function makeBlock(type: BlockType, extra?: { level?: 2 | 3 | 4 }): Block {
  const id = uid();
  switch (type) {
    case 'heading': return { id, type, level: extra?.level ?? 2, text: '' };
    case 'paragraph': return { id, type, runs: [] };
    case 'list': return { id, type, ordered: false, items: [[], []] };
    case 'quote': return { id, type, runs: [], cite: '' };
    case 'image': return { id, type, src: '', alt: '', caption: '', align: 'center', width: 'large' };
    case 'callout': return { id, type, tone: 'tip', title: '', runs: [] };
    case 'cta': return { id, type, text: 'Pide tu cotización gratis', url: '', style: 'primary', note: '' };
    case 'divider': return { id, type };
    case 'video': return { id, type, url: '', caption: '' };
    case 'table': return { id, type, header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']], caption: '' };
    case 'faq': return { id, type, items: [{ q: '', a: [] }, { q: '', a: [] }] };
  }
}
export const cloneBlock = (b: Block): Block => ({ ...JSON.parse(JSON.stringify(b)), id: uid() });
/** Bloque vacío (sin contenido útil): se descarta al guardar para no ensuciar el artículo. */
export function isBlank(b: Block): boolean {
  switch (b.type) {
    case 'heading': return !b.text.trim();
    case 'paragraph': case 'quote': return !runsText(b.runs).trim();
    case 'callout': return !runsText(b.runs).trim() && !(b.title ?? '').trim();
    case 'list': return b.items.every(i => !runsText(i).trim());
    case 'image': return !b.src.trim();
    case 'cta': return !b.url.trim() && !b.text.trim();
    case 'video': return !b.url.trim();
    case 'table': return b.rows.every(r => r.every(c => !c.trim()));
    case 'faq': return b.items.every(i => !i.q.trim() && !runsText(i.a).trim());
    default: return false;
  }
}
/** Prepara el documento para enviarlo: quita bloques vacíos, tramos vacíos, ids repetidos y enlaces inválidos. */
export function cleanDoc(d: PostDoc, keepEmptyImages = false): PostDoc {
  const seen = new Set<string>();
  const cr = (rs: Runs): Runs => rs.filter(r => r.t !== '').map(r => { const o: Run = { t: r.t }; if (r.b) o.b = true; if (r.i) o.i = true; if (r.a && safeLink(r.a.href)) o.a = { href: r.a.href.trim(), ...(r.a.nofollow ? { nofollow: true } : {}), ...(r.a.blank ? { blank: true } : {}) }; return o; });
  const blocks: Block[] = [];
  for (const b0 of d.blocks) {
    if (isBlank(b0) && !(keepEmptyImages && b0.type === 'image')) continue;
    let b: Block = JSON.parse(JSON.stringify(b0)); if (seen.has(b.id)) b.id = uid(); seen.add(b.id);
    if (b.type === 'paragraph' || b.type === 'quote' || b.type === 'callout') { b.runs = cr(b.runs); delete b.hint; }
    if (b.type === 'list') b.items = b.items.map(cr).filter(i => i.length);
    if (b.type === 'faq') b.items = b.items.map(i => ({ q: i.q.trim(), a: cr(i.a) })).filter(i => i.q || i.a.length);
    if (b.type === 'heading') b = { ...b, text: b.text.trim() };
    if (b.type === 'cta') { const u = fixLink(b.url); b.url = safeLink(u) && !u.startsWith('#') ? u : ''; }
    if (b.type === 'video' && !parseVideo(b.url)) continue;
    if (!b.sample) delete b.sample; if (!b.w || b.w === 'normal') delete b.w;   // video no reconocible: no se envía (el bloque muestra el aviso)
    if (b.type === 'table') { const w = Math.max(...b.rows.map(r => r.length)); b.rows = b.rows.map(r => Array.from({ length: w }, (_, i) => r[i] ?? '')); }
    blocks.push(b);
  }
  return { ...d, theme: d.theme || 'nx', layout: { ...defaultLayout(), ...(d.layout ?? {}) }, title: d.title.trim(), blocks, tags: d.tags.map(t => t.trim()).filter(Boolean), categories: d.categories.map(t => t.trim()).filter(Boolean) };
}
