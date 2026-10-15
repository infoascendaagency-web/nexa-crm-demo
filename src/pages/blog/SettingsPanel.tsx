// Panel "Ajustes": publicación (estado y fecha), URL, extracto, imagen destacada, autor, categorías, etiquetas, canonical/noindex.
import { useRef, useState } from 'react';
import { Button, Field, Input, Select, Spinner, Switch, Textarea, cx, useToast } from '../../components/ui';
import Icon from '../../components/Icon';
import { OWNERS } from '../../lib/schema';
import { fmtDate, toLocalInput } from '../../lib/fmt';
import { BIcon } from './icons';
import { Meter, SITE_HOST } from './SeoPanel';
import { fixLink, isSafeImage, safeLink, type PostDoc, type Status } from './types';
import type { Media } from './BlockEditor';
import type { SlugCheck, Taxonomy, ThemeInfo } from './blogApi';
import DesignControls from './DesignControls';

export function TagInput({ label, value, onChange, suggestions, placeholder, max, hint, id }: { label: string; value: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string; max: number; hint?: string; id: string }) {
  const [t, setT] = useState('');
  const add = (raw: string) => { const next = [...value]; for (const part of raw.split(',')) { const x = part.trim(); if (x && x.length <= 60 && next.length < max && !next.some(v => v.toLowerCase() === x.toLowerCase())) next.push(x); } if (next.length !== value.length) onChange(next); setT(''); };
  return <div className="mb-3"><label htmlFor={id} className="mb-1 block text-[12.5px] font-semibold text-slate">{label}</label>
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-line-2 bg-white p-1.5 focus-within:border-link focus-within:ring-2 focus-within:ring-link/25">
      {value.map(v => <span key={v} className="inline-flex items-center gap-1 rounded-md bg-sky px-2 py-0.5 text-[12.5px] font-medium text-navy">{v}<button type="button" aria-label={`Quitar ${v}`} onClick={() => onChange(value.filter(x => x !== v))} className="cursor-pointer rounded text-slate hover:text-bad"><Icon n="x" s={12} /></button></span>)}
      <input id={id} list={`${id}-dl`} value={t} onChange={e => { const v = e.target.value; if (v.includes(',')) add(v); else setT(v); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(t); } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)); }} onBlur={() => t && add(t)} placeholder={value.length >= max ? `Máximo ${max}` : placeholder} disabled={value.length >= max} className="min-w-[100px] flex-1 bg-transparent px-1.5 py-0.5 text-sm outline-none placeholder:text-mute" />
      <datalist id={`${id}-dl`}>{suggestions.filter(s => !value.some(v => v.toLowerCase() === s.toLowerCase())).slice(0, 30).map(s => <option key={s} value={s} />)}</datalist></div>
    {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}</div>;
}

