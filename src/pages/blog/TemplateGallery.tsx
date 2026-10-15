// Selector de plantillas: miniaturas REALES (el mismo HTML y CSS del tema que verá el visitante, reducido) + las plantillas de solo estructura.
import { useEffect, useRef, useState } from 'react';
import { CONNECTED } from '../../lib/db';
import { Skeleton, cx } from '../../components/ui';
import { BIcon } from './icons';
import { blog2, errMsg, type TemplateInfo } from './blogApi';
import { absUrl, ensureThemeCss, useThemes } from './themeAssets';
import { TemplateCards } from './OutlinePanel';
import type { Template } from './templates';

const BASE_W = 900;
function Thumb({ t }: { t: TemplateInfo }) {
  const box = useRef<HTMLDivElement>(null); const [k, setK] = useState(0.3);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setK(el.clientWidth / BASE_W)); ro.observe(el); setK(el.clientWidth / BASE_W); return () => ro.disconnect(); }, []);
  return <div ref={box} aria-hidden="true" className="relative aspect-[4/3.1] w-full overflow-hidden border-b border-line" style={{ background: t.swatch[0] }}>
    <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: BASE_W, transform: `scale(${k})` }} dangerouslySetInnerHTML={{ __html: t.html }} />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: `linear-gradient(transparent, ${t.swatch[0]})` }} /></div>;
}

export default function TemplateGallery({ onPickTheme, onPickStructure, busyId }: { onPickTheme: (t: TemplateInfo) => void; onPickStructure: (t: Template) => void; busyId?: string | null }) {
  const themes = useThemes(); const [list, setList] = useState<TemplateInfo[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { if (!CONNECTED) { setList([]); return; } blog2.templates().then(r => setList(r.results)).catch(e => { setErr(errMsg(e)); setList([]); }); }, []);
  useEffect(() => { themes.forEach(t => ensureThemeCss(absUrl(t.cssUrl))); }, [themes]);
  return <div>
    <h3 className="mb-1 font-display text-[15px] font-bold text-navy">Plantillas con diseño propio</h3>
    <p className="mb-3 text-[13px] text-slate">Cada una trae su tema (tipografía, colores, cabecera) y el contenido de ejemplo ya armado: solo reemplazas el texto o usas <strong className="text-navy">«Pegar contenido»</strong>. Lo que ves en la miniatura es lo que se publica.</p>
    {list === null ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
      : list.length === 0 ? <p className="rounded-lg bg-canvas px-3 py-3 text-[13px] text-slate">{err || (CONNECTED ? 'No hay plantillas con diseño disponibles.' : 'Las plantillas con diseño están disponibles al conectar con el servidor. Mientras tanto usa las de estructura.')}</p>
        : <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">{list.map(t => <div key={t.id} data-testid={`tpl-${t.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:border-link hover:shadow-[var(--shadow-card)]">
          <button type="button" onClick={() => onPickTheme(t)} disabled={!!busyId} aria-label={`Usar la plantilla ${t.name}`} className="block cursor-pointer text-left"><Thumb t={t} /></button>
          <div className="flex flex-1 flex-col p-3.5"><div className="flex items-center gap-2"><span className="font-display text-[15px] font-bold text-navy">{t.name}</span>{t.id === 'nx-guia' && <span className="rounded-full bg-[#FFF1EC] px-2 text-[11px] font-bold text-[#C2410C]">Base Nexa</span>}</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate">{t.tagline}</p><p className="mt-1 text-[12px] text-mute">Ideal para: {t.bestFor.toLowerCase()}</p>
            <div className="mt-2 flex items-center gap-1.5">{t.swatch.map((c, i) => <span key={i} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c }} />)}<span className="ml-auto text-[11.5px] text-mute">{t.blockCount} bloques</span></div>
            <button type="button" disabled={!!busyId} onClick={() => onPickTheme(t)} className={cx('mt-3 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-navy text-[13.5px] font-semibold text-white hover:bg-navy/90 disabled:opacity-60')}>{busyId === t.id ? 'Cargando…' : <><BIcon n="template" s={15} />Usar esta plantilla</>}</button></div></div>)}</div>}
    <h3 className="mb-1 mt-7 font-display text-[15px] font-bold text-navy">Solo estructura de encabezados</h3>
    <p className="mb-3 text-[13px] text-slate">Cargan H2/H3 de ejemplo con guías de qué escribir en cada sección, con el tema que tengas elegido.</p>
    <TemplateCards onPick={onPickStructure} />
  </div>;
}
