// Desarrollo → Aplicaciones → pestaña Webhooks, al estilo Nexa: objeto + evento + propiedad(es) de forma guiada.
import { useEffect, useId, useMemo, useState } from 'react';
import { OBJECTS, allProps, propLabel, propDef } from '../../lib/schema';
import type { AppDef, ObjKey } from '../../lib/types';
import { createSubs, deleteSub, loadSubs, patchSub, saveTargetUrl, sendTest, subsErrText, type Sub } from '../../lib/subs';
import Icon from '../../components/Icon';
import { Button, Card, Checkbox, Drawer, Empty, Field, IconButton, Input, Modal, Pill, Switch, cx, useCopy, useToast } from '../../components/ui';

type Evt = Sub['event'];
const OBJ_KEYS = Object.keys(OBJECTS) as ObjKey[];
const API_SINGULAR: Record<ObjKey, string> = { contacts: 'contact', companies: 'company', deals: 'deal', appointments: 'appointment', tasks: 'task', calls: 'call', notes: 'note', meetings: 'meeting', tickets: 'ticket', leads: 'lead', communications: 'communication', products: 'product', line_items: 'line_item', quotes: 'quote', invoices: 'invoice' };
export const subType = (o: ObjKey, e: Evt) => `${API_SINGULAR[o]}.${e}`;
const EVENTS: { id: Evt; label: string; desc: string }[] = [
  { id: 'creation', label: 'Creado', desc: 'Se crea un registro nuevo (formulario, importación, API o manualmente).' },
  { id: 'propertyChange', label: 'Propiedad cambiada', desc: 'El valor de una propiedad cambia. Si el valor es el mismo, no se envía nada.' },
  { id: 'deletion', label: 'Eliminado', desc: 'Se elimina (archiva) un registro, uno a uno o en lote.' },
  { id: 'associationChange', label: 'Asociación cambiada', desc: 'Se asocia o se desasocia con otro registro (se avisa por ambos lados).' },
];
const evLabel = (e: Evt) => EVENTS.find(x => x.id === e)!.label;
const TYPE_ES: Record<string, string> = { string: 'Texto', number: 'Número', enumeration: 'Lista', date: 'Fecha', datetime: 'Fecha y hora', bool: 'Sí/No', phone_number: 'Teléfono', json: 'JSON' };
const propType = (o: ObjKey, n: string) => TYPE_ES[propDef(o, n)?.type ?? 'string'] ?? 'Texto';

/** Ejemplo del cuerpo que recibirá la URL (array JSON, como Nexa). */
export function samplePayload(app: AppDef, o: ObjKey, e: Evt, o2: { property?: string; anyProperty?: boolean; valueEquals?: string; subscriptionId?: number | string }) {
  const prop = o2.property ?? (o2.anyProperty ? 'hs_lead_status' : '<propiedad>');
  const opt = o2.property ? propDef(o, o2.property)?.options?.find(x => !x.hidden) : undefined;
  return [{
    eventId: 1234567890123, subscriptionId: Number(o2.subscriptionId) || 1, portalId: 1, appId: Number(app.id) || 1, occurredAt: Date.now(), subscriptionType: subType(o, e), attemptNumber: 0,
    objectId: 566814151407, objectTypeId: OBJECTS[o].typeId,
    ...(e === 'propertyChange' ? { propertyName: prop, propertyValue: o2.valueEquals ?? opt?.value ?? 'Valor de ejemplo' } : {}),
    ...(e === 'associationChange' ? { associatedObjectType: 'companies', associatedObjectTypeId: '0-2', associatedObjectId: 98765432100, associationRemoved: false } : {}),
    changeSource: 'CRM_UI', sourceId: '1', isSensitive: false,
  }];
}
const Code = ({ children, className }: { children: React.ReactNode; className?: string }) => <code className={cx('rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]', className)}>{children}</code>;
const Pre = ({ children, label }: { children: string; label: string }) => <pre tabIndex={0} aria-label={label} className="scroll-thin max-h-72 overflow-auto rounded-xl bg-navy-900 p-3 font-mono text-[12px] leading-5 text-[#cfe8ff]">{children}</pre>;