function Featured({ doc, onChange, media }: { doc: PostDoc; onChange: (f: PostDoc['featuredImage']) => void; media: Media }) {
  const toast = useToast(); const f = doc.featuredImage; const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const ref = useRef<HTMLInputElement>(null);
  const up = async (file?: File) => { if (!file) return; if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return toast('Usa JPG, PNG, WebP, GIF o AVIF.', 'err'); if (file.size > 8 * 1024 * 1024) return toast('Máximo 8 MB.', 'err'); setBusy(true); try { const src = await media.upload(file); onChange({ src, alt: f?.alt ?? '' }); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); } };
  const useUrl = () => { const u = fixLink(url); if (!isSafeImage(u)) return toast('La dirección debe empezar por https://', 'err'); onChange({ src: u, alt: f?.alt ?? '' }); setUrl(''); };
  return <div className="mb-3"><span className="mb-1 block text-[12.5px] font-semibold text-slate">Imagen destacada</span>
    {f?.src ? <div><img src={f.src} alt={f.alt} className="aspect-[1.91/1] w-full rounded-lg border border-line object-cover" />
      <label className="mt-2 block"><span className={cx('mb-1 block text-[12.5px] font-semibold', f.alt.trim() ? 'text-slate' : 'text-bad')}>Texto alternativo (obligatorio)</span><Input value={f.alt} onChange={e => onChange({ ...f, alt: e.target.value })} aria-invalid={!f.alt.trim()} placeholder="Describe lo que se ve en la imagen" maxLength={300} />{!f.alt.trim() && <span role="alert" className="mt-1 block text-[12px] text-bad">Sin texto alternativo no podrás publicar.</span>}</label>
      <Button size="sm" variant="ghost" className="mt-1" onClick={() => onChange(null)}>Quitar imagen</Button></div>
      : <div className="rounded-lg border border-dashed border-line-2 bg-canvas/60 p-3">
        <div className="flex flex-wrap items-center gap-2"><Button size="sm" icon="download" disabled={media.status === 'unconfigured' || busy} onClick={() => ref.current?.click()}>{busy ? 'Subiendo…' : 'Subir imagen'}</Button>{busy && <Spinner />}<input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" aria-label="Elegir imagen destacada" onChange={e => { void up(e.target.files?.[0]); e.target.value = ''; }} /></div>
        {media.status === 'unconfigured' && <p className="mt-2 text-[12px] text-[#8A5A0B]">La subida no está activada en este entorno: pega una dirección https://.</p>}
        <div className="mt-2 flex gap-1.5"><Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useUrl(); } }} placeholder="https://… (dirección de la imagen)" aria-label="Dirección de la imagen destacada" /><Button size="sm" disabled={!url.trim()} onClick={useUrl}>Usar</Button></div>
        <p className="mt-1.5 text-[12px] text-mute">Aparece en el listado del blog y al compartir. Ideal 1200×630.</p></div>}
  </div>;
}

