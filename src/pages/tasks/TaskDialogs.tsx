// Panel de detalle de una tarea y diálogo para crear una nueva (asociada a un contacto).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import RecordPicker from '../../components/RecordPicker';
import { Button, Drawer, Field, Input, Modal, Select, Textarea, useToast } from '../../components/ui';
import { crm, useRecord } from '../../lib/api';
import { OWNERS } from '../../lib/schema';
import type { Rec } from '../../lib/types';
import { TargetLink, applyPatch } from './parts';
import { PRIO_LABEL, PRIO_ORDER, STATUS_LABEL, TYPE_LABEL, addDaysKey, dayKey, dueOf, fromInput, keyToMs, toInput, type Target } from './util';

const ownerOptions = () => OWNERS.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>);

export function TaskDrawer({ id, target, onClose, onUndo }: { id: string; target?: Target; onClose: () => void; onUndo: (msg: string, undo: () => void) => void }) {
  const t = useRecord('tasks', id); const toast = useToast();
  const [f, setF] = useState<Record<string, string> | null>(null);
  if (!t) return <Drawer title="Tarea" onClose={onClose}><p className="text-[13.5px] text-slate">Esta tarea ya no existe.</p></Drawer>;
  const p = t.properties; const due = dueOf(t);
  const cur = f ?? { subject: p.hs_task_subject ?? '', body: p.hs_task_body ?? '', due: toInput(due), prio: p.hs_task_priority || 'NONE', type: p.hs_task_type || 'TODO', status: p.hs_task_status || 'NOT_STARTED', owner: p.hubspot_owner_id ?? '' };
  const set = (k: string) => (v: string) => setF({ ...cur, [k]: v }); const done = p.hs_task_status === 'COMPLETED';
  const save = () => {
    if (!cur.subject.trim()) { toast('Indica el título de la tarea', 'err'); return; }
    const ms = fromInput(cur.due); const patch: Record<string, string | null> = { hs_task_subject: cur.subject.trim(), hs_task_body: cur.body.trim() || null, hs_timestamp: ms != null ? new Date(ms).toISOString() : null, hs_task_priority: cur.prio, hs_task_type: cur.type, hs_task_status: cur.status, hubspot_owner_id: cur.owner || null };
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => (p[k] ?? null) !== v)); if (!Object.keys(changed).length) { onClose(); return; }
    onUndo('Cambios guardados', applyPatch([t], () => changed)); onClose();
  };
  return <Drawer title="Tarea" onClose={onClose} width="w-[480px]" footer={<>
    <Button onClick={onClose}>Cerrar</Button>
    <Button onClick={() => { onUndo(done ? 'Tarea reabierta' : 'Tarea completada', applyPatch([t], () => ({ hs_task_status: done ? 'NOT_STARTED' : 'COMPLETED' }))); onClose(); }}>{done ? 'Reabrir' : 'Completar'}</Button>
    <Button variant="primary" onClick={save}>Guardar</Button></>}>
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-sky/60 px-3 py-2.5 text-[13.5px]">
      <span className="text-slate">{target ? 'Asociada a' : 'Sin registro asociado'}</span><TargetLink target={target} />
      {target && <Link to={target.path} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-navy px-3 py-1 text-[13px] font-semibold text-white hover:bg-navy-700">Ir a {target.kind === 'contacts' ? 'contacto' : target.kind === 'appointments' ? 'la cita' : target.kind === 'deals' ? 'negocio' : 'empresa'}<Icon n="chevR" s={14} /></Link>}
    </div>
    <Field label="Título"><Input value={cur.subject} onChange={e => set('subject')(e.target.value)} /></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Vencimiento (hora del portal)"><Input type="datetime-local" value={cur.due} onChange={e => set('due')(e.target.value)} /></Field>
      <Field label="Asignado a"><Select value={cur.owner} onChange={e => set('owner')(e.target.value)}><option value="">Sin propietario</option>{ownerOptions()}</Select></Field>
      <Field label="Prioridad"><Select value={cur.prio} onChange={e => set('prio')(e.target.value)}>{PRIO_ORDER.map(x => <option key={x} value={x}>{PRIO_LABEL[x]}</option>)}</Select></Field>
      <Field label="Tipo"><Select value={cur.type} onChange={e => set('type')(e.target.value)}>{[...new Set([...Object.keys(TYPE_LABEL), cur.type])].map(x => <option key={x} value={x}>{TYPE_LABEL[x] ?? x}</option>)}</Select></Field>
      <Field label="Estado"><Select value={cur.status} onChange={e => set('status')(e.target.value)}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
    </div>
    <Field label="Notas"><Textarea rows={5} value={cur.body} onChange={e => set('body')(e.target.value)} /></Field>
    <Link to={`/tasks/${t.id}`} className="text-[13px] font-semibold text-link hover:underline">Abrir la ficha completa de la tarea</Link>
  </Drawer>;
}

export function NewTaskModal({ defaultOwner, onClose, onCreated }: { defaultOwner: string; onClose: () => void; onCreated: (t: Rec) => void }) {
  const toast = useToast(); const tomorrow9 = keyToMs(addDaysKey(dayKey(Date.now()), 1), 9, 0);
  const [f, setF] = useState({ subject: '', contact: null as string | null, due: toInput(tomorrow9), prio: 'MEDIUM', type: 'TODO', owner: defaultOwner, body: '' }); const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.subject.trim()) return setErr('Indica el título de la tarea.');
    const ms = fromInput(f.due); const rec = crm.create('tasks', { hs_task_subject: f.subject.trim(), hs_task_body: f.body.trim() || null, hs_task_type: f.type, hs_task_priority: f.prio, hs_timestamp: ms != null ? new Date(ms).toISOString() : null, hubspot_owner_id: f.owner || null }, f.contact ? [{ to: 'contacts', id: f.contact }] : undefined);
    toast('Tarea creada'); onCreated(rec); onClose();
  };
  return <Modal title="Nueva tarea" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Crear tarea</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <Field label="Título de la tarea"><Input autoFocus value={f.subject} onChange={e => set('subject')(e.target.value)} placeholder="Ej.: Llamar para confirmar la cita" /></Field>
    <Field label="Contacto asociado" hint="Opcional. Desde la ficha del contacto la tarea queda asociada automáticamente."><RecordPicker obj="contacts" value={f.contact} onChange={set('contact')} placeholder="Buscar contacto por nombre, correo o teléfono" /></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Vencimiento (hora del portal)"><Input type="datetime-local" value={f.due} onChange={e => set('due')(e.target.value)} /></Field>
      <Field label="Asignado a"><Select value={f.owner} onChange={e => set('owner')(e.target.value)}><option value="">Sin propietario</option>{ownerOptions()}</Select></Field>
      <Field label="Prioridad"><Select value={f.prio} onChange={e => set('prio')(e.target.value)}>{PRIO_ORDER.map(x => <option key={x} value={x}>{PRIO_LABEL[x]}</option>)}</Select></Field>
      <Field label="Tipo"><Select value={f.type} onChange={e => set('type')(e.target.value)}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
    </div>
    <Field label="Notas"><Textarea rows={3} value={f.body} onChange={e => set('body')(e.target.value)} /></Field>
  </Modal>;
}
