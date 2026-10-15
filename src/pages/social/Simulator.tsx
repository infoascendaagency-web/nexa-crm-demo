// Simulador de mensajes entrantes (SOLO datos de prueba marcados como simulados). Sirve para probar bandeja, reglas, leads, prompts y el envío a n8n
// sin tener ninguna red conectada. «Borrar simulados» elimina hilos y eventos de prueba y archiva los contactos que la simulación creó.
import { useState } from 'react';
import { api, ApiError } from '../../lib/backend';
import { Badge, Button, Card, Field, Input, Select, Textarea, useToast } from '../../components/ui';
import { PLATFORMS, type Platform } from './shared';

type Result = { conversationId: number; contactId: number | null; actions: string[]; duplicate: boolean };
export default function Simulator({ onChange }: { onChange?: () => void }) {
  const toast = useToast();
  const [d, setD] = useState({ platform: 'instagram' as Platform, kind: 'dm' as 'dm' | 'comment', name: 'Ana Pérez', handle: '', text: 'Hola, quiero cotizar unas ventanas' });
  const [res, setRes] = useState<Result | null>(null); const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { setRes(await api<Result>('POST', '/social/simulate/incoming', { platform: d.platform, kind: d.platform === 'whatsapp' ? 'dm' : d.kind, participantName: d.name.trim() || 'Persona de prueba', ...(d.handle.trim() ? { handle: d.handle.trim() } : {}), text: d.text.trim() })); onChange?.(); }
    catch (e) { toast(e instanceof ApiError && e.status === 403 ? 'Solo un administrador puede usar el simulador' : 'No se pudo simular el mensaje', 'err'); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!window.confirm('¿Borrar TODOS los datos simulados (hilos, eventos) y archivar los contactos de prueba? Los datos reales no se tocan.')) return;
    try { const r = await api<{ conversations: number; contactsArchived: number }>('DELETE', '/social/simulate'); toast(`Listo: ${r.conversations} conversaciones y ${r.contactsArchived} contactos de prueba`); setRes(null); onChange?.(); } catch { toast('No se pudo limpiar', 'err'); }
  };
  return <Card title="Simulador de mensajes entrantes" action={<Badge tone="Canceled">Solo pruebas</Badge>} className="lg:col-span-2">
    <p className="mb-3 text-[13px] text-slate">Escribe como si fueras un cliente. El mensaje entra por el mismo camino que uno real: se guarda en la bandeja, crea el lead (si «Guardar como lead» está activo), evalúa las reglas y avisa a n8n. Nada sale a ninguna red.</p>
    <div className="grid gap-x-3 md:grid-cols-4">
      <Field label="Red"><Select value={d.platform} onChange={e => setD({ ...d, platform: e.target.value as Platform })}>{PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
      <Field label="Tipo"><Select value={d.platform === 'whatsapp' ? 'dm' : d.kind} disabled={d.platform === 'whatsapp'} onChange={e => setD({ ...d, kind: e.target.value as 'dm' | 'comment' })}><option value="dm">Mensaje directo</option><option value="comment">Comentario</option></Select></Field>
      <Field label="Nombre de la persona"><Input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></Field>
      <Field label={d.platform === 'whatsapp' ? 'Teléfono (opcional)' : 'Usuario (opcional)'}><Input value={d.handle} onChange={e => setD({ ...d, handle: e.target.value })} placeholder={d.platform === 'whatsapp' ? '+1 305 555 0142' : '@usuario'} /></Field>
    </div>
    <Field label="Mensaje" hint="Si escribes un correo o un teléfono dentro del texto, el lead se completa solo."><Textarea rows={2} value={d.text} onChange={e => setD({ ...d, text: e.target.value })} /></Field>
    <div className="flex flex-wrap items-center gap-2"><Button variant="primary" onClick={send} disabled={busy || !d.text.trim()}>Enviar mensaje simulado</Button><Button onClick={clear}>Borrar simulados</Button>
      {res && <span className="text-[13px] text-ink">Conversación #{res.conversationId}: {res.actions.length ? res.actions.join(' · ') : 'guardado en la bandeja'}{res.contactId ? ` · contacto #${res.contactId}` : ''}</span>}</div>
  </Card>;
}
