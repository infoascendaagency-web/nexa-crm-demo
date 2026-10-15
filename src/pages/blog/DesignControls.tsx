// Controles de diseño del artículo: tema, ancho del contenedor, índice, caja de autor e imagen de cabecera.
import { Switch, cx } from '../../components/ui';
import type { ThemeInfo } from './blogApi';
import type { Container, PostDoc } from './types';
import { defaultLayout } from './types';

const CONT: { id: Container; label: string; hint: string }[] = [{ id: 'narrow', label: 'Angosto', hint: 'Texto más estrecho: lectura concentrada' }, { id: 'normal', label: 'Normal', hint: 'El ancho que recomienda el tema' }, { id: 'wide', label: 'Ancho', hint: 'Más ancho: bueno para tablas e imágenes grandes' }];
export function ThemeSwatch({ t, size = 28 }: { t: Pick<ThemeInfo, 'swatch'>; size?: number }) {
  const [bg, fg, ac, ac2] = t.swatch;
  return <span aria-hidden="true" className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-black/10" style={{ width: size, height: size, background: bg }}>
    <span className="absolute left-[18%] top-[22%] h-[14%] w-[56%] rounded-sm" style={{ background: fg }} /><span className="absolute left-[18%] top-[46%] h-[8%] w-[40%] rounded-sm opacity-50" style={{ background: fg }} /><span className="absolute bottom-[14%] left-[18%] h-[18%] w-[34%] rounded-sm" style={{ background: ac }} /><span className="absolute bottom-[14%] right-[16%] h-[18%] w-[18%] rounded-sm" style={{ background: ac2 }} /></span>;
}
export function Seg3<T extends string>({ value, onChange, items, label, block }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; hint?: string }[]; label: string; block?: boolean }) {
  return <div role="radiogroup" aria-label={label} className={cx('overflow-hidden rounded-lg border border-line-2 bg-white', block ? 'flex w-full' : 'inline-flex')}>{items.map(i => <button key={i.id} type="button" role="radio" aria-checked={value === i.id} title={i.hint} onClick={() => onChange(i.id)} className={cx('h-8 cursor-pointer text-[12.5px] font-semibold', block ? 'min-w-0 flex-1 px-1' : 'px-2.5', value === i.id ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}>{i.label}</button>)}</div>;
}

export default function DesignControls({ doc, themes, onPatch, compact }: { doc: PostDoc; themes: ThemeInfo[]; onPatch: (p: Partial<PostDoc>) => void; compact?: boolean }) {
  const lay = { ...defaultLayout(), ...(doc.layout ?? {}) }; const cur = themes.find(t => t.id === doc.theme);
  const setLay = (p: Partial<typeof lay>) => onPatch({ layout: { ...lay, ...p } });
  if (compact) return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate">Tema{cur && <ThemeSwatch t={cur} size={22} />}
      <select aria-label="Tema del artículo" value={doc.theme} onChange={e => { const t = themes.find(x => x.id === e.target.value); onPatch({ theme: e.target.value, ...(t ? { layout: { ...lay, container: t.container } } : {}) }); }} className="h-8 rounded-lg border border-line-2 bg-white px-2 text-[13px] font-semibold text-navy focus:border-link focus:outline-none">{themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}{!cur && <option value={doc.theme}>{doc.theme}</option>}</select></label>
    <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate">Ancho del texto<Seg3 label="Ancho del contenedor del artículo" value={lay.container} onChange={v => setLay({ container: v })} items={CONT} /></div>
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-slate"><input type="checkbox" className="accent-navy" checked={lay.toc} onChange={e => setLay({ toc: e.target.checked })} />Índice</label>
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-slate"><input type="checkbox" className="accent-navy" checked={lay.authorBox} onChange={e => setLay({ authorBox: e.target.checked })} />Autor</label>
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-slate"><input type="checkbox" className="accent-navy" checked={lay.heroImage} onChange={e => setLay({ heroImage: e.target.checked })} />Imagen de cabecera</label>
  </div>;
  return <fieldset className="mb-4 rounded-lg border border-line px-3 pb-3 pt-1"><legend className="px-1 text-[12.5px] font-semibold text-slate">Diseño del artículo</legend>
    {themes.length === 0 ? <p className="py-2 text-[12.5px] text-mute">Los temas se cargan al conectar con el servidor.</p> : <>
      <div role="radiogroup" aria-label="Tema" className="mt-1 grid grid-cols-2 gap-1.5">{themes.map(t => <button key={t.id} type="button" role="radio" aria-checked={doc.theme === t.id} onClick={() => onPatch({ theme: t.id, layout: { ...lay, container: t.container } })} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-left', doc.theme === t.id ? 'border-navy bg-sky/60' : 'border-line bg-white hover:bg-sky/30')}><ThemeSwatch t={t} /><span className="min-w-0 truncate text-[12.5px] font-semibold text-navy">{t.name}</span></button>)}</div>
      {cur && <p className="mt-1.5 text-[12px] leading-snug text-slate">{cur.tagline} <span className="text-mute">Ideal para: {cur.bestFor.toLowerCase()}.</span></p>}</>}
    <div className="mt-3"><span className="mb-1 block text-[12.5px] font-semibold text-slate">Ancho del texto (contenedor del artículo)</span><Seg3 label="Ancho del contenedor del artículo" value={lay.container} onChange={v => setLay({ container: v })} items={CONT} /><p className="mt-1 text-[12px] text-mute">{CONT.find(c => c.id === lay.container)?.hint}. El ancho de cada bloque se ajusta desde la Vista previa.</p></div>
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-navy">Índice del artículo (con los H2/H3)</span><Switch on={lay.toc} onChange={v => setLay({ toc: v })} label="Índice del artículo" /></div>
      <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-navy">Caja de autor al final</span><Switch on={lay.authorBox} onChange={v => setLay({ authorBox: v })} label="Caja de autor" /></div>
      <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-navy">Imagen destacada en la cabecera</span><Switch on={lay.heroImage} onChange={v => setLay({ heroImage: v })} label="Imagen destacada en la cabecera" /></div></div>
  </fieldset>;
}
