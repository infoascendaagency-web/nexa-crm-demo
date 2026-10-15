// Ajustes del blog: dominios permitidos para incrustar contenido (video, mapas, agendas…). Solo un administrador puede cambiarlos.
import { useEffect, useState } from 'react';
import { Button, ErrorState, Modal, Skeleton, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { BIcon } from './icons';
import { blog2, errMsg, type EmbedDomains } from './blogApi';
import { setEmbedHosts } from './types';

export default function EmbedSettings({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const { user } = useAuth(); const isAdmin = user.role === 'Super admin';
  const [data, setData] = useState<EmbedDomains | null>(null); const [err, setErr] = useState(''); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [saveErr, setSaveErr] = useState('');
  useEffect(() => { blog2.embedDomains().then(r => { setData(r); setText(r.domains.join('\n')); }).catch(e => setErr(errMsg(e))); }, []);
  const save = async () => {
    setBusy(true); setSaveErr('');
    try { const r = await blog2.saveEmbedDomains(text.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)); setData(r); setText(r.domains.join('\n')); setEmbedHosts(r.domains); toast('Dominios permitidos guardados'); }
    catch (e) { setSaveErr(errMsg(e)); } finally { setBusy(false); }
  };
  return <Modal title="Ajustes del blog · contenido incrustado" width="max-w-2xl" onClose={onClose} footer={<><Button onClick={onClose}>Cerrar</Button>{isAdmin && <Button variant="primary" disabled={busy || !data} onClick={save}>{busy ? 'Guardando…' : 'Guardar dominios'}</Button>}</>}>
    {err ? <ErrorState title="No se pudieron cargar los ajustes" detail={err} /> : !data ? <Skeleton className="h-40 w-full" /> : <div>
      <p className="text-[13.5px] text-slate">En un artículo puedes pegar el <strong className="text-navy">enlace</strong> de un video, mapa, agenda o audio y se incrusta de forma segura. Nunca se acepta código HTML ni iframes: el servidor construye el iframe con restricciones.</p>
      <h3 className="mb-1.5 mt-4 text-[12.5px] font-bold uppercase tracking-wide text-mute">Siempre permitidos</h3>
      <ul className="grid gap-1.5 sm:grid-cols-2">{data.builtin.map(b => <li key={b.id} className="rounded-lg border border-line bg-canvas/50 px-3 py-1.5"><span className="text-[13px] font-semibold text-navy">{b.name}</span><span className="block truncate text-[11.5px] text-mute">{b.example}</span></li>)}</ul>
      <h3 className="mb-1.5 mt-4 text-[12.5px] font-bold uppercase tracking-wide text-mute">Dominios adicionales (autorizados por un administrador)</h3>
      <label htmlFor="embed-domains" className="sr-only">Dominios adicionales permitidos, uno por línea</label>
      <textarea id="embed-domains" rows={5} value={text} onChange={e => setText(e.target.value)} readOnly={!isAdmin} placeholder={'videos.miempresa.com\n*.miempresa.com'} className="w-full resize-y rounded-lg border border-line-2 bg-white px-3 py-2 font-mono text-[13px] placeholder:text-mute read-only:bg-canvas focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" />
      <p className="mt-1 text-[12px] leading-snug text-slate">Uno por línea: <code>dominio.com</code> (también <code>www.</code>) o <code>*.dominio.com</code> para sus subdominios. Se incrusta la dirección https:// que pegues, sin credenciales. No se admiten IP, «localhost» ni nombres internos. Máximo {data.max}.{!isAdmin && <strong className="text-[#8A5A0B]"> Solo un administrador puede cambiar esta lista.</strong>}</p>
      {saveErr && <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#FDECEC] px-3 py-2 text-[12.5px] text-bad"><BIcon n="alert" s={14} className="mt-0.5 shrink-0" />{saveErr}</p>}
      <p className="mt-3 rounded-lg bg-[#FDF5E3] px-3 py-2 text-[12px] leading-snug text-[#8A5A0B]"><strong>Para la web pública:</strong> si la página que muestra los artículos tiene una política de seguridad (CSP), debe permitir <code>frame-src</code> de estos proveedores y <code>style-src</code>/<code>font-src</code> del CSS de los temas.</p>
    </div>}
  </Modal>;
}
