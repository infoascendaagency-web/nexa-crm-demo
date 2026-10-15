// Panel SEO: meta title/description con contador, palabra clave, vista previa en Google y en redes, checklist con puntuación.
import { useState } from 'react';
import { Field, Input, Textarea, cx } from '../../components/ui';
import { BIcon } from './icons';
import { scoreTone, type Analysis } from './analysis';
import { isSafeImage, type PostDoc, type Seo } from './types';

export function Meter({ n, max, warnAt }: { n: number; max: number; warnAt?: number }) {
  const pct = Math.min(100, (n / max) * 100); const over = n > max; const low = warnAt ? n > 0 && n < warnAt : false;
  return <div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true"><div className={cx('h-full rounded-full', over ? 'bg-bad' : low ? 'bg-[#B7791F]' : n ? 'bg-good' : 'bg-line-2')} style={{ width: pct + '%' }} /></div><span className={cx('tabular w-14 text-right text-[11.5px]', over ? 'font-bold text-bad' : 'text-mute')}>{n}/{max}</span></div>;
}
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
export const SITE_HOST = 'nexahome.example';

export function ScoreRing({ score }: { score: number }) {
  const t = scoreTone(score); const col = t === 'good' ? '#00875A' : t === 'warn' ? '#B7791F' : '#C0392B'; const r = 26, c = 2 * Math.PI * r;
  return <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center" role="img" aria-label={`Puntuación SEO ${score} de 100`}><svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90"><circle cx="34" cy="34" r={r} fill="none" stroke="#DAE3EC" strokeWidth="6" /><circle cx="34" cy="34" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .4s var(--ease-out)' }} /></svg><span className="tabular absolute font-display text-[18px] font-bold" style={{ color: col }}>{score}</span></div>;
}

