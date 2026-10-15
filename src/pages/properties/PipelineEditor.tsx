import { useEffect, useMemo, useState } from 'react';
import { PropertyPicker } from '../../components/FilterPanel';
import Icon from '../../components/Icon';
import { Button, Card, IconButton, Input, Modal, Popover, Select, useToast } from '../../components/ui';
import { useAccess } from '../../lib/perms';
import { PIPELINES, propLabel, type Pipeline, type PipeObj, type Stage } from '../../lib/schema';
import { stageUsage, savePipelineSet, type Move } from './pipelineApi';

type Kind = 'open' | 'won' | 'lost' | 'closed';
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const kindOf = (obj: PipeObj, s: Stage): Kind => !s.closed ? 'open' : obj !== 'deals' ? 'closed' : Number(s.probability) >= 1 ? 'won' : 'lost';
const pct = (p?: string) => (p === undefined || p === '' || Number.isNaN(Number(p)) ? '' : String(Math.round(Number(p) * 1000) / 10));
const REQ_OK: PipeObj[] = ['deals', 'tickets'];   // Nexa: propiedades obligatorias por etapa solo en negocios y tickets
const SINGULAR: Record<PipeObj, string> = { deals: 'negocio', appointments: 'cita', tickets: 'ticket', leads: 'lead' };

type Ask = { title: string; need: number; from: { pipeline: string; stage: string }[]; exclude: { pipeline?: string; stage?: string }; then: (to: { pipeline: string; stage: string }) => void };

