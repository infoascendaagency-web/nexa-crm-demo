import { useMemo, useState } from 'react';
import GROUPS_JSON from '../../data/property-groups.json';
import { Cell } from '../../components/cells';
import Icon from '../../components/Icon';
import PropertyInput, { optionsFor } from '../../components/PropertyInput';
import { Button, Checkbox, IconButton, Input, Modal, useCopy, useToast } from '../../components/ui';
import { crm, useDbValue } from '../../lib/api';
import { api } from '../../lib/backend';
import { CONNECTED } from '../../lib/db';
import { useAccess } from '../../lib/perms';
import { allProps, propDef, propLabel } from '../../lib/schema';
import type { ObjKey, Rec } from '../../lib/types';
import { fmtDateTime } from '../../lib/fmt';

const GROUPS = GROUPS_JSON as Record<string, { name: string; label: string; displayOrder: number }[]>;
/** Propiedades que el servidor calcula: no se editan (igual que en la ficha). */
const RO = new Set(['createdate', 'lastmodifieddate', 'notes_last_updated', 'hs_object_id', 'hs_createdate', 'hs_lastmodifieddate', 'notes_last_contacted', 'hs_created_by_user_id', 'hs_updated_by_user_id']);

type Hist = { property: string; value: string | null; changedAt: string; changedBy: number | null; source: string };
function History({ obj, id, name }: { obj: ObjKey; id: string; name: string }) {
  const [open, setOpen] = useState(false); const [rows, setRows] = useState<Hist[] | null>(null); const [err, setErr] = useState(false);
  const toggle = () => { setOpen(o => !o); if (!rows && !open) api<{ results: Hist[] }>('GET', `/objects/${obj}/${id}/history?property=${encodeURIComponent(name)}&limit=20`).then(r => setRows(r.results), () => setErr(true)); };
  return <div><button type="button" aria-expanded={open} onClick={toggle} className="cursor-pointer text-[12px] font-semibold text-link hover:underline">{open ? 'Ocultar historial' : 'Historial'}</button>
    {open && <div className="mt-1 rounded-lg border border-line bg-canvas/60 p-2 text-[12.5px]" data-history>{err ? <p className="text-bad">No se pudo cargar el historial.</p> : !rows ? <p className="text-slate">Cargando…</p> : !rows.length ? <p className="text-slate">Sin cambios registrados para esta propiedad.</p>
      : <ul className="space-y-1.5">{rows.map((h, i) => <li key={i} className="border-b border-line/60 pb-1.5 last:border-0 last:pb-0"><div className="break-words font-semibold text-ink">{h.value ?? '— (vacío)'}</div><div className="text-slate">{fmtDateTime(h.changedAt)} · {h.source}</div></li>)}</ul>}</div>}</div>;
}

function Row({ obj, rec, name, canEdit }: { obj: ObjKey; rec: Rec; name: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false); const [val, setVal] = useState<string | null>(null); const toast = useToast(); const copy = useCopy();
  const d = propDef(obj, name); const ro = !canEdit || RO.has(name) || !!d?.calculated || !!d?.readOnlyValue; const selectLike = !!optionsFor(obj, name, rec.properties) || d?.type === 'bool';
  const raw = rec.properties[name] ?? (name === 'createdate' ? rec.createdAt : null);
  const commit = (v: string | null) => { setEditing(false); if ((v ?? '') !== (rec.properties[name] ?? '')) { crm.update(obj, rec.id, { [name]: v }); toast(`${propLabel(obj, name)} actualizado`); } };
  return <div className="grid gap-x-4 gap-y-0.5 border-b border-line/60 px-4 py-2.5 last:border-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]" data-prop={name}>
    <div className="min-w-0"><div className="break-words text-[13px] font-bold text-slate">{propLabel(obj, name)}</div>
      <div className="mt-0.5 flex items-center gap-1"><code className="truncate rounded bg-canvas px-1 font-mono text-[11.5px] text-slate" title="Nombre interno">{name}</code><IconButton n="copy" label={`Copiar nombre interno ${name}`} className="!h-5 !w-5" onClick={() => copy(name, 'Nombre interno copiado')} /></div></div>
    <div className="min-w-0">
      {editing && !ro ? <div onKeyDown={e => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && !selectLike && (e.target as HTMLElement).tagName !== 'TEXTAREA') commit(val); }}>
        <PropertyInput obj={obj} name={name} value={val} ctx={rec.properties} autoFocus onChange={v => { setVal(v); if (selectLike) commit(v); }} onBlur={() => { if (!selectLike) commit(val); else setEditing(false); }} /></div>
        : <button type="button" disabled={ro} aria-label={ro ? undefined : `Editar ${propLabel(obj, name)}`} onClick={() => { setVal(rec.properties[name] ?? null); setEditing(true); }} className={`-mx-1.5 flex min-h-7 w-[calc(100%+12px)] items-start gap-1 rounded-md px-1.5 py-0.5 text-left text-[14px] text-ink ${ro ? 'cursor-default' : 'cursor-pointer hover:bg-sky'}`}>
          {raw ? <span className="min-w-0 break-words"><Cell obj={obj} r={rec} col={name} /></span> : <span className="text-mute">--</span>}{!ro && <Icon n="edit" s={13} className="ml-auto mt-1 shrink-0 text-mute" />}</button>}
      {CONNECTED && raw && !RO.has(name) && <div className="mt-0.5"><History obj={obj} id={rec.id} name={name} /></div>}
    </div>
  </div>;
}