export default function SeoPanel({ doc, an, onSeo, ogFallbackImage }: { doc: PostDoc; an: Analysis; onSeo: (p: Partial<Seo>) => void; ogFallbackImage: string }) {
  const [dev, setDev] = useState<'d' | 'm'>('d'); const [og, setOg] = useState(false);
  const seo = doc.seo; const mt = seo.title || doc.title; const md = seo.description || doc.excerpt;
  const verdict = an.score >= 80 ? 'Muy bien optimizado' : an.score >= 55 ? 'Aceptable, se puede mejorar' : 'Necesita trabajo';
  const ogImg = [seo.ogImage, ogFallbackImage].find(u => u && isSafeImage(u)) ?? '';
  const icon = (s: string) => (s === 'ok' ? <BIcon n="check" s={14} className="text-good" /> : s === 'na' ? <span className="text-mute">–</span> : <BIcon n="alert" s={14} className={s === 'bad' ? 'text-bad' : 'text-[#B7791F]'} />);
  return <div className="space-y-5">
    <div className="flex items-center gap-3"><ScoreRing score={an.score} /><div><p className="font-display text-[16px] font-bold text-navy">{verdict}</p><p className="text-[12.5px] text-slate">{an.words} palabras · {an.minutes} min de lectura · {an.internal} enlace(s) interno(s) · {an.external} externo(s)</p></div></div>

    <div>
      <Field label="Palabra clave principal" hint="La búsqueda que quieres ganar. Una sola, en lenguaje natural."><Input value={seo.keyword} onChange={e => onSeo({ keyword: e.target.value })} placeholder="Ej. cuánto cuesta un techo nuevo" maxLength={100} /></Field>
      <Field label="Título SEO (meta title)"><Input value={seo.title} onChange={e => onSeo({ title: e.target.value })} placeholder={doc.title || 'Si lo dejas vacío se usa el título del artículo'} maxLength={200} aria-describedby="mt-meter" /><span id="mt-meter"><Meter n={mt.length} max={60} warnAt={30} /></span></Field>
      <Field label="Descripción SEO (meta description)"><Textarea rows={3} value={seo.description} onChange={e => onSeo({ description: e.target.value })} placeholder={doc.excerpt || 'Resume la promesa del artículo en 1–2 frases (si está vacía se usa el extracto)'} maxLength={400} aria-describedby="md-meter" /><span id="md-meter"><Meter n={md.length} max={160} warnAt={100} /></span></Field>
    </div>

    <section aria-labelledby="serp">
      <div className="mb-2 flex items-center justify-between"><h3 id="serp" className="text-[12px] font-bold uppercase tracking-wide text-mute">Así se verá en Google</h3>
        <div role="radiogroup" aria-label="Dispositivo de la vista previa de Google" className="inline-flex overflow-hidden rounded-lg border border-line-2">{([['d', 'desktop', 'Escritorio'], ['m', 'mobile', 'Móvil']] as const).map(([id, ic, l]) => <button key={id} type="button" role="radio" aria-checked={dev === id} aria-label={l} title={l} onClick={() => setDev(id)} className={cx('grid h-7 w-8 cursor-pointer place-items-center', dev === id ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}><BIcon n={ic} s={15} /></button>)}</div></div>
      <div className={cx('rounded-xl border border-line bg-white p-3.5', dev === 'm' ? 'max-w-[360px]' : '')} style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="mb-1 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-[11px] font-bold text-navy">H</span><div className="min-w-0"><p className="truncate text-[13px] leading-tight text-[#202124]">Nexa Home</p><p className="truncate text-[12px] leading-tight text-[#4d5156]">https://{SITE_HOST} › blog › {doc.slug || 'tu-articulo'}</p></div></div>
        <p className="text-[19px] leading-[1.25] text-[#1a0dab]" style={{ fontSize: dev === 'm' ? 18 : 20 }}>{trunc(mt || 'Título del artículo', 60)}</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-[#4d5156]">{trunc(md || 'Aquí aparecerá la descripción que escribas. Si no escribes ninguna, Google elige un fragmento del texto.', dev === 'm' ? 120 : 160)}</p>
      </div>
      {mt.length > 60 && <p className="mt-1 text-[12px] text-[#8A5A0B]">El título pasa de 60 caracteres: Google lo corta con «…».</p>}
    </section>

    <section aria-labelledby="og">
      <div className="mb-2 flex items-center justify-between"><h3 id="og" className="text-[12px] font-bold uppercase tracking-wide text-mute">Al compartir en redes</h3><button type="button" aria-expanded={og} onClick={() => setOg(!og)} className="cursor-pointer text-[12.5px] font-semibold text-link hover:underline">{og ? 'Ocultar ajustes' : 'Personalizar'}</button></div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="grid aspect-[1.91/1] place-items-center bg-canvas text-mute">{ogImg ? <img src={ogImg} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-[12.5px]"><BIcon n="image" s={26} />Sin imagen: sube una destacada</span>}</div>
        <div className="border-t border-line bg-[#F2F3F5] px-3 py-2"><p className="text-[11px] uppercase text-[#65676B]">{SITE_HOST}</p><p className="truncate text-[14.5px] font-bold text-[#050505]">{seo.ogTitle || mt || 'Título del artículo'}</p><p className="line-clamp-2 text-[13px] text-[#65676B]">{seo.ogDescription || md || 'Descripción'}</p></div></div>
      {og && <div className="mt-3"><Field label="Título para redes (opcional)"><Input value={seo.ogTitle} onChange={e => onSeo({ ogTitle: e.target.value })} maxLength={200} placeholder="Si está vacío se usa el título SEO" /></Field><Field label="Descripción para redes (opcional)"><Textarea rows={2} value={seo.ogDescription} onChange={e => onSeo({ ogDescription: e.target.value })} maxLength={400} /></Field><Field label="Imagen para redes (https://, opcional)" hint="Mejor 1200×630. Si está vacía se usa la imagen destacada."><Input value={seo.ogImage} onChange={e => onSeo({ ogImage: e.target.value })} placeholder="https://…" /></Field></div>}
    </section>

    <section aria-labelledby="chk">
      <h3 id="chk" className="mb-2 text-[12px] font-bold uppercase tracking-wide text-mute">Lista de comprobación</h3>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">{an.checks.map(c => <li key={c.id} className="flex items-start gap-2.5 px-3 py-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">{icon(c.status)}</span><div className="min-w-0"><p className={cx('text-[13px] font-semibold', c.status === 'na' ? 'text-mute' : 'text-navy')}>{c.label}<span className="sr-only"> — {c.status === 'ok' ? 'correcto' : c.status === 'na' ? 'no aplica todavía' : c.status === 'warn' ? 'mejorable' : 'falla'}</span></p><p className="text-[12.5px] leading-snug text-slate">{c.detail}</p></div></li>)}</ul>
    </section>
  </div>;
}
