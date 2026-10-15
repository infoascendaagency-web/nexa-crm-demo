// Bandeja unificada de «Redes sociales»: chats completos de Facebook, Instagram, TikTok y WhatsApp, con filtros, hilo, nota interna,
// vínculo al contacto/lead del CRM, asignación y aprobación de borradores de IA.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/backend';
import { OWNERS } from '../../lib/schema';
import { Avatar, Badge, Button, Empty, Input, Select, Spinner, Textarea, cx, useToast } from '../../components/ui';
import { AI_STATE, PLATFORMS, platformLabel, when, type Platform } from './shared';

export type Conv = { id: number; kind: 'dm' | 'comment'; status: string; participantName: string; participantHandle?: string; unreadCount: number; lastMessagePreview: string; lastMessageAt: string; channel: Platform; accountName: string; contactId: string | null; contactName: string | null; assignedOwnerId: string | null; aiState: string; simulated: boolean };
type Msg = { id: number; direction: 'in' | 'out'; author: string; body: string; status: string; error?: string; isInternal: boolean; simulated: boolean; createdAt: string };
type Detail = { captured: Record<string, string>; aiState: string };
const PlatformDot = ({ p }: { p: Platform }) => { const x = PLATFORMS.find(i => i.id === p)!; return <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white', x.tone)} title={x.label}>{x.short}</span>; };

export default function Inbox({ connected, refreshKey = 0 }: { connected: boolean; refreshKey?: number }) {
  const toast = useToast();
  const [f, setF] = useState({ platform: '', status: 'open', assigned: '', kind: '', q: '' });
  const [list, setList] = useState<{ total: number; results: Conv[] } | null>(null);
  const [sel, setSel] = useState<Conv | null>(null); const [msgs, setMsgs] = useState<Msg[] | null>(null); const [det, setDet] = useState<Detail | null>(null);
  const [text, setText] = useState(''); const [internal, setInternal] = useState(false); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => {
    const p = new URLSearchParams({ limit: '60' }); (Object.entries(f) as [string, string][]).forEach(([k, v]) => { if (v.trim()) p.set(k, v.trim()); });
    api<{ total: number; results: Conv[] }>('GET', `/social/conversations?${p}`).then(setList).catch(() => setList({ total: 0, results: [] }));
  }, [f]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load, refreshKey]);
  const openThread = useCallback(async (c: Conv) => {
    const [m, d] = await Promise.all([api<{ results: Msg[] }>('GET', `/social/conversations/${c.id}/messages`).catch(() => ({ results: [] as Msg[] })), api<Detail>('GET', `/social/conversations/${c.id}`).catch(() => null)]);
    setMsgs(m.results); setDet(d); setTimeout(() => end.current?.scrollIntoView({ block: 'end' }), 30);
  }, []);
  useEffect(() => { setMsgs(null); setDet(null); if (!sel) return; void openThread(sel); api('PATCH', `/social/conversations/${sel.id}`, { markRead: true }).then(load).catch(() => {}); }, [sel?.id]); // eslint-disable-line
  const refresh = async () => { if (sel) await openThread(sel); load(); };
  const isSim = !!sel?.simulated;
  const send = async () => {
    if (!sel || !text.trim()) return; setBusy(true);
    try {
      await api('POST', internal ? `/social/conversations/${sel.id}/note` : `/social/conversations/${sel.id}/reply`, { body: text.trim() }); setText(''); await refresh();
    } catch (e) { toast(e instanceof ApiError && e.code === 'not_connected' ? 'No se puede enviar: la cuenta todavía no está conectada.' : 'No se pudo enviar', 'err'); } finally { setBusy(false); }
  };
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); await refresh(); } catch (e) { toast(e instanceof ApiError && e.code === 'send_failed' ? 'No se pudo enviar: la cuenta no está conectada.' : 'No se pudo completar la acción', 'err'); } };
  const approve = (m: Msg) => act(() => api('POST', `/social/conversations/${sel!.id}/messages/${m.id}/approve`, {}), 'Respuesta enviada');
  const discardDraft = (m: Msg) => act(() => api('POST', `/social/conversations/${sel!.id}/messages/${m.id}/discard`, {}));
  const edit = (m: Msg) => { setText(m.body); setInternal(false); void discardDraft(m); };
  const owner = (id: string | null) => OWNERS.find(o => o.id === id);

  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Select aria-label="Plataforma" value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })} className="!w-40"><option value="">Todas las redes</option>{PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
      <Select aria-label="Tipo" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} className="!w-40"><option value="">Mensajes y comentarios</option><option value="dm">Solo mensajes</option><option value="comment">Solo comentarios</option></Select>
      <Select aria-label="Estado" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="!w-36"><option value="open">Abiertas</option><option value="closed">Cerradas</option><option value="snoozed">Pospuestas</option><option value="">Todas</option></Select>
      <Select aria-label="Asignado a" value={f.assigned} onChange={e => setF({ ...f, assigned: e.target.value })} className="!w-44"><option value="">Cualquier responsable</option><option value="me">Asignadas a mí</option><option value="none">Sin asignar</option>{OWNERS.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</Select>
      <Input aria-label="Buscar conversaciones" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Buscar por nombre o texto" className="!w-56" />
    </div>
    <div className="grid min-h-[30rem] grid-cols-1 overflow-hidden rounded-xl border border-line bg-white md:grid-cols-[22rem_1fr]">
      <div className={cx('scroll-thin max-h-[calc(100vh-18rem)] overflow-auto border-line md:border-r', sel && 'hidden md:block')}>
        {!list ? <div className="grid place-items-center p-8"><Spinner /></div> : !list.results.length
          ? <Empty icon="chat" title="Sin conversaciones">Aquí aparecerán los mensajes y comentarios de Facebook, Instagram, TikTok y WhatsApp. Para probar sin conectar nada usa el simulador en la pestaña <b>Cuentas</b>.</Empty>
          : list.results.map(c => <button key={c.id} onClick={() => setSel(c)} className={cx('flex w-full cursor-pointer items-start gap-2.5 border-b border-line/70 px-3 py-2.5 text-left hover:bg-sky/40', sel?.id === c.id && 'bg-sky/60')}>
            <Avatar name={c.participantName || '?'} size={32} />
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><PlatformDot p={c.channel} /><span className="truncate text-[13.5px] font-bold text-navy">{c.participantName || c.participantHandle || 'Sin nombre'}</span></span><span className="shrink-0 text-[11px] text-slate">{when(c.lastMessageAt)}</span></span>
              <span className="block truncate text-[12.5px] text-slate">{c.lastMessagePreview || '—'}</span>
              <span className="mt-1 flex flex-wrap gap-1"><Badge>{c.kind === 'dm' ? 'Mensaje' : 'Comentario'}</Badge>{c.simulated && <Badge tone="Canceled">Simulado</Badge>}{c.contactId && <Badge tone="Sale">Lead en el CRM</Badge>}{c.aiState === 'draft_ready' && <Badge tone="Referral">Borrador IA</Badge>}{c.unreadCount > 0 && <Badge tone="Referral">{c.unreadCount} nuevos</Badge>}</span></span></button>)}
      </div>
      <div className={cx('flex min-w-0 flex-col', !sel && 'hidden md:flex')}>
        {!sel ? <div className="grid flex-1 place-items-center p-8"><Empty icon="chat" title="Elige una conversación">Verás el hilo completo, los datos del lead y podrás responder desde aquí.</Empty></div> : <>
          <div className="border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2"><button className="cursor-pointer text-[13px] font-semibold text-link md:hidden" onClick={() => setSel(null)}>‹ Volver</button>
              <PlatformDot p={sel.channel} /><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold text-navy">{sel.participantName || 'Sin nombre'}{sel.simulated && <Badge tone="Canceled" className="ml-2">Simulado</Badge>}</div><div className="text-[12px] text-slate">{platformLabel(sel.channel)} · {sel.accountName}{sel.participantHandle ? ` · ${sel.participantHandle}` : ''}</div></div>
              <Select aria-label="Responsable" value={sel.assignedOwnerId ?? ''} onChange={e => act(() => api('PATCH', `/social/conversations/${sel.id}/assign`, { ownerId: e.target.value || null }).then(() => setSel({ ...sel, assignedOwnerId: e.target.value || null })))} className="!w-40"><option value="">Sin asignar</option>{OWNERS.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</Select>
              <Button size="sm" onClick={() => act(() => api('PATCH', `/social/conversations/${sel.id}`, { status: sel.status === 'closed' ? 'open' : 'closed' }).then(() => setSel({ ...sel, status: sel.status === 'closed' ? 'open' : 'closed' })))}>{sel.status === 'closed' ? 'Reabrir' : 'Cerrar'}</Button></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
              {sel.contactId ? <span>Contacto del CRM: <Link to={`/contacts/${sel.contactId}`} className="font-semibold text-link hover:underline">{sel.contactName || `#${sel.contactId}`}</Link></span>
                : <span className="text-slate">Sin contacto vinculado · <button className="cursor-pointer font-semibold text-link hover:underline" onClick={() => act(() => api<{ contactId: string }>('POST', `/social/conversations/${sel.id}/link-contact`, { create: true }).then(r => setSel({ ...sel, contactId: String(r.contactId) })), 'Lead creado en el CRM')}>Crear lead</button></span>}
              {owner(sel.assignedOwnerId) && <span className="text-slate">Responsable: {owner(sel.assignedOwnerId)!.firstName}</span>}
              {det && AI_STATE[det.aiState] && <span className="text-slate">· {AI_STATE[det.aiState]}</span>}
            </div>
            {det && Object.keys(det.captured ?? {}).length > 0 && <div className="mt-2 rounded-lg border border-line bg-sky/40 px-3 py-2 text-[12.5px]"><b className="text-navy">Datos reunidos:</b> {Object.entries(det.captured).map(([k, v]) => <span key={k} className="mr-3"><span className="text-slate">{({ name: 'Nombre', phone: 'Teléfono', email: 'Email', interest: 'Interés', notes: 'Notas' } as Record<string, string>)[k] ?? k}:</span> {v}</span>)}</div>}
          </div>
          <div className="scroll-thin max-h-[calc(100vh-30rem)] min-h-[12rem] flex-1 space-y-2 overflow-auto bg-sky/20 p-4">
            {!msgs ? <Spinner /> : !msgs.length ? <p className="text-center text-[13px] text-slate">Sin mensajes en este hilo.</p> : msgs.map(m => m.isInternal
              ? <div key={m.id} className="mx-auto max-w-[85%] rounded-lg border border-dashed border-[#e0b84a] bg-[#fff8e1] px-3 py-2 text-[13px] text-ink"><b>Nota interna</b> · {m.body}<div className="text-[11px] text-slate">{when(m.createdAt)}</div></div>
              : m.status === 'draft'
                ? <div key={m.id} className="ml-auto max-w-[80%] rounded-2xl border-2 border-dashed border-navy/40 bg-white px-3 py-2 text-[13.5px]"><div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-navy">Borrador de la IA · por aprobar</div>{m.body}
                    <div className="mt-2 flex gap-2"><Button size="sm" variant="primary" onClick={() => approve(m)}>Aprobar y enviar</Button><Button size="sm" onClick={() => edit(m)}>Editar</Button><Button size="sm" onClick={() => discardDraft(m)}>Descartar</Button></div></div>
                : <div key={m.id} className={cx('flex', m.direction === 'out' && 'justify-end')}>
                    <div className={cx('max-w-[75%] rounded-2xl px-3 py-2 text-[13.5px]', m.direction === 'out' ? (m.status === 'failed' ? 'bg-bad/90 text-white' : 'bg-navy text-white') : 'border border-line bg-white text-ink')}>{m.body}
                      <div className={cx('mt-1 text-[11px]', m.direction === 'out' ? 'text-white/70' : 'text-slate')}>{when(m.createdAt)}{m.author === 'rule' && ' · respuesta automática'}{m.author === 'ai' && ' · IA'}{m.status === 'failed' && ` · no enviado${m.error ? ` (${m.error})` : ''}`}</div></div></div>)}
            <div ref={end} />
          </div>
          <div className="border-t border-line p-3">
            <div className="mb-1 flex gap-3 text-[12.5px]"><label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={!internal} onChange={() => setInternal(false)} />Responder</label><label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={internal} onChange={() => setInternal(true)} />Nota interna (no se envía)</label></div>
            <Textarea aria-label={internal ? 'Nota interna' : 'Respuesta'} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={internal ? 'Escribe una nota para el equipo…' : isSim || connected ? 'Escribe tu respuesta…' : 'Responder estará disponible al conectar la cuenta'} />
            <div className="mt-2 flex items-center justify-between"><span className="text-[12px] text-slate">{isSim ? 'Conversación simulada: nada sale a ninguna red.' : connected ? '' : 'Pendiente de conectar'}</span><Button variant="primary" onClick={send} disabled={busy || !text.trim()}>{internal ? 'Guardar nota' : 'Enviar'}</Button></div></div></>}
      </div>
    </div></div>;
}