/** Editor de pipelines y etapas (réplica de Ajustes → Objetos → Pipelines de Nexa). Guarda en servidor y muestra sus validaciones. */
export default function PipelineEditor({ obj }: { obj: PipeObj }) {
  const toast = useToast(); const acc = useAccess(); const can = acc.isAdmin;
  const [pipes, setPipes] = useState<Pipeline[]>(() => clone(PIPELINES[obj])); const [moves, setMoves] = useState<Move[]>([]); const [dirty, setDirty] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState<Ask | null>(null);
  const loadUsage = () => { void stageUsage(obj).then(setUsage); };
  useEffect(loadUsage, [obj]);
  const mut = (fn: (p: Pipeline[]) => void) => { setPipes(s => { const n = clone(s); fn(n); return n; }); setDirty(true); setErr(''); };
  const n = (p: string, s: string) => usage[`${p}:${s}`] ?? 0;
  const dupLabel = useMemo(() => new Set(pipes.map(p => p.label.trim().toLowerCase()).filter((l, i, a) => a.indexOf(l) !== i)), [pipes]);
  const bad = pipes.some(p => !p.label.trim() || dupLabel.has(p.label.trim().toLowerCase()) || !p.stages.length || p.stages.some((s, i) => !s.label.trim() || p.stages.findIndex(x => x.label.trim().toLowerCase() === s.label.trim().toLowerCase()) !== i));
  const allStages = (exP?: string, exS?: string) => pipes.flatMap(p => p.stages.filter(s => !(p.id === exP && (exS === undefined || s.id === exS))).map(s => ({ pipeline: p.id, stage: s.id, label: `${p.label} · ${s.label}` })));

  const setKind = (pi: number, si: number, k: Kind) => mut(a => { const s = a[pi].stages[si]; if (k === 'open') { s.closed = false; if (!s.probability || Number(s.probability) >= 1 || Number(s.probability) === 0) s.probability = obj === 'deals' ? '0.5' : s.probability; } else { s.closed = true; if (obj === 'deals') s.probability = k === 'won' ? '1.0' : '0.0'; } });
  const addStage = (pi: number) => mut(a => { a[pi].stages.push({ id: uid('stage'), label: 'Nueva etapa', order: a[pi].stages.length, closed: false, ...(obj === 'deals' ? { probability: '0.5' } : {}) }); });
  const move = (pi: number, si: number, d: number) => mut(a => { const l = a[pi].stages; const j = si + d; if (j >= 0 && j < l.length) [l[si], l[j]] = [l[j], l[si]]; });
  const movePipe = (pi: number, d: number) => mut(a => { const j = pi + d; if (j >= 0 && j < a.length) [a[pi], a[j]] = [a[j], a[pi]]; });

  const removeStage = (pi: number, si: number) => {
    const p = pipes[pi], s = p.stages[si];
    if (p.stages.length <= 1) { setErr('Un pipeline necesita al menos una etapa. Elimina el pipeline completo si ya no lo usas.'); return; }
    const c = n(p.id, s.id);
    if (!c) { if (confirm(`¿Eliminar la etapa “${s.label}”?`)) mut(a => { a[pi].stages.splice(si, 1); }); return; }
    setAsk({ title: `Mover ${c} ${c === 1 ? SINGULAR[obj] : SINGULAR[obj] + 's'} de “${s.label}”`, need: c, from: [{ pipeline: p.id, stage: s.id }], exclude: { pipeline: p.id, stage: s.id },
      then: to => { setMoves(m => [...m.filter(x => !(x.from.pipeline === p.id && x.from.stage === s.id)), { from: { pipeline: p.id, stage: s.id }, to }]); mut(a => { a[pi].stages.splice(si, 1); }); } });
  };
  const removePipe = (pi: number) => {
    const p = pipes[pi]; if (pipes.length <= 1) { setErr('Debe existir al menos un pipeline.'); return; }
    const inUse = p.stages.filter(s => n(p.id, s.id) > 0); const total = inUse.reduce((a, s) => a + n(p.id, s.id), 0);
    const doIt = () => mut(a => { a.splice(pi, 1); });
    if (!total) { if (confirm(`¿Eliminar el pipeline “${p.label}” y sus ${p.stages.length} etapas?`)) doIt(); return; }
    setAsk({ title: `Mover ${total} ${total === 1 ? SINGULAR[obj] : SINGULAR[obj] + 's'} de “${p.label}”`, need: total, from: inUse.map(s => ({ pipeline: p.id, stage: s.id })), exclude: { pipeline: p.id },
      then: to => { setMoves(m => [...m, ...inUse.map(s => ({ from: { pipeline: p.id, stage: s.id }, to }))]); doIt(); } });
  };
  const clonePipe = (pi: number) => mut(a => { const c = clone(a[pi]); c.id = uid('pipe'); c.label = `${c.label} (copia)`; c.stages = c.stages.map((s: Stage) => ({ ...s, id: uid('stage') })); a.splice(pi + 1, 0, c); });
  const makeDefault = (pi: number) => mut(a => { const [p] = a.splice(pi, 1); a.unshift(p); });
  const discard = () => { setPipes(clone(PIPELINES[obj])); setMoves([]); setDirty(false); setErr(''); loadUsage(); };
  const save = async () => {
    setBusy(true); setErr('');
    try { await savePipelineSet(obj, pipes, moves); setMoves([]); setDirty(false); toast('Pipelines guardados'); loadUsage(); setPipes(clone(PIPELINES[obj])); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return <div className="space-y-4">
    {!can && <p role="status" className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-slate">Solo un administrador puede editar pipelines (equivale al permiso de superadministrador de Nexa). Aquí los ves en modo lectura.</p>}
    <p className="text-[13px] text-slate">El pipeline <b>predeterminado</b> es el primero de la lista (los {SINGULAR[obj]}s nuevos sin pipeline entran ahí). {obj === 'deals' ? 'En negocios cada etapa abierta tiene una probabilidad; las cerradas son “ganada” (100 %) o “perdida” (0 %).' : 'Cada etapa es abierta o cerrada.'}</p>
    {pipes.map((p, pi) => <Card key={p.id} className={!can ? 'opacity-95' : ''} title={<div className="flex items-center gap-2"><Input value={p.label} disabled={!can} aria-label="Nombre del pipeline" aria-invalid={!p.label.trim() || dupLabel.has(p.label.trim().toLowerCase())} onChange={e => mut(a => { a[pi].label = e.target.value; })} className="!h-8 !w-[28rem] max-w-full !font-bold" />{pi === 0 && <span className="rounded-full bg-[#E6F4EC] px-2 py-0.5 text-[11px] font-bold text-[#00704A]">Predeterminado</span>}</div>}
      action={can && <div className="flex items-center gap-1">
        <IconButton n="up" label={`Subir pipeline ${p.label}`} className="!h-7 !w-7" disabled={pi === 0} onClick={() => movePipe(pi, -1)} /><IconButton n="down" label={`Bajar pipeline ${p.label}`} className="!h-7 !w-7" disabled={pi === pipes.length - 1} onClick={() => movePipe(pi, 1)} />
        {pi > 0 && <Button size="sm" variant="ghost" onClick={() => makeDefault(pi)}>Hacer predeterminado</Button>}<Button size="sm" variant="ghost" icon="copy" onClick={() => clonePipe(pi)}>Clonar</Button>
        <IconButton n="trash" label={`Eliminar pipeline ${p.label}`} className="!h-7 !w-7" onClick={() => removePipe(pi)} /></div>}>
      <div className="mb-1 text-[12px] text-slate">id: <span className="font-mono">{p.id}</span></div>
      <div className="hidden grid-cols-[2rem_minmax(0,1fr)_11rem_5rem_6.5rem_auto] items-center gap-2 px-2 pb-1 text-[11.5px] font-bold uppercase tracking-wide text-slate md:grid"><span /><span>Etapa</span><span>Estado</span><span>{obj === 'deals' ? 'Prob. %' : ''}</span><span>{REQ_OK.includes(obj) ? 'Obligatorias' : ''}</span><span className="w-32 text-right">Acciones</span></div>
      <ol className="space-y-1.5">{p.stages.map((s, si) => { const k = kindOf(obj, s); const c = n(p.id, s.id); const dup = p.stages.findIndex(x => x.label.trim().toLowerCase() === s.label.trim().toLowerCase()) !== si;
        return <li key={s.id} data-stage={s.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-line px-2 py-1.5 md:grid-cols-[2rem_minmax(0,1fr)_11rem_5rem_6.5rem_auto]">
          <span className="text-center text-[12px] font-bold text-mute">{si + 1}</span>
          <div className="min-w-0"><Input value={s.label} disabled={!can} aria-label={`Nombre de la etapa ${si + 1}`} aria-invalid={dup || !s.label.trim()} onChange={e => mut(a => { a[pi].stages[si].label = e.target.value; })} className={`!h-8 ${dup ? 'border-bad' : ''}`} />{c > 0 && <div className="mt-0.5 text-[11.5px] text-slate">{c} {c === 1 ? SINGULAR[obj] : SINGULAR[obj] + 's'} en esta etapa</div>}</div>
          <Select aria-label={`Estado de ${s.label}`} disabled={!can} value={k} onChange={e => setKind(pi, si, e.target.value as Kind)} className="!h-8 text-[13px]">
            <option value="open">Abierta</option>{obj === 'deals' ? <><option value="won">Cerrada ganada</option><option value="lost">Cerrada perdida</option></> : <option value="closed">Cerrada</option>}</Select>
          <div>{obj === 'deals' && (k === 'open' ? <Input type="number" min={0} max={100} step={1} disabled={!can} aria-label={`Probabilidad de ${s.label} en %`} value={pct(s.probability)} onChange={e => mut(a => { const v = e.target.value; a[pi].stages[si].probability = v === '' ? '' : String(Math.min(100, Math.max(0, Number(v))) / 100); })} className="!h-8" /> : <span className="text-[13px] text-slate">{k === 'won' ? '100' : '0'}</span>)}</div>
          <div>{REQ_OK.includes(obj) && <Popover align="right" width="w-80" trigger={({ toggle }) => <button type="button" disabled={!can && !(s.requiredProperties?.length)} onClick={toggle} aria-label={`Propiedades obligatorias de ${s.label}`} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-line-2 bg-white px-2 text-[12.5px] font-semibold text-navy hover:bg-sky">{s.requiredProperties?.length ?? 0}<Icon n="chevD" s={12} /></button>}>
            {() => <div className="p-2"><div className="mb-1 text-[12px] font-bold text-slate">Propiedades obligatorias para entrar en “{s.label}”</div>
              {(s.requiredProperties ?? []).map(rp => <div key={rp} className="flex items-center justify-between rounded px-1.5 py-1 text-[13px] hover:bg-sky"><span className="truncate">{propLabel(obj, rp)}</span>{can && <IconButton n="x" label={`Quitar ${propLabel(obj, rp)}`} className="!h-6 !w-6" onClick={() => mut(a => { a[pi].stages[si].requiredProperties = (a[pi].stages[si].requiredProperties ?? []).filter(x => x !== rp); })} />}</div>)}
              {!(s.requiredProperties?.length) && <p className="px-1.5 py-1 text-[12.5px] text-slate">Ninguna.</p>}
              {can && <div className="mt-2"><PropertyPicker obj={obj} placeholder="+ Agregar propiedad" exclude={s.requiredProperties ?? []} onChange={nm => mut(a => { a[pi].stages[si].requiredProperties = [...(a[pi].stages[si].requiredProperties ?? []), nm]; })} /></div>}</div>}</Popover>}</div>
          <div className="flex w-32 items-center justify-end gap-0.5">{can && <><IconButton n="up" label={`Subir ${s.label}`} className="!h-7 !w-7" disabled={si === 0} onClick={() => move(pi, si, -1)} /><IconButton n="down" label={`Bajar ${s.label}`} className="!h-7 !w-7" disabled={si === p.stages.length - 1} onClick={() => move(pi, si, 1)} /><IconButton n="trash" label={`Eliminar etapa ${s.label}`} className="!h-7 !w-7" onClick={() => removeStage(pi, si)} /></>}</div>
        </li>; })}</ol>
      {can && <Button size="sm" icon="plus" className="mt-2" onClick={() => addStage(pi)}>Agregar etapa</Button>}
    </Card>)}
    {can && <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/95 p-2 shadow-[var(--shadow-card)] backdrop-blur">
      <Button icon="plus" onClick={() => mut(a => { a.push({ id: uid('pipe'), label: `Nuevo pipeline ${a.length + 1}`, stages: [{ id: uid('stage'), label: 'Nueva etapa', order: 0, closed: false, ...(obj === 'deals' ? { probability: '0.1' } : {}) }] }); })}>Crear pipeline</Button>
      <span className="mx-1 h-5 w-px bg-line" />
      <Button variant="primary" disabled={!dirty || bad || busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>{dirty && <Button variant="ghost" onClick={discard} disabled={busy}>Descartar</Button>}
      {moves.length > 0 && <span className="text-[12.5px] text-slate">Se moverán registros al guardar.</span>}
      {bad && dirty && <span role="alert" className="text-[12.5px] font-medium text-bad">Revisa nombres vacíos o repetidos.</span>}
      {err && <span role="alert" className="text-[12.5px] font-medium text-bad">{err}</span>}</div>}
    {ask && <MoveDialog ask={ask} options={allStages(ask.exclude.pipeline, ask.exclude.stage)} onClose={() => setAsk(null)} />}
  </div>;
}

function MoveDialog({ ask, options, onClose }: { ask: Ask; options: { pipeline: string; stage: string; label: string }[]; onClose: () => void }) {
  const [to, setTo] = useState(options[0] ? `${options[0].pipeline}|${options[0].stage}` : '');
  return <Modal title={ask.title} onClose={onClose} width="max-w-md" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!to} onClick={() => { const [pipeline, stage] = to.split('|'); ask.then({ pipeline, stage }); onClose(); }}>Mover y quitar</Button></>}>
    <p className="mb-3 text-[13.5px] text-slate">{ask.need === 1 ? 'El registro que está ahí se moverá' : `Los ${ask.need} registros que están ahí se moverán`} a la etapa que elijas al guardar los cambios. Nada se borra.</p>
    <label className="block text-[12.5px] font-semibold text-slate">Mover a<Select data-autofocus value={to} onChange={e => setTo(e.target.value)} className="mt-1">{options.map(o => <option key={o.pipeline + o.stage} value={`${o.pipeline}|${o.stage}`}>{o.label}</option>)}</Select></label>
  </Modal>;
}
