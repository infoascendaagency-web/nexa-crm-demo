// Publicar: montar la tienda en la web del cliente (ruta, subdominio o código incrustado) con artefactos por proveedor (AWS, Cloudflare, servidor propio).
// Solo GENERA instrucciones y consulta (DNS/HTTP, solo lectura): no cambia DNS ni CloudFront.
import { useEffect, useState } from 'react';
import { api } from '../../lib/backend';
import { Badge, Button, Card, Field, Input, Spinner, Switch, cx, useCopy, useToast } from '../../components/ui';
import { errMsg, type Settings } from './shared';

type Mode = 'route' | 'subdomain' | 'embed'; type Prov = 'aws' | 'cloudflare' | 'server';
type Plan = { finalUrl: string | null; host: string | null; crmPageUrl: string; steps: string[]; artifacts: { title: string; filename: string; language: string; content: string }[]; dns: { type: string; name: string; value: string; note?: string }[]; warnings: string[] };
type Check = { host: string; url: string; dns: { ok: boolean; cname: string[]; a: string[]; blocked: boolean }; http?: { status: number; ms: number; looksLikeStore: boolean; error?: string }; hints: string[] };
const MODES: { id: Mode; title: string; ex: (d: string) => string; desc: string }[] = [
  { id: 'route', title: 'Como página de tu sitio', ex: d => `${d}/tienda`, desc: 'La tienda vive en una ruta de tu mismo dominio.' },
  { id: 'subdomain', title: 'Como subdominio', ex: d => `tienda.${d}`, desc: 'La tienda vive en su propio subdominio.' },
  { id: 'embed', title: 'Por código incrustado', ex: () => 'pegar un script', desc: 'Pegas un código dentro de una página existente de tu sitio.' },
];
const PROVS: { id: Prov; title: string; desc: string }[] = [
  { id: 'aws', title: 'AWS (CloudFront)', desc: 'Si tu sitio está en CloudFront/S3.' }, { id: 'cloudflare', title: 'Cloudflare', desc: 'Worker + ruta o registro DNS.' }, { id: 'server', title: 'Servidor propio / Sliplane', desc: 'Proxy inverso nginx.' },
];
const domainOf = (u: string) => u.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || 'tudominio.com';