/** "Ver todas las propiedades" (menú Acciones de la ficha, como Nexa): todas las propiedades del registro por grupo real, con buscador, "solo con valor", edición y nombre interno. */
export default function AllPropertiesModal({ obj, rec, onClose }: { obj: ObjKey; rec: Rec; onClose: () => void }) {
  const acc = useAccess(); const canEdit = acc.obj(obj, 'edit');
  const [q, setQ] = useState(''); const [onlyVal, setOnlyVal] = useState(false); const [openG, setOpenG] = useState<Record<string, boolean>>({});
  const props = useDbValue(() => allProps(obj).filter(p => !p.hidden), [obj]);
  const gi = useMemo(() => Object.fromEntries((GROUPS[obj] ?? []).map(g => [g.name, g])), [obj]);
  const groups = useMemo(() => { const m = new Map<string, string[]>(); props.forEach(p => { const g = p.groupName ?? 'otros'; m.set(g, [...(m.get(g) ?? []), p.name]); }); return [...m.entries()].map(([g, ps]) => ({ g, ps })).sort((a, b) => (gi[a.g]?.displayOrder ?? 9999) - (gi[b.g]?.displayOrder ?? 9999) || a.g.localeCompare(b.g)); }, [props, gi]);
  const label = (g: string) => gi[g]?.label ?? g.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const ql = q.trim().toLowerCase();
  const filtered = groups.map(({ g, ps }) => ({ g, total: ps.length, list: ps.filter(n => (!onlyVal || rec.properties[n]) && (!ql || propLabel(obj, n).toLowerCase().includes(ql) || n.toLowerCase().includes(ql))) })).filter(x => x.list.length);
  const withVal = (ps: string[]) => ps.some(n => rec.properties[n]);
  const shown = filtered.reduce((n, x) => n + x.list.length, 0);
  return <Modal title={`Todas las propiedades · ${crm.nameOf(rec, obj)}`} onClose={onClose} width="max-w-5xl" footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}>
    <div className="sticky -top-4 z-10 -mx-5 -mt-4 mb-3 flex flex-wrap items-center gap-3 border-b border-line bg-white px-5 py-3">
      <Input data-autofocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por etiqueta o nombre interno" aria-label="Buscar propiedades" className="max-w-sm" />
      <Checkbox label="Mostrar solo propiedades con valor" checked={onlyVal} onChange={setOnlyVal} />
      <span className="ml-auto text-[12.5px] text-slate" aria-live="polite">{shown} de {props.length} propiedades</span>
      {!canEdit && <span className="w-full text-[12.5px] text-slate">Tu acceso a {obj === 'contacts' ? 'contactos' : 'este objeto'} es de solo lectura: los valores no se pueden editar.</span>}
    </div>
    {!filtered.length && <p className="py-10 text-center text-[14px] text-slate">Ninguna propiedad coincide{ql ? ` con “${q}”` : ''}.</p>}
    <div className="space-y-2">{filtered.map(({ g, total, list }) => { const open = openG[g] ?? (!!ql || onlyVal || withVal(list));
      return <section key={g} className="rounded-xl border border-line bg-white" data-group={g}>
        <h3><button type="button" aria-expanded={open} onClick={() => setOpenG(s => ({ ...s, [g]: !open }))} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left font-display text-[14.5px] font-bold text-navy"><Icon n={open ? 'chevD' : 'chevR'} s={15} />{label(g)}<span className="ml-auto rounded-full bg-sky px-2 text-[12px] font-semibold">{list.length}{list.length !== total ? ` / ${total}` : ''}</span></button></h3>
        {open && <div className="border-t border-line">{list.map(n => <Row key={n} obj={obj} rec={rec} name={n} canEdit={canEdit} />)}</div>}</section>; })}</div>
  </Modal>;
}
