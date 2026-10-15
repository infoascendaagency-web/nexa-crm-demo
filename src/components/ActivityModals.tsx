import { useState } from 'react';
import { crm } from '../lib/api';
import { ME, OWNERS } from '../lib/schema';
import type { ObjKey } from '../lib/types';
import PropertyInput from './PropertyInput';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from './ui';

export type Activity = 'note' | 'email' | 'call' | 'task' | 'meeting';
type Parent = { obj: ObjKey; id: string; name: string; phone?: string | null; email?: string | null };

// Al crear una actividad sobre una cita, también se asocia al contacto de la cita (como hace n8n con las tareas).
function assocFor(p: Parent) { const a = [{ to: p.obj, id: p.id }]; if (p.obj === 'appointments') { const c = crm.firstAssoc('appointments', p.id, 'contacts'); if (c) a.push({ to: 'contacts', id: c.id }); } return a; }

export default function ActivityModal({ kind, parent, onClose }: { kind: Activity; parent: Parent; onClose: () => void }) {
  const toast = useToast(); const now = new Date().toISOString();
  const [p, setP] = useState<Record<string, string | null>>({ hubspot_owner_id: ME.id, hs_timestamp: now, hs_task_type: 'TODO', hs_task_priority: 'MEDIUM', hs_call_direction: 'OUTBOUND', hs_call_status: 'COMPLETED' });
  const [dur, setDur] = useState('0'); const [body, setBody] = useState(''); const [subject, setSubject] = useState(''); const [err, setErr] = useState('');
  const set = (k: string) => (v: string | null) => setP(s => ({ ...s, [k]: v }));
  const T = { note: 'Crear nota', email: 'Correo', call: 'Registrar llamada', task: 'Crear tarea', meeting: 'Programar reunión' }[kind];
  const save = () => {
    const assoc = assocFor(parent);
    if (kind === 'note') { if (!body.trim()) return setErr('Escribe la nota.'); crm.create('notes', { hs_note_body: body.trim(), hs_timestamp: new Date().toISOString(), hubspot_owner_id: ME.id }, assoc); toast('Nota creada'); }
    if (kind === 'email') { if (!subject.trim() || !body.trim()) return setErr('Indica asunto y mensaje.'); crm.create('notes', { hs_note_body: `✉️ Correo registrado — ${subject.trim()}\n${body.trim()}`, hs_timestamp: new Date().toISOString(), hubspot_owner_id: ME.id }, assoc); toast('Correo registrado en la línea de tiempo (el envío real se activa con el backend)'); }
    if (kind === 'task') { if (!p.hs_task_subject?.trim()) return setErr('Indica el título de la tarea.'); crm.create('tasks', { hs_task_subject: p.hs_task_subject, hs_task_body: body || null, hs_task_type: p.hs_task_type, hs_task_priority: p.hs_task_priority, hs_timestamp: p.hs_timestamp, hubspot_owner_id: p.hubspot_owner_id }, assoc); toast('Tarea creada'); }
    if (kind === 'call') { crm.create('calls', { hs_call_title: `${p.hs_call_direction === 'INBOUND' ? 'Call with' : 'Outbound call to'} ${parent.name}`, hs_timestamp: p.hs_timestamp, hs_call_direction: p.hs_call_direction, hs_call_status: p.hs_call_status, hs_call_disposition: p.hs_call_disposition ?? null, hs_call_duration: String(Number(dur) * 1000), hs_call_body: body || null, hubspot_owner_id: p.hubspot_owner_id }, assoc); crm.update(parent.obj, parent.id, parent.obj === 'contacts' ? { notes_last_contacted: new Date().toISOString() } : {}); toast('Llamada registrada'); }
    if (kind === 'meeting') { if (!p.hs_meeting_title?.trim()) return setErr('Indica el título.'); crm.create('meetings', { hs_meeting_title: p.hs_meeting_title, hs_timestamp: p.hs_timestamp, hs_meeting_body: body || null, hubspot_owner_id: p.hubspot_owner_id }, assoc); toast('Reunión programada'); }
    onClose();
  };
  return <Modal title={T} onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>{kind === 'call' ? 'Registrar llamada' : kind === 'email' ? 'Registrar correo' : 'Guardar'}</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {kind === 'note' && <Field label={`Nota sobre ${parent.name}`}><Textarea rows={6} autoFocus value={body} onChange={e => setBody(e.target.value)} placeholder="Empieza a escribir para dejar una nota…" /></Field>}
    {kind === 'email' && <><Field label="Para"><Input value={parent.email ?? ''} readOnly /></Field><Field label="Asunto"><Input value={subject} onChange={e => setSubject(e.target.value)} /></Field><Field label="Mensaje"><Textarea rows={6} value={body} onChange={e => setBody(e.target.value)} /></Field></>}
    {kind === 'task' && <><Field label="Título de la tarea"><Input autoFocus value={p.hs_task_subject ?? ''} onChange={e => set('hs_task_subject')(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Tipo"><PropertyInput obj="tasks" name="hs_task_type" value={p.hs_task_type} onChange={set('hs_task_type')} /></Field><Field label="Prioridad"><PropertyInput obj="tasks" name="hs_task_priority" value={p.hs_task_priority} onChange={set('hs_task_priority')} /></Field>
        <Field label="Fecha de vencimiento"><PropertyInput obj="tasks" name="hs_timestamp" value={p.hs_timestamp} onChange={set('hs_timestamp')} /></Field><Field label="Asignado a"><PropertyInput obj="tasks" name="hubspot_owner_id" value={p.hubspot_owner_id} onChange={set('hubspot_owner_id')} /></Field></div>
      <Field label="Notas"><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} /></Field></>}
    {kind === 'call' && <><div className="mb-3 flex items-center justify-between rounded-lg bg-sky px-3 py-2 text-[13px]"><span>Llamar a <b>{parent.phone ?? 'sin teléfono'}</b> con Dialpad</span><Button size="sm" variant="primary" disabled={!parent.phone} onClick={() => toast('La llamada con Dialpad se activa al conectar el backend')}>Llamar</Button></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Dirección"><Select value={p.hs_call_direction ?? ''} onChange={e => set('hs_call_direction')(e.target.value)}><option value="OUTBOUND">Saliente</option><option value="INBOUND">Entrante</option></Select></Field><Field label="Estado"><PropertyInput obj="calls" name="hs_call_status" value={p.hs_call_status} onChange={set('hs_call_status')} /></Field>
        <Field label="Resultado"><Select value={p.hs_call_disposition ?? ''} onChange={e => set('hs_call_disposition')(e.target.value || null)}><option value="">— Sin valor —</option>{['Connected', 'No answer', 'Left voicemail', 'Busy', 'Wrong number'].map(x => <option key={x}>{x}</option>)}</Select></Field><Field label="Duración (segundos)"><Input type="number" min={0} value={dur} onChange={e => setDur(e.target.value)} /></Field>
        <Field label="Fecha"><PropertyInput obj="calls" name="hs_timestamp" value={p.hs_timestamp} onChange={set('hs_timestamp')} /></Field><Field label="Actividad asignada a"><PropertyInput obj="calls" name="hubspot_owner_id" value={p.hubspot_owner_id} onChange={set('hubspot_owner_id')} /></Field></div>
      <Field label="Notas de la llamada"><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} /></Field></>}
    {kind === 'meeting' && <><Field label="Título"><Input autoFocus value={p.hs_meeting_title ?? ''} onChange={e => set('hs_meeting_title')(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Fecha y hora"><PropertyInput obj="calls" name="hs_timestamp" value={p.hs_timestamp} onChange={set('hs_timestamp')} /></Field><Field label="Organizador"><Select value={p.hubspot_owner_id ?? ''} onChange={e => set('hubspot_owner_id')(e.target.value)}>{OWNERS.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</Select></Field></div><Field label="Descripción"><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} /></Field></>}
  </Modal>;
}