export default function Publicar() {
  const toast = useToast(); const copy = useCopy(); const [shop, setShop] = useState<Settings | null>(null);
  const [site, setSite] = useState(''); const [mode, setMode] = useState<Mode>('route'); const [sub, setSub] = useState('tienda'); const [path, setPath] = useState('/tienda'); const [prov, setProv] = useState<Prov>('aws');
  const [plan, setPlan] = useState<Plan | null>(null); const [check, setCheck] = useState<Check | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { api<Settings>('GET', '/ecommerce/settings').then(s => { setShop(s); const p = s.publish; setSite(p.siteUrl ?? ''); if (p.mode) setMode(p.mode); if (p.subdomain) setSub(p.subdomain); if (p.path) setPath(p.path); if (p.provider) setProv(p.provider); }).catch(() => toast('No se pudo cargar', 'err')); }, [toast]);
  useEffect(() => {   // plan en vivo mientras escribes (sin guardar)
    if (!site.trim()) { setPlan(null); setErr(''); return; }
    const t = setTimeout(() => api<Plan>('POST', '/ecommerce/publish/plan', { siteUrl: site, mode, subdomain: sub, path, provider: prov }).then(p => { setPlan(p); setErr(''); }).catch(e => { setPlan(null); setErr(errMsg(e)); }), 350);
    return () => clearTimeout(t);
  }, [site, mode, sub, path, prov]);
  if (!shop) return <div className="grid place-items-center p-12"><Spinner s={22} /></div>;
  const save = async () => { setBusy(true); try { setShop(await api<Settings>('PUT', '/ecommerce/settings', { publish: { siteUrl: site, mode, subdomain: sub, path, provider: prov } })); toast('Configuración de publicación guardada'); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setCheck(null); try { setCheck(await api<Check>('POST', '/ecommerce/publish/check', {})); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); } };
  const d = domainOf(site);
  return <div className="grid gap-5 xl:grid-cols-[28rem_1fr]">
    <div className="space-y-5">
      <Card title="1 · Tu sitio web">
        <Field label="Dirección de tu página" hint="Ej. nexahome.example"><Input value={site} onChange={e => setSite(e.target.value)} placeholder="tudominio.com" /></Field>
        <div className="space-y-2" role="radiogroup" aria-label="Modo de publicación">{MODES.map(m => <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={cx('w-full cursor-pointer rounded-xl border p-3 text-left', mode === m.id ? 'border-brand bg-[#fff6f0]' : 'border-line bg-white')}><div className="flex items-center justify-between"><b className="text-navy">{m.title}</b><span className="text-[12.5px] text-slate">{m.ex(d)}</span></div><div className="text-[12.5px] text-slate">{m.desc}</div></button>)}</div>
        {mode === 'route' && <Field label="Ruta"><Input value={path} onChange={e => setPath(e.target.value)} placeholder="/tienda" /></Field>}
        {mode === 'subdomain' && <Field label="Subdominio"><div className="flex items-center gap-2"><Input value={sub} onChange={e => setSub(e.target.value)} className="!w-40" /><span className="text-slate">.{d}</span></div></Field>}
      </Card>
      <Card title="2 · Dónde está alojado tu sitio">{mode === 'embed' ? <p className="text-[13px] text-slate">El código incrustado funciona en cualquier alojamiento: no necesitas configurar nada más.</p> :
        <div className="space-y-2" role="radiogroup" aria-label="Proveedor">{PROVS.map(p => <button key={p.id} role="radio" aria-checked={prov === p.id} onClick={() => setProv(p.id)} className={cx('w-full cursor-pointer rounded-xl border p-3 text-left', prov === p.id ? 'border-brand bg-[#fff6f0]' : 'border-line bg-white')}><b className="text-navy">{p.title}</b><div className="text-[12.5px] text-slate">{p.desc}</div></button>)}</div>}</Card>
      <Card title="3 · Estado">
        <div className="mb-3 flex items-center gap-3"><Switch on={shop.published} onChange={async v => { try { setShop(await api<Settings>('PUT', '/ecommerce/settings', { published: v })); } catch (e) { toast(errMsg(e), 'err'); } }} label="Tienda publicada" /><span className="text-[13.5px]">{shop.published ? 'La tienda pública responde.' : 'La tienda está oculta (la dirección da 404).'}</span></div>
        <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={save} disabled={busy || !site.trim()}>Guardar</Button><Button onClick={verify} disabled={busy || !site.trim()}>Verificar ahora</Button><a className="inline-flex h-9 items-center rounded-lg border border-line-2 px-3 text-[13.5px] font-semibold text-navy hover:bg-canvas" href={shop.publicPageUrl} target="_blank" rel="noreferrer">Abrir la tienda del CRM</a></div>
        {check && <div className="mt-3 space-y-1.5 rounded-xl border border-line p-3 text-[13px]"><div className="font-bold text-navy">{check.url}</div>
          <div>DNS: {check.dns.ok ? <Badge tone="Confirmed">Resuelve</Badge> : <Badge tone="Canceled">No resuelve</Badge>} <span className="text-slate">{[...check.dns.cname, ...check.dns.a].join(', ')}</span></div>
          {check.http && <div>Página: {check.http.status === 200 && check.http.looksLikeStore ? <Badge tone="Confirmed">Es la tienda ✓</Badge> : <Badge tone="Pending">{check.http.status || 'sin respuesta'}</Badge>} <span className="text-slate">{check.http.ms} ms {check.http.error ?? ''}</span></div>}
          {check.hints.map(h => <div key={h} className="text-warn">• {h}</div>)}</div>}
      </Card>
    </div>
    <div className="min-w-0 space-y-5">
      {err && <div role="alert" className="rounded-lg border border-bad/30 bg-[#fdecec] px-3 py-2 text-[13px] text-bad">{err}</div>}
      {!site.trim() ? <Card title="Instrucciones"><p className="text-[13.5px] text-slate">Escribe la dirección de tu sitio y elige cómo quieres montar la tienda. Aquí aparecerán, listos para copiar, los pasos y los archivos para tu proveedor.</p></Card>
        : plan && <>
          <Card title="Resultado"><div className="text-[14px]">{plan.finalUrl ? <>Tu tienda quedará en <b className="text-navy">{plan.finalUrl}</b></> : <>Tu tienda se verá dentro de la página donde pegues el código.</>}</div><div className="mt-1 text-[12.5px] text-slate">La tienda la sirve tu CRM en <code>{plan.crmPageUrl}</code>; esto solo la «monta» bajo tu dominio.</div>
            {plan.warnings.map(w => <p key={w} className="mt-2 rounded-lg bg-[#fff3bf] p-2 text-[12.5px]">⚠ {w}</p>)}</Card>
          <Card title="Pasos"><ol className="list-decimal space-y-1.5 pl-5 text-[13.5px]">{plan.steps.map(s => <li key={s}>{s}</li>)}</ol>
            {plan.dns.length > 0 && <div className="mt-3"><div className="mb-1 text-[12.5px] font-bold uppercase text-slate">Registros DNS</div><table className="w-full text-[13px]"><tbody>{plan.dns.map(r => <tr key={r.name + r.type} className="border-t border-line/60"><td className="py-1 pr-3 font-bold">{r.type}</td><td className="pr-3">{r.name}</td><td className="pr-3 font-mono text-[12.5px]">{r.value}</td><td className="text-slate">{r.note}</td></tr>)}</tbody></table></div>}</Card>
          {plan.artifacts.map(a => <Card key={a.filename} title={a.title} action={<Button size="sm" onClick={() => copy(a.content, 'Copiado')}>Copiar</Button>}><div className="mb-1 text-[12px] text-slate">{a.filename}</div><pre className="scroll-thin max-h-72 overflow-auto rounded-lg bg-[#0f172a] p-3 text-[12px] leading-relaxed text-[#e2e8f0]"><code>{a.content}</code></pre></Card>)}
        </>}
      <p className="text-[12px] text-slate">Estos artefactos solo se generan aquí: no se cambia DNS ni CloudFront automáticamente. Para el modo «ruta» en AWS hay un script opcional: <code>infra/ecommerce-publicar.sh</code>.</p>
    </div>
  </div>;
}