/* ───────────── Confirmación accesible ───────────── */
function Confirm({ title, children, confirmLabel, onConfirm, onClose }: { title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return <Modal title={title} width="max-w-md" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></>}><div className="text-[13.5px] text-ink">{children}</div></Modal>;
}

/* ───────────── Asistente: Crear suscripción ───────────── */
const STEPS = ['Objeto', 'Evento', 'Propiedades', 'Revisar'];
function CreateSub({ app, onClose, onDone }: { app: AppDef; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const uid = useId();
  const [step, setStep] = useState(0); const [obj, setObj] = useState<ObjKey>('contacts'); const [evt, setEvt] = useState<Evt>('propertyChange');
  const [mode, setMode] = useState<'some' | 'any'>('some'); const [props, setProps] = useState<string[]>([]); const [q, setQ] = useState(''); const [oq, setOq] = useState('');
  const [useEq, setUseEq] = useState(false); const [eq, setEq] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const needsProps = evt === 'propertyChange';
  const steps = needsProps ? STEPS : STEPS.filter(s => s !== 'Propiedades');
  const cur = steps[step];
  const objs = OBJ_KEYS.filter(o => { const t = oq.trim().toLowerCase(); return !t || OBJECTS[o].plural.toLowerCase().includes(t) || OBJECTS[o].singular.includes(t) || o.includes(t) || API_SINGULAR[o].includes(t); });
  const all = useMemo(() => allProps(obj).filter(p => !p.hidden), [obj]);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); const hit = all.filter(p => !t || p.name.toLowerCase().replace(/_/g, ' ').includes(t.replace(/_/g, ' ')) || propLabel(obj, p.name).toLowerCase().includes(t));
    const rank = (n: string) => { const l = propLabel(obj, n).toLowerCase(); return n.toLowerCase() === t || l === t ? 0 : n.toLowerCase().startsWith(t) || l.startsWith(t) ? 1 : 2; };
    return t ? [...hit].sort((x, y) => rank(x.name) - rank(y.name)) : hit; }, [all, q, obj]);
  const first = props[0]; const eqOpts = first ? propDef(obj, first)?.options?.filter(o => !o.hidden) : undefined;
  const eqValue = useEq && mode === 'some' && props.length === 1 && eq.trim() ? eq.trim() : undefined;
  const plan = needsProps ? (mode === 'any' ? 1 : props.length) : 1;
  const dups = useMemo(() => app.subs.filter(s => s.objectType === obj && s.event === evt && (!needsProps ? true : mode === 'any' ? !!s.anyProperty : props.includes(s.property ?? '') && (s.valueEquals ?? '') === (eqValue ?? ''))), [app.subs, obj, evt, needsProps, mode, props, eqValue]);
  const payload = samplePayload(app, obj, evt, { property: mode === 'some' ? first : undefined, anyProperty: mode === 'any', valueEquals: eqValue });
  const toggle = (n: string) => setProps(p => (p.includes(n) ? p.filter(x => x !== n) : [...p, n]));
  const valid = (c: string) => c !== 'Propiedades' || mode === 'any' || props.length > 0;
  const next = () => { if (!valid(cur)) return setErr('Elige al menos una propiedad o "Cualquier propiedad".'); setErr(''); setStep(s => Math.min(s + 1, steps.length - 1)); };
  const submit = async () => {
    if (needsProps && !valid('Propiedades')) { setStep(steps.indexOf('Propiedades')); return setErr('Elige al menos una propiedad.'); }
    setBusy(true); setErr('');
    try {
      const r = await createSubs(app, { objectType: obj, event: evt, ...(needsProps ? (mode === 'any' ? { anyProperty: true } : { properties: props, valueEquals: eqValue }) : {}) });
      if (r.created.length) toast(r.created.length === 1 ? 'Suscripción creada' : `${r.created.length} suscripciones creadas`);
      if (r.duplicates.length) toast(`${r.duplicates.length} ya existía${r.duplicates.length > 1 ? 'n' : ''} y no se duplicó${r.duplicates.length > 1 ? 'aron' : ''}`, r.created.length ? 'ok' : 'err');
      if (r.created.length) onDone(); else setBusy(false);
    } catch (e) { setErr(subsErrText(e)); setBusy(false); }
  };
  useEffect(() => { setProps([]); setUseEq(false); setEq(''); }, [obj]);
  useEffect(() => { setErr(''); }, [props, mode, evt]);
  useEffect(() => { if (props.length !== 1) { setUseEq(false); setEq(''); } }, [props.length]);
  const last = step === steps.length - 1;
  return <Modal title="Crear suscripción a eventos" width="max-w-5xl" onClose={onClose}
    footer={<><Button onClick={onClose}>Cancelar</Button>{step > 0 && <Button onClick={() => { setErr(''); setStep(s => s - 1); }}>Atrás</Button>}{last ? <Button variant="primary" disabled={busy || (dups.length > 0 && dups.length >= plan)} onClick={submit}>{busy ? 'Creando…' : plan > 1 ? `Crear ${plan} suscripciones` : 'Crear suscripción'}</Button> : <Button variant="primary" onClick={next}>Siguiente</Button>}</>}>
    <ol className="mb-4 flex flex-wrap gap-2 text-[12.5px]" aria-label="Pasos">{steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold', i === step ? 'bg-navy text-white' : i < step ? 'bg-[#E6F4EC] text-[#00704A]' : 'bg-canvas text-slate')}><span className="tabular">{i + 1}</span>{s}</li>)}</ol>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 lg:min-h-[420px]">
        {cur === 'Objeto' && <fieldset><legend className="mb-2 text-[13.5px] font-bold text-navy">¿De qué objeto quieres recibir eventos?</legend>
          <Input value={oq} onChange={e => setOq(e.target.value)} placeholder="Buscar objeto (ej.: contactos, tickets…)" aria-label="Buscar objeto" className="mb-2" />
          <div role="radiogroup" aria-label="Objeto" className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{objs.map(o => <button key={o} type="button" role="radio" aria-checked={obj === o} onClick={() => setObj(o)} className={cx('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13.5px] focus-visible:outline-2 focus-visible:outline-link', obj === o ? 'border-brand bg-sky font-semibold text-navy' : 'border-line hover:border-line-2')}><Icon n={OBJECTS[o].icon} s={16} className="shrink-0 text-slate" /><span className="min-w-0"><span className="block truncate">{OBJECTS[o].plural}</span><span className="block truncate font-mono text-[11px] font-normal text-mute">{API_SINGULAR[o]}.*</span></span></button>)}{objs.length === 0 && <p className="col-span-full py-6 text-center text-[13px] text-slate">Ningún objeto coincide con la búsqueda.</p>}</div></fieldset>}
        {cur === 'Evento' && <fieldset><legend className="mb-2 text-[13.5px] font-bold text-navy">¿Cuándo debe avisar el CRM? <span className="font-normal text-slate">({OBJECTS[obj].plural})</span></legend>
          <div role="radiogroup" aria-label="Evento" className="grid gap-2 sm:grid-cols-2">{EVENTS.map(e => <button key={e.id} type="button" role="radio" aria-checked={evt === e.id} onClick={() => setEvt(e.id)} className={cx('cursor-pointer rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-link', evt === e.id ? 'border-brand bg-sky' : 'border-line hover:border-line-2')}><span className="block text-[14px] font-semibold text-navy">{e.label}</span><span className="mt-0.5 block text-[12.5px] text-slate">{e.desc}</span><span className="mt-1 block font-mono text-[11.5px] text-mute">{subType(obj, e.id)}</span></button>)}</div></fieldset>}
        {cur === 'Propiedades' && <fieldset><legend className="mb-2 text-[13.5px] font-bold text-navy">¿Qué propiedad(es) de {OBJECTS[obj].plural.toLowerCase()} vigilar?</legend>
          <div role="radiogroup" aria-label="Alcance" className="mb-3 flex flex-wrap gap-2">{([['some', 'Propiedades concretas (recomendado)'], ['any', 'Cualquier propiedad']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cx('cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-link', mode === v ? 'border-brand bg-sky text-navy' : 'border-line text-slate hover:border-line-2')}>{l}</button>)}</div>
          {mode === 'any' ? <div className="rounded-xl border border-[#F3D98B] bg-[#FFF8E1] px-3 py-2.5 text-[13px]"><b>Cuidado con el ruido:</b> recibirás un evento por cada propiedad que cambie en cualquier registro. No incluye los valores iniciales al crear (ya llegan en «Creado») ni propiedades que el CRM recalcula solo (<Code>notes_last_updated</Code>, <Code>hs_lastmodifieddate</Code>). Para flujos de n8n casi siempre conviene elegir propiedades concretas.</div> : <>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o etiqueta (ej.: estado, hs_lead_status)" aria-label="Buscar propiedades" className="mb-2" />
            {props.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Propiedades elegidas">{props.map(n => <span key={n} className="inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[12px] font-semibold text-white">{propLabel(obj, n)}<button type="button" aria-label={`Quitar ${propLabel(obj, n)}`} onClick={() => toggle(n)} className="cursor-pointer rounded-full hover:bg-white/20"><Icon n="x" s={12} /></button></span>)}</div>}
            <div className="scroll-thin max-h-64 overflow-auto rounded-xl border border-line" role="group" aria-label="Lista de propiedades">{list.slice(0, 150).map(p => <div key={p.name} className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5 last:border-b-0 hover:bg-sky/50"><Checkbox checked={props.includes(p.name)} onChange={() => toggle(p.name)} aria={`${propLabel(obj, p.name)} (${p.name})`} /><button type="button" tabIndex={-1} onClick={() => toggle(p.name)} className="min-w-0 flex-1 cursor-pointer text-left"><span className="block truncate text-[13.5px] text-ink">{propLabel(obj, p.name)}</span><span className="block truncate font-mono text-[11px] text-mute">{p.name}</span></button><Pill>{propType(obj, p.name)}</Pill></div>)}{list.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-slate">Sin resultados. Las propiedades personalizadas se crean en Configuración → Propiedades.</p>}{list.length > 150 && <p className="px-3 py-2 text-center text-[12px] text-slate">Mostrando 150 de {list.length}. Afina la búsqueda.</p>}</div>
            <p className="mt-1.5 text-[12px] text-slate">Con varias propiedades se crea <b>una suscripción por propiedad</b>.</p>
            {props.length === 1 && <div className="mt-3 rounded-xl border border-line p-3"><Checkbox checked={useEq} onChange={setUseEq} label="Solo cuando la propiedad pase a un valor concreto" />{useEq && <div className="mt-2">{eqOpts?.length ? <select aria-label="Valor" value={eq} onChange={e => setEq(e.target.value)} className="h-9 w-full rounded-lg border border-line-2 bg-white px-3 text-sm"><option value="">Elige un valor…</option>{eqOpts.map(o => <option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}</select> : <Input aria-label="Valor" value={eq} onChange={e => setEq(e.target.value)} placeholder="Valor exacto, p. ej.: Sale" />}<p className="mt-1 text-[12px] text-slate">Se compara con el valor nuevo, letra por letra.</p></div>}</div>}</>}
        </fieldset>}
        {cur === 'Revisar' && <div className="space-y-3 text-[13.5px]">
          <h3 className="text-[13.5px] font-bold text-navy">Resumen</h3>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5"><dt className="text-slate">Objeto</dt><dd className="font-semibold">{OBJECTS[obj].plural}</dd><dt className="text-slate">Evento</dt><dd className="font-semibold">{evLabel(evt)}</dd>
            {needsProps && <><dt className="text-slate">Propiedades</dt><dd className="font-semibold">{mode === 'any' ? 'Cualquier propiedad' : props.map(n => propLabel(obj, n)).join(', ')}{eqValue && <span className="font-normal text-slate"> · solo cuando pase a «{eqValue}»</span>}</dd></>}
            <dt className="text-slate">Tipo</dt><dd><Code>{subType(obj, evt)}</Code></dd><dt className="text-slate">Se crearán</dt><dd className="font-semibold">{plan} suscripci{plan === 1 ? 'ón' : 'ones'}</dd></dl>
          {dups.length > 0 && <p role="alert" className="rounded-lg bg-[#FFF8E1] px-3 py-2 text-[13px] text-ink"><b>Ya existe{dups.length > 1 ? 'n' : ''} {dups.length}</b> suscripci{dups.length > 1 ? 'ones iguales' : 'ón igual'} en esta aplicación{dups.length >= plan ? ': no hay nada nuevo que crear.' : '; esas no se duplicarán.'}</p>}
          {!app.targetUrl ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-bad">Esta aplicación aún no tiene <b>URL de destino</b>. Guárdala arriba (https) para que los eventos se entreguen.</p> : <p className="text-[12.5px] text-slate">Los eventos se enviarán por <Code>POST</Code> a <b className="break-all">{app.targetUrl}</b> con la firma <Code>X-CRM-Signature-V3</Code>.</p>}
        </div>}
      </div>
      <aside aria-labelledby={uid + 'p'} className="min-w-0"><h3 id={uid + 'p'} className="mb-1 text-[13px] font-bold text-navy">Ejemplo de lo que recibirá tu URL</h3>
        <p className="mb-1.5 text-[12px] text-slate">Tipo de suscripción: <Code>{subType(obj, evt)}</Code></p>
        <Pre label="Ejemplo de cuerpo JSON">{JSON.stringify(payload, null, 2)}</Pre></aside>
    </div></Modal>;
}

/* ───────────── Editar ───────────── */
function EditSub({ app, sub, onClose }: { app: AppDef; sub: Sub; onClose: () => void }) {
  const toast = useToast(); const o = sub.objectType; const isProp = sub.event === 'propertyChange';
  const [mode, setMode] = useState<'some' | 'any'>(sub.anyProperty ? 'any' : 'some'); const [prop, setProp] = useState(sub.property ?? ''); const [eq, setEq] = useState(sub.valueEquals ?? ''); const [q, setQ] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return allProps(o).filter(p => !p.hidden && (!t || p.name.toLowerCase().replace(/_/g, ' ').includes(t.replace(/_/g, ' ')) || propLabel(o, p.name).toLowerCase().includes(t))).slice(0, 100); }, [q, o]);
  const save = async () => {
    if (isProp && mode === 'some' && !prop) return setErr('Elige una propiedad.');
    setBusy(true);
    try { await patchSub(app, sub.id, mode === 'any' ? { anyProperty: true, valueEquals: null } : { property: prop, valueEquals: eq.trim() || null }); toast('Suscripción actualizada'); onClose(); } catch (e) { setErr(subsErrText(e)); setBusy(false); }
  };
  return <Modal title="Editar suscripción" width="max-w-lg" onClose={onClose} footer={<><Button onClick={onClose}>{isProp ? 'Cancelar' : 'Cerrar'}</Button>{isProp && <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</Button>}</>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <p className="mb-3 text-[13.5px]">{OBJECTS[o].plural} · <b>{evLabel(sub.event)}</b> · <Code>{subType(o, sub.event)}</Code></p>
    {!isProp ? <p className="text-[13px] text-slate">Este evento no tiene propiedades que editar. Puedes pausarlo con el interruptor o eliminarlo.</p> : <>
      <div role="radiogroup" aria-label="Alcance" className="mb-3 flex flex-wrap gap-2">{([['some', 'Propiedad concreta'], ['any', 'Cualquier propiedad']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cx('cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-semibold', mode === v ? 'border-brand bg-sky text-navy' : 'border-line text-slate')}>{l}</button>)}</div>
      {mode === 'some' && <><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar propiedad" aria-label="Buscar propiedades" className="mb-2" />
        <div role="radiogroup" aria-label="Propiedad" className="scroll-thin mb-3 max-h-52 overflow-auto rounded-xl border border-line">{list.map(p => <button key={p.name} type="button" role="radio" aria-checked={prop === p.name} onClick={() => setProp(p.name)} className={cx('flex w-full cursor-pointer items-center justify-between gap-2 border-b border-line/60 px-3 py-1.5 text-left last:border-b-0 hover:bg-sky/50', prop === p.name && 'bg-sky font-semibold')}><span className="min-w-0"><span className="block truncate text-[13.5px]">{propLabel(o, p.name)}</span><span className="block truncate font-mono text-[11px] text-mute">{p.name}</span></span><Pill>{propType(o, p.name)}</Pill></button>)}</div>
        <Field label="Solo cuando pase a este valor (opcional)"><Input value={eq} onChange={e => setEq(e.target.value)} placeholder="Vacío = cualquier valor" /></Field></>}</>}
  </Modal>;
}

/* ───────────── Detalles + prueba ───────────── */
function Details({ app, sub, onClose, onEdit }: { app: AppDef; sub: Sub; onClose: () => void; onEdit: () => void }) {
  const toast = useToast(); const copy = useCopy(); const [busy, setBusy] = useState(false); const [res, setRes] = useState<string>('');
  const body = JSON.stringify(samplePayload(app, sub.objectType, sub.event, { property: sub.property, anyProperty: sub.anyProperty, valueEquals: sub.valueEquals, subscriptionId: sub.id }), null, 2);
  const test = async () => {
    setBusy(true); setRes('');
    try { const r = await sendTest(app, sub.id); setRes(r.simulated ? 'Modo demostración: prueba simulada, no se envió nada.' : r.ok ? `Entregado: tu URL respondió ${r.status} en ${r.ms} ms.` : `Falló: ${r.error ?? `HTTP ${r.status}`}`); if (r.ok) toast(r.simulated ? 'Prueba simulada' : 'Prueba entregada'); else toast('La prueba no se entregó', 'err'); }
    catch (e) { setRes(subsErrText(e)); toast('No se pudo enviar la prueba', 'err'); } finally { setBusy(false); }
  };
  return <Drawer title={subType(sub.objectType, sub.event)} width="w-[560px]" onClose={onClose} footer={<><Button onClick={onEdit}>Editar</Button><Button onClick={() => copy(`curl -X POST '${app.targetUrl || 'https://URL-DE-N8N'}' -H 'Content-Type: application/json' -d '${JSON.stringify(JSON.parse(body))}'`, 'cURL copiado (sin firma): sirve para probar el flujo a mano')}>Copiar cURL</Button><Button variant="primary" disabled={busy || !app.targetUrl} title={app.targetUrl ? undefined : 'Configura primero la URL de destino'} onClick={test}>{busy ? 'Enviando…' : 'Enviar prueba'}</Button></>}>
    <dl className="mb-4 grid grid-cols-3 gap-3 text-[13.5px]"><div><dt className="text-[12px] font-bold text-slate">Estado</dt><dd>{sub.active ? 'Activa' : 'En pausa'}</dd></div><div><dt className="text-[12px] font-bold text-slate">Envíos</dt><dd className="tabular">{sub.total.toLocaleString('es')}</dd></div><div><dt className="text-[12px] font-bold text-slate">Errores</dt><dd className={cx('tabular', sub.errors > 0 && 'font-semibold text-bad')}>{sub.errors}</dd></div></dl>
    {res && <p role="status" className="mb-3 rounded-lg bg-sky px-3 py-2 text-[13px] text-navy">{res}</p>}
    <h4 className="mb-1 text-[13px] font-bold text-navy">Ejemplo de lo que recibe tu URL</h4><Pre label="Ejemplo de cuerpo JSON">{body}</Pre>
    <p className="mt-2 text-[12.5px] text-slate">Cabeceras: <Code>X-CRM-Signature-V3</Code>, <Code>X-CRM-Signature-Version</Code> y <Code>X-CRM-Request-Timestamp</Code>. «Enviar prueba» manda un evento firmado de verdad (objeto 0, valor «TEST») a tu URL.</p></Drawer>;
}

/* ───────────── Pestaña completa ───────────── */
function Chips({ s }: { s: Sub }) {
  return <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-sky px-2.5 py-0.5 text-[12px] font-semibold text-navy">{evLabel(s.event)}</span>
    {s.event === 'propertyChange' && (s.anyProperty || !s.property ? <span className="rounded-full bg-[#FFF3D6] px-2.5 py-0.5 text-[12px] font-semibold text-[#8A5A00]">Cualquier propiedad</span> : <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[12px]" title={s.property}>{propLabel(s.objectType, s.property)} <span className="font-mono text-[11px] text-mute">{s.property}</span></span>)}
    {s.valueEquals && <span className="rounded-full bg-[#E6F4EC] px-2.5 py-0.5 text-[12px] font-semibold text-[#00704A]">= {s.valueEquals}</span>}</div>;
}
export default function AppWebhooks({ app }: { app: AppDef }) {
  const toast = useToast(); const copy = useCopy(); const [url, setUrl] = useState(app.targetUrl); const [add, setAdd] = useState(false); const [detail, setDetail] = useState<string | null>(null); const [edit, setEdit] = useState<string | null>(null); const [del, setDel] = useState<Sub | null>(null); const [filter, setFilter] = useState('');
  useEffect(() => { void loadSubs(app.id); }, [app.id]);
  useEffect(() => { setUrl(app.targetUrl); }, [app.targetUrl]);
  const urlBad = url.trim() !== '' && url !== app.targetUrl && !/^https:\/\//i.test(url.trim());
  const shown = app.subs.filter(s => { const t = filter.trim().toLowerCase(); return !t || subType(s.objectType, s.event).includes(t) || (s.property ?? '').toLowerCase().includes(t) || OBJECTS[s.objectType].plural.toLowerCase().includes(t) || propLabel(s.objectType, s.property ?? '').toLowerCase().includes(t); });
  const groups = useMemo(() => { const m = new Map<ObjKey, Sub[]>(); OBJ_KEYS.forEach(o => { const l = shown.filter(s => s.objectType === o); if (l.length) m.set(o, l); }); return [...m.entries()]; }, [shown]);
  const detailSub = app.subs.find(s => s.id === detail) ?? null, editSub = app.subs.find(s => s.id === edit) ?? null;
  const toggleSub = (s: Sub, v: boolean) => patchSub(app, s.id, { active: v }).then(() => toast(v ? 'Suscripción activada' : 'Suscripción pausada'), e => toast(subsErrText(e), 'err'));
  return <div className="max-w-5xl space-y-4">
    <Card title="URL de destino" action={<Button size="sm" variant="primary" disabled={url === app.targetUrl || urlBad} onClick={() => { void saveTargetUrl(app, url.trim()); toast('URL guardada'); }}>Guardar</Button>}>
      <div className="flex flex-wrap items-center gap-3"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/mi-flujo" aria-label="URL de destino" aria-invalid={urlBad} className="!max-w-xl flex-1" /><Button onClick={() => copy(url, 'URL copiada')} disabled={!url}>Copiar</Button><span className="text-[13px] text-slate">Entregas simultáneas: <b>{app.throttle}</b></span></div>
      {urlBad && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-bad">La URL debe empezar con https:// (por seguridad no se permiten http ni direcciones internas).</p>}
      <p className="mt-2 text-[12.5px] text-slate">Cada evento se envía con <Code>POST</Code> y un arreglo JSON. Verifica la firma con la cabecera <Code>X-CRM-Signature-V3</Code> (HMAC-SHA256 con el secreto del cliente de esta aplicación, sobre <Code>POST + URL + cuerpo + marca de tiempo</Code>) y <Code>X-CRM-Request-Timestamp</Code>. Hasta 5 intentos con espera creciente si tu URL no responde 2xx.</p></Card>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-[17px] font-bold text-navy">Suscripciones a eventos <span className="text-[13px] font-normal text-slate">({app.subs.length})</span></h3>
      <div className="flex flex-wrap items-center gap-2">{app.subs.length > 5 && <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar suscripciones" aria-label="Filtrar suscripciones" className="!w-52" />}<Button icon="plus" variant="primary" onClick={() => setAdd(true)}>Crear suscripción</Button></div></div>
    {app.subs.length === 0 && <Empty icon="bolt" title="Sin suscripciones">Crea una para que el CRM avise a n8n cuando se cree, cambie o elimine algo.</Empty>}
    {groups.map(([o, subs]) => <Card key={o} pad={false} title={<span className="flex flex-wrap items-center gap-2">{OBJECTS[o].plural}<Pill color="bg-[#E6F4EC] text-[#00704A]">Activas {subs.filter(s => s.active).length}/{subs.length}</Pill>{subs.some(s => !s.active) && <Pill color="bg-line text-slate">En pausa {subs.filter(s => !s.active).length}</Pill>}</span>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13.5px]"><caption className="sr-only">Suscripciones de {OBJECTS[o].plural}</caption><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th scope="col" className="px-4 py-2">Evento</th><th scope="col">Tipo de suscripción</th><th scope="col" className="text-right">Envíos</th><th scope="col" className="text-right">Errores</th><th scope="col" className="pr-4 text-right">Acciones</th></tr></thead>
        <tbody>{subs.map(s => <tr key={s.id} className={cx('border-b border-line/70', !s.active && 'bg-canvas/50')}><td className="px-4 py-2.5"><Chips s={s} /></td><td><Code>{subType(s.objectType, s.event)}</Code></td><td className="text-right tabular">{s.total.toLocaleString('es')}</td><td className={cx('text-right tabular', s.errors > 0 && 'font-semibold text-bad')}>{s.errors}</td>
          <td className="pr-4"><div className="flex items-center justify-end gap-2"><Switch on={s.active} onChange={v => void toggleSub(s, v)} label={`${s.active ? 'Pausar' : 'Activar'} ${subType(s.objectType, s.event)}${s.property ? ' · ' + s.property : ''}`} /><Button size="sm" variant="ghost" onClick={() => setDetail(s.id)}>Detalles</Button><IconButton n="edit" label="Editar suscripción" className="!h-7 !w-7" onClick={() => setEdit(s.id)} /><IconButton n="trash" label="Eliminar suscripción" className="!h-7 !w-7" onClick={() => setDel(s)} /></div></td></tr>)}</tbody></table></div></Card>)}
    {app.subs.length > 0 && groups.length === 0 && <p className="py-6 text-center text-[13px] text-slate">Ninguna suscripción coincide con el filtro.</p>}
    {add && <CreateSub app={app} onClose={() => setAdd(false)} onDone={() => setAdd(false)} />}
    {detailSub && <Details app={app} sub={detailSub} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); setEdit(detailSub.id); }} />}
    {editSub && <EditSub app={app} sub={editSub} onClose={() => setEdit(null)} />}
    {del && <Confirm title="Eliminar suscripción" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { const s = del; setDel(null); deleteSub(app, s.id).then(() => toast('Suscripción eliminada'), e => toast(subsErrText(e), 'err')); }}>
      <p>Dejarás de recibir <Code>{subType(del.objectType, del.event)}</Code>{del.property ? <> de <b>{propLabel(del.objectType, del.property)}</b></> : del.anyProperty ? ' de cualquier propiedad' : ''} en <b className="break-all">{app.targetUrl || 'tu URL'}</b>. Se pierde su contador ({del.total.toLocaleString('es')} envíos). Puedes volver a crearla cuando quieras.</p></Confirm>}
  </div>;
}

/* ───────────── Plantilla n8n para la pestaña Documentación ───────────── */
export function WebhookN8nTemplate() {
  const copy = useCopy();
  const code = `// Nodo Code de n8n, justo después del Webhook (Options → Raw Body activado).
// En el servidor de n8n: NODE_FUNCTION_ALLOW_BUILTIN=crypto. El secreto va en una variable/credencial, nunca pegado aquí.
const crypto = require('crypto');
const SECRET = $env.CRM_CLIENT_SECRET;                 // Autenticación → «Mostrar secreto» de la aplicación
const TARGET_URL = 'https://n8n.example.com/webhook/mi-flujo'; // EXACTAMENTE la «URL de destino» guardada en la aplicación
const item = $input.first();
const h = item.json.headers;
const raw = item.binary?.data ? Buffer.from(item.binary.data.data, 'base64').toString('utf8') : JSON.stringify(item.json.body);
const ts = h['x-crm-request-timestamp'];
const expected = crypto.createHmac('sha256', SECRET).update('POST' + TARGET_URL + raw + ts).digest('base64');
const got = h['x-crm-signature-v3'] || '';
const ok = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)) && Math.abs(Date.now() - Number(ts)) < 5 * 60 * 1000;
if (!ok) throw new Error('Firma X-CRM-Signature-V3 inválida');
const events = Array.isArray(item.json.body) ? item.json.body : JSON.parse(raw);
// Un item por evento. Campos: eventId, subscriptionType (p. ej. contact.propertyChange), objectId, propertyName, propertyValue, changeSource, occurredAt, attemptNumber
// Idempotencia: un reintento trae el MISMO eventId; deduplica por ese valor.
return events.map(e => ({ json: e }));`;
  return <Card title="Plantilla para n8n: recibir y verificar webhooks" action={<Button size="sm" onClick={() => copy(code, 'Plantilla copiada')}>Copiar</Button>}>
    <p className="mb-2 text-[13px] text-slate">Crea la suscripción en <b>Aplicaciones → tu aplicación → Webhooks → Crear suscripción</b> (por ejemplo, Contactos · Propiedad cambiada · «Estado del lead»), pega la URL del nodo Webhook de n8n y usa este código.</p>
    <Pre label="Plantilla de nodo Code para n8n">{code}</Pre></Card>;
}