const STATUS: { id: Status; name: string; d: string; icon: string }[] = [
  { id: 'draft', name: 'Borrador', d: 'Solo lo ve tu equipo.', icon: 'note' },
  { id: 'scheduled', name: 'Programado', d: 'Se publica solo en la fecha elegida.', icon: 'clock' },
  { id: 'published', name: 'Publicado', d: 'Visible en la web.', icon: 'globe' },
];
export default function SettingsPanel({ themes, doc, set, slug, onSlug, slugState, minutes, tax, media, onStatus }: { themes: ThemeInfo[]; doc: PostDoc; set: (p: Partial<PostDoc>) => void; slug: string; onSlug: (s: string) => void; slugState: (SlugCheck & { checking?: boolean }) | null; minutes: number; tax: Taxonomy | null; media: Media; onStatus: (s: Status) => void }) {
  const authors = [...new Set([...OWNERS.map(o => `${o.firstName} ${o.lastName}`.trim()), ...(tax?.authors ?? [])])].filter(Boolean);
  const canonBad = doc.seo.canonical && !(safeLink(doc.seo.canonical) ?? '').startsWith('https://');
  return <div>
    <DesignControls doc={doc} themes={themes} onPatch={set} />
    <fieldset className="mb-4"><legend className="mb-1.5 text-[12.5px] font-semibold text-slate">Publicación</legend>
      <div role="radiogroup" aria-label="Estado del artículo" className="space-y-1.5">{STATUS.map(s => <label key={s.id} className={cx('flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2', doc.status === s.id ? 'border-navy bg-sky/60' : 'border-line bg-white hover:bg-sky/30')}>
        <input type="radio" name="post-status" className="mt-1 accent-navy" checked={doc.status === s.id} onChange={() => onStatus(s.id)} /><span><span className="block text-[13px] font-semibold text-navy">{s.name}</span><span className="block text-[12px] text-slate">{s.d}</span></span></label>)}</div>
      {doc.status !== 'draft' && <label className="mt-2 block"><span className="mb-1 block text-[12.5px] font-semibold text-slate">{doc.status === 'scheduled' ? 'Fecha y hora de publicación' : 'Fecha de publicación'}</span>
        <input type="datetime-local" value={toLocalInput(doc.publishedAt)} onChange={e => set({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-9 w-full rounded-lg border border-line-2 bg-white px-3 text-sm focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" aria-label="Fecha de publicación" />
        {doc.status === 'published' && !doc.publishedAt && <span className="mt-1 block text-xs text-mute">Si la dejas vacía se publica ahora.</span>}{doc.publishedAt && <span className="mt-1 block text-xs text-mute">{fmtDate(doc.publishedAt)}</span>}</label>}
    </fieldset>

    <Field label="Dirección del artículo (slug)"><div className="flex items-center rounded-lg border border-line-2 bg-white focus-within:border-link focus-within:ring-2 focus-within:ring-link/25"><span className="shrink-0 pl-3 text-[12.5px] text-mute">/blog/</span><input value={slug} onChange={e => onSlug(e.target.value)} maxLength={120} aria-label="Slug" aria-describedby="slug-state" className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" /></div>
      <span id="slug-state" role="status" className="mt-1 block text-xs">{!slug ? <span className="text-mute">Se crea sola a partir del título.</span> : slugState?.checking ? <span className="text-mute">Comprobando…</span> : slugState && !slugState.valid ? <span className="text-bad">Usa solo minúsculas, números y guiones.</span> : slugState && !slugState.available ? <span className="text-bad">Ya existe un artículo con esta dirección.{slugState.suggestion && <> <button type="button" className="cursor-pointer font-semibold underline" onClick={() => onSlug(slugState.suggestion!)}>Usar «{slugState.suggestion}»</button></>}</span> : slugState ? <span className="text-good">Disponible · {SITE_HOST}/blog/{slug}</span> : null}</span></Field>

    <Field label="Extracto" hint="1–2 frases para el listado del blog y como descripción si no escribes una SEO."><Textarea rows={3} value={doc.excerpt} onChange={e => set({ excerpt: e.target.value })} maxLength={500} /><Meter n={doc.excerpt.length} max={160} /></Field>
    <Featured doc={doc} onChange={f => set({ featuredImage: f })} media={media} />

    <Field label="Autor"><Input list="blog-authors" value={doc.author} onChange={e => { const v = e.target.value; const o = OWNERS.find(x => `${x.firstName} ${x.lastName}`.trim() === v); set({ author: v, authorUserId: o?.id ?? null }); }} placeholder="Elige alguien del equipo o escribe un nombre" maxLength={200} /><datalist id="blog-authors">{authors.map(a => <option key={a} value={a} />)}</datalist></Field>
    <TagInput id="cats" label="Categorías" value={doc.categories} onChange={v => set({ categories: v })} suggestions={(tax?.categories ?? []).map(c => c.name)} placeholder="Escribe y pulsa Enter" max={10} hint="Temas grandes (ej. Techos, Ventanas). Máx. 10." />
    <TagInput id="tags" label="Etiquetas" value={doc.tags} onChange={v => set({ tags: v })} suggestions={(tax?.tags ?? []).map(c => c.name)} placeholder="Escribe y pulsa Enter" max={20} hint="Detalles concretos (ej. tejas, huracanes). Máx. 20." />

    <div className="mb-3 rounded-lg bg-canvas px-3 py-2 text-[12.5px] text-slate"><BIcon n="clock" s={14} className="mr-1 inline" />Tiempo de lectura: <strong className="text-navy">{minutes} min</strong> (se calcula solo)</div>

    <details className="rounded-lg border border-line px-3 py-2"><summary className="cursor-pointer text-[13px] font-semibold text-navy">Opciones avanzadas</summary>
      <div className="pt-3"><Field label="URL canónica (opcional)" hint="Solo si este texto ya existe en otra dirección. Debe empezar por https://."><Input value={doc.seo.canonical} onChange={e => set({ seo: { ...doc.seo, canonical: e.target.value } })} placeholder="https://…" aria-invalid={!!canonBad} />{canonBad && <span role="alert" className="mt-1 block text-xs text-bad">Debe empezar por https://</span>}</Field>
        <div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-semibold text-navy">Ocultar a buscadores (noindex)</p><p className="text-xs text-slate">Google no lo mostrará ni aparecerá en el mapa del sitio.</p></div><Switch on={doc.seo.noindex} onChange={v => set({ seo: { ...doc.seo, noindex: v } })} label="Ocultar a buscadores" /></div></div></details>
  </div>;
}
export { Select };
