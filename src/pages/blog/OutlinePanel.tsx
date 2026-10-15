// Panel "Esquema": árbol H1–H4 en vivo, comprobaciones, guía de "qué poner en cada H" y plantillas.
import { useState } from 'react';
import { Button, cx } from '../../components/ui';
import { BIcon } from './icons';
import type { Analysis } from './analysis';
import { TEMPLATES, type Template } from './templates';
import type { PostDoc } from './types';

const IND: Record<number, string> = { 2: 'pl-0', 3: 'pl-4', 4: 'pl-8' };
const LVL: Record<number, string> = { 2: 'bg-navy text-white', 3: 'bg-[#2F6FED]/15 text-[#1F4FB8]', 4: 'bg-sky text-slate' };

export function HeadingGuide({ compact }: { compact?: boolean }) {
  const rows = [
    { l: 'H1', t: 'El título del artículo', d: 'Solo uno (ya lo tienes arriba). Promesa clara + palabra clave, en unos 60 caracteres.', ex: '«Cuánto cuesta cambiar un techo en Florida (guía 2026)»' },
    { l: 'H2', t: 'Las secciones principales', d: 'Entre 3 y 6. Cada una responde una pregunta del lector. Si lees solo los H2 debes entender de qué va el artículo.', ex: '«Qué factores cambian el precio»' },
    { l: 'H3', t: 'Detalles dentro de un H2', d: 'Pasos, ejemplos, opciones o casos. Siempre cuelgan de un H2: nunca saltes de H2 a H4.', ex: '«Tejas de asfalto», «Paso 2: retira las tejas viejas»' },
    { l: 'H4', t: 'Subdivisión fina (casi nunca)', d: 'Solo si un H3 es muy largo y necesita partes. Si dudas, usa H3.', ex: '«Garantía del fabricante»' },
  ];
  return <div className="space-y-2.5">{rows.map(r => <div key={r.l} className="flex gap-2.5"><span className={cx('mt-0.5 grid h-6 w-8 shrink-0 place-items-center rounded-md text-[12px] font-extrabold', r.l === 'H1' ? 'bg-brand-600 text-white' : LVL[Number(r.l[1])])}>{r.l}</span><div className="min-w-0"><p className="text-[13px] font-bold text-navy">{r.t}</p><p className="text-[12.5px] leading-snug text-slate">{r.d}</p>{!compact && <p className="mt-0.5 text-[12px] italic text-mute">Ej. {r.ex}</p>}</div></div>)}
    <p className="rounded-lg bg-sky px-3 py-2 text-[12.5px] leading-snug text-navy"><strong>Prueba rápida:</strong> lee solo los encabezados, de arriba abajo. Si cuentan la historia completa, la estructura es buena.</p></div>;
}

