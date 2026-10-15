// Análisis en vivo del artículo: esquema de encabezados (H1–H4), comprobaciones SEO y puntuación. Funciones puras (sin React).
import { fixLink, parseVideo, runsText, safeLink, type Block, type PostDoc, type Runs } from './types';

export const words = (s: string) => { let n = 0, w = false; for (let i = 0; i < s.length; i++) { const sp = s.charCodeAt(i) <= 32; if (!sp && !w) { n++; w = true; } else if (sp) w = false; } return n; };
export function blockPlain(b: Block): string {
  switch (b.type) {
    case 'heading': return b.text;
    case 'paragraph': case 'quote': return runsText(b.runs);
    case 'callout': return `${b.title ?? ''} ${runsText(b.runs)}`;
    case 'list': return b.items.map(runsText).join(' ');
    case 'table': return b.rows.map(r => r.join(' ')).join(' ');
    case 'faq': return b.items.map(i => `${i.q} ${runsText(i.a)}`).join(' ');
    default: return '';
  }
}
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
const has = (hay: string, kw: string) => !!kw && (' ' + norm(hay) + ' ').includes(' ' + norm(kw) + ' ');

export type Sev = 'error' | 'warn' | 'info';
export type Issue = { id: string; sev: Sev; blockId?: string; title: string; detail: string };
export type OutlineItem = { blockId: string; level: 2 | 3 | 4; text: string; words: number; issues: Issue[] };

const linkStats = (runsList: Runs[]) => { let internal = 0, external = 0; for (const rs of runsList) for (const r of rs) if (r.a) { const h = safeLink(r.a.href); if (!h) continue; if (h.startsWith('/') || /^https:\/\/([\w-]+\.)*nexahome\.com(\/|$)/i.test(h)) internal++; else if (h.startsWith('https://')) external++; } return { internal, external }; };

