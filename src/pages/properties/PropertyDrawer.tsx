import { useMemo, useState } from 'react';
import { ColorPicker, OptionPill, OptionSelect } from '../../components/OptionPill';
import { Button, Drawer, IconButton, Input, Popover, useCopy, useToast } from '../../components/ui';
import { isCustomized } from '../../lib/propOptions';
import { CATALOG, propLabel, type PropDef, type PropOption } from '../../lib/schema';
import type { ObjKey } from '../../lib/types';
import { resetOptions, saveOptions } from './propApi';

const GROUP_LABEL = (g?: string) => g ?? '—';

/** Ficha de una propiedad. Para enumeraciones: editor de opciones (etiqueta, color, ocultar, orden). Los valores internos no cambian. */
export default function PropertyDrawer({ obj, def, typeLabel, onClose }: { obj: ObjKey; def: PropDef; typeLabel: string; onClose: () => void }) {
  const toast = useToast(); const copy = useCopy();
  const isEnum = def.type === 'enumeration' && !!def.options && def.fieldType !== 'booleancheckbox';
  const fromHubspot = (CATALOG[obj] ?? []).includes(def);
  const [draft, setDraft] = useState<PropOption[]>(() => (def.options ?? []).map(o => ({ ...o, color: o.color ?? null })));
  const baseline = useMemo(() => JSON.stringify((def.options ?? []).map(o => ({ ...o, color: o.color ?? null }))), [def.options]);
  const dirty = JSON.stringify(draft) !== baseline; const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const newVals = useMemo(() => new Set(draft.map(o => o.value).filter(v => !(def.options ?? []).some(x => x.value === v))), [draft, def.options]);
  const set = (i: number, patch: Partial<PropOption>) => setDraft(d => d.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i: number, dir: number) => setDraft(d => { const a = [...d]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const add = () => setDraft(d => [...d, { label: '', value: '', hidden: false, color: null }]);
  const dupVal = (i: number) => draft.some((o, j) => j !== i && o.value && o.value === draft[i].value);
  const invalid = draft.some((o, i) => !o.value.trim() || !o.label.trim() || dupVal(i));
  const save = async () => {
    setBusy(true); setErr('');
    try { await saveOptions(obj, def.name, draft.map(o => ({ ...o, value: o.value.trim() }))); toast('Opciones guardadas'); }
    catch (e) { setErr(`No se pudo guardar: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const reset = async () => { if (!confirm('¿Volver a las etiquetas, colores y orden originales de Nexa?')) return; setBusy(true); try { await resetOptions(obj, def.name); setDraft((def.options ?? []).map(o => ({ ...o, color: o.color ?? null }))); toast('Opciones restablecidas'); } catch (e) { setErr(`No se pudo restablecer: ${(e as Error).message}`); } finally { setBusy(false); } };
  return <Drawer title={propLabel(obj, def.name)} onClose={onClose} width="w-[600px]" footer={isEnum ? <>
      {fromHubspot && isCustomized(obj, def.name) && <Button className="mr-auto" onClick={reset} disabled={busy}>Restablecer a Nexa</Button>}
      <Button onClick={onClose}>Cerrar</Button><Button variant="primary" disabled={!dirty || invalid || busy} onClick={save}>Guardar opciones</Button></> : undefined}>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
      <div><dt className="text-[12px] font-bold text-slate">Nombre interno</dt><dd className="flex items-center gap-1 font-mono">{def.name}<IconButton n="copy" label="Copiar nombre interno" className="!h-6 !w-6" onClick={() => copy(def.name, 'Nombre interno copiado')} /></dd></div>
      <div><dt className="text-[12px] font-bold text-slate">Tipo de campo</dt><dd>{typeLabel}</dd></div>
      <div><dt className="text-[12px] font-bold text-slate">Grupo</dt><dd>{GROUP_LABEL(def.groupName)}</dd></div>
      <div><dt className="text-[12px] font-bold text-slate">Origen</dt><dd>{fromHubspot ? 'Nexa (catálogo)' : 'Propiedad del CRM'}</dd></div>
    </dl>
    {isEnum && <section className="mt-5" aria-label="Opciones">
      <div className="mb-1 flex items-end justify-between"><h3 className="font-display text-[15px] font-bold text-navy">Opciones ({draft.length})</h3><Button size="sm" icon="plus" onClick={add}>Agregar opción</Button></div>
      <p className="mb-3 text-[12.5px] text-slate">Cada opción tiene etiqueta, color y orden. {fromHubspot ? 'Los valores internos de Nexa no se pueden cambiar ni quitar (n8n y la API siguen usándolos); si ya no la quieres, ocúltala.' : 'El valor interno de una opción existente no se puede cambiar.'} Sin color = etiqueta blanca.</p>
      {err && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
      <ol className="divide-y divide-line rounded-xl border border-line">
        {draft.map((o, i) => <li key={i} className={`flex items-center gap-1.5 px-2 py-1.5 ${o.hidden ? 'bg-canvas/70' : ''}`} data-opt={o.value}>
          <span className="flex flex-col"><IconButton n="up" label={`Subir ${o.label || 'opción'}`} className="!h-5 !w-6" onClick={() => move(i, -1)} disabled={i === 0} /><IconButton n="down" label={`Bajar ${o.label || 'opción'}`} className="!h-5 !w-6" onClick={() => move(i, 1)} disabled={i === draft.length - 1} /></span>
          <Popover align="left" width="w-64" trigger={({ toggle }) => <button type="button" onClick={toggle} aria-label={`Color de ${o.label || 'la opción'}`} title="Cambiar color" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line-2 hover:bg-sky"><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: o.color ?? '#FFFFFF' }} /></button>}>
            {() => <div className="p-2"><ColorPicker value={o.color} onChange={c => set(i, { color: c })} label={`Color de ${o.label}`} /></div>}</Popover>
          <div className="min-w-0 flex-1"><Input value={o.label} aria-label={`Etiqueta de la opción ${i + 1}`} placeholder="Etiqueta" onChange={e => set(i, { label: e.target.value })} className="!h-8" />
            {newVals.has(o.value) || !o.value ? <Input value={o.value} aria-label="Valor interno de la nueva opción" placeholder="valor_interno" onChange={e => set(i, { value: e.target.value })} className={`!mt-1 !h-7 font-mono text-[12px] ${dupVal(i) ? 'border-bad' : ''}`} />
              : <div className="mt-0.5 truncate font-mono text-[11.5px] text-slate" title="Valor interno (no cambia)">{o.value}</div>}</div>
          <span className="hidden w-36 shrink-0 sm:block"><OptionPill label={o.label || '…'} color={o.color} /></span>
          <IconButton n="eye" label={o.hidden ? `Mostrar ${o.label}` : `Ocultar ${o.label}`} aria-pressed={!!o.hidden} className={`!h-8 !w-8 ${o.hidden ? 'bg-sky text-navy' : ''}`} onClick={() => set(i, { hidden: !o.hidden })} />
          {(!fromHubspot || newVals.has(o.value) || !o.value) && <IconButton n="trash" label={`Quitar ${o.label || 'opción'}`} className="!h-8 !w-8" onClick={() => setDraft(d => d.filter((_, j) => j !== i))} />}
        </li>)}
      </ol>
      <div className="mt-4 rounded-xl border border-line bg-canvas/60 p-3"><div className="mb-1.5 text-[12px] font-bold text-slate">Vista previa del desplegable</div>
        <OptionSelect value={null} options={draft.filter(o => !o.hidden && o.value && o.label)} onChange={() => {}} ariaLabel="Vista previa del desplegable" /></div>
    </section>}
    {!isEnum && <p className="mt-4 text-[12.5px] text-slate">Solo las propiedades de selección (enumeración) tienen opciones con color.</p>}
    {!isEnum && def.options && <p className="mt-2 flex flex-wrap gap-1.5">{def.options.map(o => <OptionPill key={o.value} label={o.label} color={o.color} />)}</p>}
  </Drawer>;
}