export default function OutlinePanel({ doc, an, onJump, onSetLevel, onTemplate }: { doc: PostDoc; an: Analysis; onJump: (id: string) => void; onSetLevel: (id: string, level: 2 | 3 | 4) => void; onTemplate: (t: Template) => void }) {
  const [guide, setGuide] = useState(() => { try { return localStorage.getItem('nx-blog-guide') !== '0'; } catch { return true; } });
  const toggle = (v: boolean) => { setGuide(v); try { localStorage.setItem('nx-blog-guide', v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  const errs = an.issues.filter(i => i.sev === 'error'), warns = an.issues.filter(i => i.sev !== 'error');
  const fixable = (id: string) => an.outline.find(o => o.blockId === id);
  return <div className="space-y-4">
    <section aria-labelledby="ol-tree">
      <h3 id="ol-tree" className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-wide text-mute">Esquema en vivo<span className="font-normal normal-case tracking-normal">{an.outline.length} encabezado{an.outline.length === 1 ? '' : 's'}</span></h3>
      <ol className="space-y-0.5" aria-label="Árbol de encabezados">
        <li className="flex items-start gap-2 rounded-lg px-2 py-1.5"><span className="mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded bg-brand-600 text-[11px] font-extrabold text-white">H1</span><span className={cx('min-w-0 break-words text-[13px] font-bold', doc.title.trim() ? 'text-navy' : 'text-mute')}>{doc.title.trim() || 'Escribe el título del artículo'}</span></li>
        {an.outline.length === 0 && <li className="px-2 py-2 text-[12.5px] text-slate">Aún no hay subtítulos. Añade un bloque <strong>Encabezado H2</strong> para crear la primera sección.</li>}
        {an.outline.map(o => { const bad = o.issues.some(i => i.sev === 'error'); const warn = !bad && o.issues.length > 0; return <li key={o.blockId} className={IND[o.level]}>
          <button type="button" onClick={() => onJump(o.blockId)} className={cx('flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sky', bad && 'bg-[#FDECEC]/70', warn && 'bg-[#FDF5E3]/70')}>
            <span className={cx('mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded text-[11px] font-extrabold', LVL[o.level])}>H{o.level}</span>
            <span className="min-w-0 flex-1"><span className={cx('block break-words text-[13px] leading-snug', o.level === 2 ? 'font-bold text-navy' : 'font-medium text-ink', !o.text.trim() && 'italic text-mute')}>{o.text.trim() || 'Sin texto'}</span>{o.words > 0 && <span className="text-[11.5px] text-mute">{o.words} palabra{o.words === 1 ? '' : 's'}</span>}</span>
            {(bad || warn) && <BIcon n="alert" s={14} className={cx('mt-1 shrink-0', bad ? 'text-bad' : 'text-[#B7791F]')} />}
          </button></li>; })}
      </ol>
    </section>

    <section aria-labelledby="ol-chk">
      <h3 id="ol-chk" className="mb-2 text-[12px] font-bold uppercase tracking-wide text-mute">Comprobaciones</h3>
      {an.issues.length === 0 ? <p className="flex items-start gap-2 rounded-lg bg-[#E6F4EC] px-3 py-2 text-[13px] text-[#00704A]"><BIcon n="check" s={16} className="mt-0.5 shrink-0" />Estructura correcta: un solo H1, niveles sin saltos y secciones equilibradas.</p>
        : <ul className="space-y-1.5">{[...errs, ...warns].map(i => { const f = i.blockId ? fixable(i.blockId) : undefined; const m = /^Saltas de H(\d) a H(\d)/.exec(i.title); const to = m ? Number(m[1]) + 1 : i.title.startsWith('El primer encabezado') ? 2 : 0;
          return <li key={i.id} className={cx('rounded-lg border px-3 py-2 text-[12.5px]', i.sev === 'error' ? 'border-bad/30 bg-[#FDECEC]/60' : i.sev === 'warn' ? 'border-[#E9C477]/60 bg-[#FDF5E3]/70' : 'border-line bg-canvas')}>
            <p className={cx('flex items-start gap-1.5 font-bold', i.sev === 'error' ? 'text-bad' : i.sev === 'warn' ? 'text-[#8A5A0B]' : 'text-navy')}><BIcon n={i.sev === 'info' ? 'info' : 'alert'} s={14} className="mt-0.5 shrink-0" />{i.title}</p>
            <p className="mt-0.5 leading-snug text-slate">{i.detail}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{i.blockId && <button type="button" className="cursor-pointer text-[12px] font-semibold text-link hover:underline" onClick={() => onJump(i.blockId!)}>Ir al bloque</button>}{f && to >= 2 && to <= 4 && <button type="button" className="cursor-pointer text-[12px] font-semibold text-link hover:underline" onClick={() => onSetLevel(f.blockId, to as 2 | 3 | 4)}>Cambiar a H{to}</button>}</div></li>; })}</ul>}
    </section>

    <section>
      <button type="button" aria-expanded={guide} onClick={() => toggle(!guide)} className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-sky px-3 py-2 text-left text-[13px] font-bold text-navy"><span className="flex items-center gap-2"><BIcon n="heading" s={16} />Qué poner en cada H</span><BIcon n={guide ? 'chevU' : 'chevD'} s={15} /></button>
      {guide && <div className="px-1 pt-3"><HeadingGuide /></div>}
    </section>

    <section aria-labelledby="ol-tpl">
      <h3 id="ol-tpl" className="mb-2 text-[12px] font-bold uppercase tracking-wide text-mute">Plantillas de artículo</h3>
      <p className="mb-2 text-[12.5px] text-slate">Cargan encabezados de ejemplo ya ordenados (H2/H3). {doc.blocks.length ? 'Se añaden al final de lo que ya escribiste.' : 'Cámbialos por los tuyos.'}</p>
      <ul className="space-y-1.5">{TEMPLATES.filter(t => t.id !== 'blank').map(t => <li key={t.id}><button type="button" onClick={() => onTemplate(t)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-white px-3 py-2 text-left hover:border-line-2 hover:bg-sky/50"><BIcon n={t.icon} s={16} className="mt-0.5 shrink-0 text-slate" /><span className="min-w-0"><span className="block text-[13px] font-semibold text-navy">{t.name}</span><span className="block text-[12px] leading-snug text-slate">{t.summary}</span></span></button></li>)}</ul>
    </section>
  </div>;
}
export function TemplateCards({ onPick }: { onPick: (t: Template) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{TEMPLATES.map(t => <button key={t.id} type="button" onClick={() => onPick(t)} className="flex cursor-pointer flex-col items-start rounded-xl border border-line bg-white p-4 text-left hover:border-link hover:shadow-[var(--shadow-card)]">
    <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-sky text-navy"><BIcon n={t.icon} s={18} /></span><span className="font-display text-[15px] font-bold text-navy">{t.name}</span><span className="mt-0.5 text-[13px] text-slate">{t.summary}</span>{t.titleHint && <span className="mt-2 text-[12px] italic text-mute">Ej. {t.titleHint}</span>}<span className="mt-1.5 text-[12px] font-semibold text-link">{t.when}</span></button>)}</div>;
}
export { Button };