export function outlineOf(doc: PostDoc): { items: OutlineItem[]; issues: Issue[]; introWords: number } {
  const items: OutlineItem[] = []; const issues: Issue[] = [];
  const add = (it: Issue, item?: OutlineItem) => { issues.push(it); item?.issues.push(it); };
  let cur: OutlineItem | null = null; let introWords = 0; let prev = 1;
  const seen = new Map<string, string>();
  for (const b of doc.blocks) {
    if (b.type === 'heading') {
      const it: OutlineItem = { blockId: b.id, level: b.level, text: b.text, words: 0, issues: [] }; items.push(it); cur = it;
      if (!b.text.trim()) add({ id: `empty-${b.id}`, sev: 'error', blockId: b.id, title: `H${b.level} vacío`, detail: 'Escribe el texto del encabezado o elimina el bloque.' }, it);
      if (b.level > prev + 1) {
        const first = items.length === 1;
        add({ id: `skip-${b.id}`, sev: 'error', blockId: b.id, title: first ? `El primer encabezado es un H${b.level}` : `Saltas de H${prev} a H${b.level}`, detail: first ? 'Después del título (H1) lo normal es un H2. Cambia el nivel a H2.' : `No te saltes niveles: entre un H${prev} y un H${b.level} falta un H${prev + 1}. Cambia este a H${prev + 1}.` }, it);
      }
      const len = b.text.trim().length;
      if (b.level === 2 && len > 70) add({ id: `long-${b.id}`, sev: 'warn', blockId: b.id, title: `H2 demasiado largo (${len} caracteres)`, detail: 'Los subtítulos funcionan mejor cortos: idealmente menos de 70 caracteres.' }, it);
      else if (b.level > 2 && len > 90) add({ id: `long-${b.id}`, sev: 'warn', blockId: b.id, title: `H${b.level} demasiado largo (${len} caracteres)`, detail: 'Acórtalo: un detalle se entiende de un vistazo.' }, it);
      const k = norm(b.text); if (k) { if (seen.has(k)) add({ id: `dup-${b.id}`, sev: 'warn', blockId: b.id, title: 'Encabezado repetido', detail: 'Hay otro encabezado igual. Cada sección debe tener un título distinto.' }, it); else seen.set(k, b.id); }
      prev = b.level;
    } else {
      if (b.type === 'image' && b.src && !b.alt.trim()) add({ id: `alt-${b.id}`, sev: 'error', blockId: b.id, title: 'Imagen sin texto alternativo', detail: 'Describe la imagen: es obligatorio para publicar (accesibilidad y SEO).' });
      if (b.type === 'cta' && !safeLink(fixLink(b.url))) add({ id: `cta-${b.id}`, sev: 'error', blockId: b.id, title: 'Botón sin enlace válido', detail: 'Sin una dirección https:// o /ruta el botón no se publica.' });
      if (b.type === 'video' && b.url.trim() && !parseVideo(b.url)) add({ id: `vid-${b.id}`, sev: 'error', blockId: b.id, title: 'Video no reconocido', detail: 'Pega la dirección completa de YouTube o Vimeo; si no, el video no se publica.' });
      const w = words(blockPlain(b)); if (cur) cur.words += w; else introWords += w;
    }
  }
  const h2 = items.filter(i => i.level === 2);
  const total = items.reduce((n, i) => n + i.words, 0) + introWords;
  if (!doc.title.trim()) issues.unshift({ id: 'no-h1', sev: doc.blocks.length ? 'error' : 'warn', title: 'Falta el título (H1)', detail: 'El título del artículo es el único H1. Escríbelo arriba.' });
  else if (doc.title.trim().length > 70) issues.unshift({ id: 'h1-long', sev: 'warn', title: `Título largo (${doc.title.trim().length} caracteres)`, detail: 'Google suele cortar a ~60 caracteres. Pon lo importante al principio.' });
  if (h2.length < 2 && total > 120) issues.push({ id: 'few-h2', sev: 'warn', title: h2.length === 0 ? 'No hay ningún H2' : 'Solo hay 1 H2', detail: 'Divide el artículo en al menos 2 secciones principales (lo ideal son 3 a 6).' });
  if (h2.length > 10) issues.push({ id: 'many-h2', sev: 'info', title: `${h2.length} secciones principales`, detail: 'Son muchas. Agrupa ideas parecidas o conviértelas en H3.' });
  // secciones largas sin subtítulo (palabras directamente bajo un encabezado, hasta el siguiente de cualquier nivel)
  items.forEach((it, i) => { if (it.words > 300) { const next = items[i + 1]; const a: Issue = { id: `sec-${it.blockId}`, sev: 'warn', blockId: it.blockId, title: `Sección larga: ${it.words} palabras sin subtítulo`, detail: `Debajo de «${it.text || 'este encabezado'}» hay un bloque muy largo${next && next.level > it.level ? '' : ''}. Añade un ${it.level < 4 ? `H${it.level + 1}` : 'párrafo corto'} para partirlo.` }; issues.push(a); it.issues.push(a); } });
  if (introWords > 250) issues.push({ id: 'intro-long', sev: 'warn', title: `Introducción larga (${introWords} palabras)`, detail: 'Antes del primer H2 lo ideal es un párrafo corto que prometa lo que vas a resolver.' });
  const kw = doc.seo.keyword.trim();
  if (kw && h2.length && !h2.some(h => has(h.text, kw))) issues.push({ id: 'kw-h2', sev: 'info', title: 'La palabra clave no aparece en ningún H2', detail: `Intenta incluir «${kw}» (o una variante natural) en al menos un subtítulo.` });
  return { items, issues, introWords };
}

export type CheckStatus = 'ok' | 'warn' | 'bad' | 'na';
export type Check = { id: string; label: string; status: CheckStatus; detail: string; weight: number };
export type Analysis = {
  outline: OutlineItem[]; issues: Issue[]; checks: Check[]; score: number; words: number; minutes: number;
  internal: number; external: number; images: number; imagesNoAlt: number; headingErrors: number;
};

