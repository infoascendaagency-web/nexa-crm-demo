import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crm } from '../lib/api';
import { ME, OBJECTS, PIPELINES, propLabel, type PipeObj } from '../lib/schema';
import type { ObjKey } from '../lib/types';
import PropertyInput from './PropertyInput';
import RecordPicker from './RecordPicker';
import { Button, Field, Modal, useToast } from './ui';

const REQUIRED: Partial<Record<ObjKey, string[]>> = { contacts: [], companies: ['name'], deals: ['dealname'], appointments: ['hs_appointment_name', 'hs_appointment_start'], tasks: ['hs_task_subject'] };

export default function CreateRecord({ obj, onClose, presets, assocTo, onCreated }: { obj: ObjKey; onClose: () => void; presets?: Record<string, string | null>; assocTo?: { obj: ObjKey; id: string }; onCreated?: (id: string) => void }) {
  const cfg = OBJECTS[obj]; const nav = useNavigate(); const toast = useToast();
  const pp = cfg.pipelineProp ? { pipeline: cfg.pipelineProp, stage: cfg.stageProp! } : null;
  const [p, setP] = useState<Record<string, string | null>>({ hubspot_owner_id: ME.id, ...(pp ? { [pp.pipeline]: PIPELINES[obj as PipeObj][0].id, [pp.stage]: PIPELINES[obj as PipeObj][0].stages[0].id } : {}), ...presets });
  const [contact, setContact] = useState<string | null>(assocTo?.obj === 'contacts' ? assocTo.id : null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fields = [...cfg.createFields, ...(pp ? [pp.pipeline, pp.stage] : [])].filter((f, i, a) => a.indexOf(f) === i);
  const save = async () => {
    if (busy) return;
    const miss = (REQUIRED[obj] ?? []).filter(k => !p[k]); if (miss.length) return setErr(`Completa: ${miss.map(k => propLabel(obj, k)).join(', ')}`);
    if (obj === 'contacts' && !p.email && !p.firstname && !p.mobilephone) return setErr('Indica al menos nombre, correo o móvil.');
    const assoc = [...(assocTo ? [{ to: assocTo.obj, id: assocTo.id }] : []), ...(contact && assocTo?.obj !== 'contacts' ? [{ to: 'contacts' as ObjKey, id: contact }] : [])];
    setBusy(true); let r; try { r = await crm.createAsync(obj, p, assoc); } catch { setBusy(false); return; } setBusy(false); toast(`${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} creado`); onCreated?.(r.id); onClose(); if (!onCreated) nav(`${cfg.path}/${r.id}`);
  };
  return <Modal title={`Crear ${cfg.singular}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Creando…' : 'Crear'}</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {fields.map(f => <Field key={f} label={propLabel(obj, f) + ((REQUIRED[obj] ?? []).includes(f) ? ' *' : '')}><PropertyInput obj={obj} name={f} value={p[f] ?? null} ctx={p} onChange={v => setP(s => { const n = { ...s, [f]: v }; if (pp && f === pp.pipeline) n[pp.stage] = PIPELINES[obj === 'deals' ? 'deals' : 'appointments'].find(x => x.id === v)?.stages[0].id ?? null; return n; })} /></Field>)}
    {(obj === 'appointments' || obj === 'tasks' || obj === 'deals') && assocTo?.obj !== 'contacts' && <Field label="Contacto asociado"><RecordPicker obj="contacts" value={contact} onChange={setContact} /></Field>}
  </Modal>;
}