export function analyze(doc: PostDoc): Analysis {
  const o = outlineOf(doc);
  const kw = doc.seo.keyword.trim(); const metaTitle = (doc.seo.title || doc.title).trim(); const metaDesc = (doc.seo.description || doc.excerpt).trim();
  const wordsTotal = doc.blocks.reduce((n, b) => n + words(blockPlain(b)), 0);
  const imgs = doc.blocks.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image' && !!b.src);
  const imagesNoAlt = imgs.filter(i => !i.alt.trim()).length + (doc.featuredImage?.src && !doc.featuredImage.alt.trim() ? 1 : 0);
  const rl: Runs[] = []; for (const b of doc.blocks) { if (b.type === 'paragraph' || b.type === 'quote' || b.type === 'callout') rl.push(b.runs); else if (b.type === 'list') rl.push(...b.items); else if (b.type === 'faq') rl.push(...b.items.map(i => i.a)); }
  const ls = linkStats(rl); const ctaLinks = doc.blocks.filter(b => b.type === 'cta' && b.url);
  const firstP = doc.blocks.find(b => b.type === 'paragraph' && runsText(b.runs).trim());
  const firstText = firstP && firstP.type === 'paragraph' ? runsText(firstP.runs).split(/\s+/).slice(0, 100).join(' ') : '';
  const headingErrors = o.issues.filter(i => i.sev === 'error' && !/^(alt|cta|vid)-/.test(i.id)).length;
  const c: Check[] = [];
  const range = (id: string, label: string, text: string, lo: number, hi: number, weight: number, what: string, tip: string) => {
    const n = text.length;
    c.push(!n ? { id, label, status: 'bad', detail: `Vacío. ${tip}`, weight } : n < lo ? { id, label, status: 'warn', detail: `${n} caracteres: corto (ideal ${lo}–${hi}). ${tip}`, weight } : n > hi ? { id, label, status: 'warn', detail: `${n} caracteres: Google lo cortará (ideal ${lo}–${hi}).`, weight } : { id, label, status: 'ok', detail: `${n} caracteres: ${what}.`, weight });
  };
  range('mtitle', 'Título SEO (meta title)', metaTitle, 30, 60, 10, 'buena longitud', 'Escribe un título claro con la palabra clave.');
  range('mdesc', 'Descripción SEO (meta description)', metaDesc, 100, 160, 10, 'buena longitud', 'Resume la promesa del artículo en 1–2 frases.');
  const kwc = (id: string, label: string, ok: boolean, weight: number, okTxt: string, badTxt: string, status: CheckStatus = 'bad') => c.push(!kw ? { id, label, status: 'na', detail: 'Define una palabra clave principal para evaluar esto.', weight } : ok ? { id, label, status: 'ok', detail: okTxt, weight } : { id, label, status, detail: badTxt, weight });
  c.push(kw ? { id: 'kw', label: 'Palabra clave principal', status: 'ok', detail: `«${kw}»`, weight: 2 } : { id: 'kw', label: 'Palabra clave principal', status: 'warn', detail: 'Elige la búsqueda que quieres ganar (ej. «cuánto cuesta un techo nuevo»). Sin ella no se pueden comprobar los siguientes puntos.', weight: 2 });
  kwc('kw-h1', 'Palabra clave en el título (H1)', has(doc.title, kw), 10, 'El título la incluye.', 'Inclúyela en el título, mejor al principio.');
  kwc('kw-mt', 'Palabra clave en el título SEO', has(metaTitle, kw), 4, 'Está en el título SEO.', 'Inclúyela en el título SEO.', 'warn');
  kwc('kw-md', 'Palabra clave en la descripción SEO', has(metaDesc, kw), 4, 'Está en la descripción.', 'Menciónala de forma natural en la descripción.', 'warn');
  kwc('kw-p1', 'Palabra clave en el primer párrafo', has(firstText, kw), 8, 'Aparece al comienzo del texto.', 'Menciónala en las primeras 100 palabras.');
  kwc('kw-slug', 'Palabra clave en la URL (slug)', has(doc.slug.replace(/-/g, ' '), kw), 6, 'La URL la contiene.', 'Incluye la palabra clave en el slug.', 'warn');
  kwc('kw-alt', 'Palabra clave en el texto alternativo de una imagen', imgs.some(i => has(i.alt, kw)) || has(doc.featuredImage?.alt ?? '', kw), 4, 'Hay una imagen con la palabra clave en su alt.', imgs.length ? 'Describe una imagen usando la palabra clave (sin forzarla).' : 'Añade una imagen y descríbela con la palabra clave.', 'warn');
  c.push(wordsTotal >= 800 ? { id: 'words', label: 'Extensión', status: 'ok', detail: `${wordsTotal} palabras: artículo completo.`, weight: 10 } : wordsTotal >= 400 ? { id: 'words', label: 'Extensión', status: 'ok', detail: `${wordsTotal} palabras: suficiente. Más de 800 suele posicionar mejor temas competidos.`, weight: 10 } : wordsTotal >= 250 ? { id: 'words', label: 'Extensión', status: 'warn', detail: `${wordsTotal} palabras: algo corto. Apunta a 400 o más.`, weight: 10 } : { id: 'words', label: 'Extensión', status: 'bad', detail: `${wordsTotal} palabras: muy corto para posicionar. Apunta a 400 o más.`, weight: 10 });
  c.push(headingErrors ? { id: 'struct', label: 'Estructura de encabezados', status: 'bad', detail: `${headingErrors} error(es) en el esquema (mira la pestaña Esquema).`, weight: 8 } : o.issues.some(i => i.sev === 'warn') ? { id: 'struct', label: 'Estructura de encabezados', status: 'warn', detail: 'Hay avisos en el esquema que puedes mejorar.', weight: 8 } : { id: 'struct', label: 'Estructura de encabezados', status: doc.blocks.some(b => b.type === 'heading') ? 'ok' : 'warn', detail: doc.blocks.some(b => b.type === 'heading') ? 'Niveles ordenados y sin saltos.' : 'Aún no hay subtítulos.', weight: 8 });
  c.push(ls.internal ? { id: 'int', label: 'Enlaces internos', status: 'ok', detail: `${ls.internal} enlace(s) a otras páginas nuestras.`, weight: 5 } : ctaLinks.length ? { id: 'int', label: 'Enlaces internos', status: 'warn', detail: 'Solo tienes el botón. Enlaza a otro artículo o servicio nuestro dentro del texto.', weight: 5 } : { id: 'int', label: 'Enlaces internos', status: 'warn', detail: 'Enlaza al menos a 1 página nuestra (otro artículo o un servicio).', weight: 5 });
  c.push(ls.external ? { id: 'ext', label: 'Enlaces externos', status: 'ok', detail: `${ls.external} enlace(s) a fuentes externas.`, weight: 3 } : { id: 'ext', label: 'Enlaces externos', status: 'warn', detail: 'Citar una fuente fiable (normativa, fabricante) da confianza.', weight: 3 });
  c.push(imgs.length ? { id: 'img', label: 'Imágenes en el texto', status: 'ok', detail: `${imgs.length} imagen(es).`, weight: 4 } : { id: 'img', label: 'Imágenes en el texto', status: 'warn', detail: 'Añade al menos una imagen que aclare algo.', weight: 4 });
  c.push(imagesNoAlt ? { id: 'alt', label: 'Imágenes con texto alternativo', status: 'bad', detail: `${imagesNoAlt} imagen(es) sin alt. Es obligatorio para publicar (accesibilidad y SEO).`, weight: 8 } : { id: 'alt', label: 'Imágenes con texto alternativo', status: imgs.length || doc.featuredImage ? 'ok' : 'na', detail: imgs.length || doc.featuredImage ? 'Todas las imágenes tienen alt.' : 'Sin imágenes todavía.', weight: 8 });
  c.push(doc.featuredImage?.src ? { id: 'feat', label: 'Imagen destacada', status: doc.featuredImage.alt.trim() ? 'ok' : 'bad', detail: doc.featuredImage.alt.trim() ? 'Configurada con alt.' : 'Falta su texto alternativo.', weight: 5 } : { id: 'feat', label: 'Imagen destacada', status: 'warn', detail: 'Se usa en el listado y al compartir en redes.', weight: 5 });
  c.push(doc.slug && doc.slug.length <= 75 ? { id: 'slug', label: 'URL corta y clara', status: 'ok', detail: `/${doc.slug}`, weight: 3 } : { id: 'slug', label: 'URL corta y clara', status: 'warn', detail: doc.slug ? `${doc.slug.length} caracteres: acórtala (máx. ~75).` : 'Aún no hay slug.', weight: 3 });
  c.push(doc.excerpt.trim() ? { id: 'exc', label: 'Extracto', status: 'ok', detail: 'Se muestra en el listado del blog.', weight: 3 } : { id: 'exc', label: 'Extracto', status: 'warn', detail: 'Escribe 1–2 frases para el listado del blog.', weight: 3 });
  const app = c.filter(x => x.status !== 'na'); const tot = app.reduce((n, x) => n + x.weight, 0);
  const got = app.reduce((n, x) => n + (x.status === 'ok' ? x.weight : x.status === 'warn' ? x.weight * 0.5 : 0), 0);
  return { outline: o.items, issues: o.issues, checks: c, score: tot ? Math.round((got / tot) * 100) : 0, words: wordsTotal, minutes: Math.max(1, Math.ceil(wordsTotal / 200)), internal: ls.internal, external: ls.external, images: imgs.length, imagesNoAlt, headingErrors };
}
export const scoreTone = (s: number) => (s >= 80 ? 'good' : s >= 55 ? 'warn' : 'bad');
