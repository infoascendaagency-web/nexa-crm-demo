import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { store, useDbValue } from '../../lib/api';
import { MODE } from '../../lib/auth';
import Icon from '../../components/Icon';
import { Chip, consentTone } from './Chip';
import { Button, Card, Empty, ErrorState, Field, IconButton, Input, Modal, PageHeader, Select, Skeleton, Switch, Textarea, cx, useCopy, useToast } from '../../components/ui';
import {
  CONSENT_LABEL, PAGE_TYPE_LABEL, PLACEMENT_LABEL, SITE_LABEL, TEMPLATE_LABEL, appliesTo, deleteTag, errMsg, listTags, loaderSnippet, saveBanner, setEnabled, setMaster,
  type Banner, type Tag, type TagsList as Data,
} from './tagsApi';

export const SecurityNotice = () => (
  <div role="note" className="flex gap-3 rounded-xl border border-warn/40 bg-[#FFF8EA] p-3.5 text-[13.5px] text-ink">
    <Icon n="shield" s={18} className="mt-0.5 shrink-0 text-warn" />
    <div className="min-w-0"><b>Este código se ejecuta en tus páginas públicas</b>, incluidas las que reciben datos personales (formularios). Pega solo código de proveedores en los que confíes: un script malicioso podría leer lo que escribe la gente.
      <span className="mt-1 block text-slate">Los códigos de analítica y publicidad pueden requerir el consentimiento de las personas visitantes (leyes de privacidad de California: CCPA/CPRA). Revisa el apartado “Consentimiento”.</span></div>
  </div>
);

const where = (t: Tag) => [t.sites.length ? t.sites.map(s => (s === 'web' ? 'Sitio comercial' : 'Formularios CRM')).join(' + ') : 'Todos los sitios', t.pageTypes.includes('all') ? null : t.pageTypes.map(p => PAGE_TYPE_LABEL[p]).join(', '), t.hosts.length ? `${t.hosts.length} dominio${t.hosts.length > 1 ? 's' : ''}` : null, t.rules.length ? `${t.rules.length} regla${t.rules.length > 1 ? 's' : ''} de ruta` : null].filter(Boolean).join(' · ');

export function TagsList() {
  const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState(''); const toast = useToast(); const nav = useNavigate(); const [help, setHelp] = useState(false); const [busy, setBusy] = useState<number | 'master' | null>(null);
  const load = useCallback(() => { listTags().then(d => { setData(d); setErr(''); }).catch(e => setErr(errMsg(e))); }, []);
  useEffect(load, [load]);
  if (MODE !== 'connected') return <div className="p-4 sm:p-6"><Empty icon="code" title="Disponible con el servidor conectado">El gestor de códigos y scripts guarda sus datos en el servidor del CRM. Ábrelo desde la versión conectada.</Empty></div>;
  if (err) return <div className="p-4 sm:p-6"><ErrorState detail={err} onRetry={load} /></div>;
  if (!data) return <div className="space-y-3 p-4 sm:p-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const tags = data.results; const active = tags.filter(t => t.enabled).length;
  const toggle = async (t: Tag) => { setBusy(t.id); try { const r = await setEnabled(t.id, !t.enabled); setData(d => d && { ...d, results: d.results.map(x => (x.id === t.id ? r : x)) }); toast(r.enabled ? `“${t.name}” activado` : `“${t.name}” desactivado`); r.warnings.filter(w => w.code === 'duplicate_id').forEach(w => toast(w.message, 'err')); } catch (e) { toast(errMsg(e), 'err'); } setBusy(null); };
  const master = async (v: boolean) => { setBusy('master'); try { await setMaster(v); setData(d => d && { ...d, master: v }); toast(v ? 'Códigos encendidos en las páginas públicas' : 'Todos los códigos apagados'); } catch (e) { toast(errMsg(e), 'err'); } setBusy(null); };
  const del = async (t: Tag) => { if (!confirm(`¿Eliminar “${t.name}”? Se conserva su historial, pero deja de cargarse en tus páginas.`)) return; try { await deleteTag(t.id); toast('Código eliminado'); load(); } catch (e) { toast(errMsg(e), 'err'); } };

  return <div className="p-4 sm:p-6">
    <PageHeader title="Códigos y scripts" sub={`${tags.length} de ${data.meta.maxTags} códigos · ${active} activos · instala GTM, GA4, píxel de Meta, Clarity o cualquier código sin tocar el HTML`}
      actions={<><Button onClick={() => setHelp(true)} icon="info">Cómo comprobarlo</Button><Button variant="primary" icon="plus" onClick={() => nav('/site/tags/nuevo')} disabled={tags.length >= data.meta.maxTags}>Añadir código</Button></>} />
    <div className="mb-4 space-y-3"><SecurityNotice />
      <div className={cx('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5', data.master ? 'border-line bg-white' : 'border-bad/40 bg-red-50')}>
        <div className="min-w-0"><div className="font-display text-[15px] font-bold text-navy">Interruptor general {data.master ? <Chip tone="good">Encendido</Chip> : <Chip tone="bad">Apagado</Chip>}</div>
          <p className="mt-0.5 text-[13px] text-slate">{data.master ? 'Los códigos activos se cargan en tus páginas. Apágalo para detenerlos todos al instante (en máx. ~1 min por la caché).' : 'Ningún código se carga en las páginas públicas, aunque estén activos aquí. Cada código conserva su estado.'}</p></div>
        <Switch on={data.master} onChange={v => { if (busy === 'master') return; if (!v && !confirm('¿Apagar TODOS los códigos y scripts de las páginas públicas?')) return; void master(v); }} label="Interruptor general de códigos y scripts" />
      </div></div>

    {tags.length === 0 ? <Card><Empty icon="code" title="Aún no hay códigos">Añade Google Tag Manager con su ID (GTM-XXXX) y desde GTM carga GA4, el píxel de Meta, Clarity y lo demás. También puedes pegar cualquier código y elegir en qué parte de la página va.<div className="mt-3"><Button variant="primary" icon="plus" onClick={() => nav('/site/tags/nuevo')}>Añadir el primero</Button></div></Empty></Card>
      : <div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full min-w-[820px] text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Código</th><th>Ubicación</th><th>Aplica a</th><th>Consentimiento</th><th className="text-right">Orden</th><th className="px-3">Activo</th><th></th></tr></thead>
        <tbody>{tags.map(t => <tr key={t.id} className="border-b border-line/70 align-top hover:bg-sky/40">
          <td className="px-4 py-2.5"><Link to={`/site/tags/${t.id}`} className="font-semibold text-link hover:underline">{t.name}</Link><div className="text-[12px] text-slate">{TEMPLATE_LABEL[t.template]}{t.params.id ? <> · <code className="font-mono">{t.params.id}</code></> : null}</div>{t.warnings.length > 0 && <div className="mt-0.5 text-[12px] text-warn">{t.warnings.length} aviso{t.warnings.length > 1 ? 's' : ''}</div>}</td>
          <td className="py-2.5 text-[12.5px]">{[...new Set(t.parts.map(p => PLACEMENT_LABEL[p.placement]))].map(l => <div key={l}>{l}</div>)}</td>
          <td className="max-w-[260px] py-2.5 text-[12.5px] text-slate">{where(t)}</td>
          <td className="py-2.5"><Chip tone={consentTone(t.consent)}>{CONSENT_LABEL[t.consent]}</Chip></td>
          <td className="py-2.5 text-right tabular">{t.priority}</td>
          <td className="px-3 py-2.5"><Switch on={t.enabled} onChange={() => { if (busy === t.id) return; void toggle(t); }} label={`${t.enabled ? 'Desactivar' : 'Activar'} ${t.name}`} /></td>
          <td className="py-1.5 pr-3"><div className="flex justify-end"><IconButton n="edit" label={`Editar ${t.name}`} onClick={() => nav(`/site/tags/${t.id}`)} /><IconButton n="trash" label={`Eliminar ${t.name}`} onClick={() => void del(t)} /></div></td></tr>)}</tbody></table></div>}

    <div className="mt-4 grid gap-4 lg:grid-cols-2"><LoaderCard /><UrlTester /></div>
    <div className="mt-4"><BannerCard banner={data.banner} onSaved={b => setData(d => d && { ...d, banner: b })} /></div>
    {help && <HowToCheck onClose={() => setHelp(false)} />}
  </div>;
}

function LoaderCard() {
  const copy = useCopy();
  return <Card title="Instalación en el HTML (una sola línea)">
    <p className="mb-3 text-[13px] text-slate">El sitio comercial y las páginas públicas del CRM ya la llevan puesta. Si montas otra página propia, pega esta línea en su <code className="font-mono">&lt;head&gt;</code>; desde ahí se gestiona todo.</p>
    {(['web', 'crm'] as const).map(s => <div key={s} className="mb-2.5"><div className="mb-1 text-[12px] font-bold text-slate">{SITE_LABEL[s]}</div>
      <div className="flex items-start gap-2"><pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2.5 font-mono text-[12px]">{loaderSnippet(s)}</pre><IconButton n="copy" label={`Copiar línea de ${SITE_LABEL[s]}`} onClick={() => copy(loaderSnippet(s), 'Línea copiada')} /></div></div>)}
    <p className="mt-2 text-[12px] text-slate">Si la web usa una política de seguridad de contenido (CSP), debe permitir este dominio y los de cada proveedor. Detalle en la guía del dueño (<code className="font-mono">crm-codigos-y-scripts-guia.md</code>).</p>
  </Card>;
}

function UrlTester() {
  const [url, setUrl] = useState('https://nexahome.example/'); const [site, setSite] = useState('web'); const [res, setRes] = useState<Awaited<ReturnType<typeof appliesTo>> | null>(null); const [err, setErr] = useState('');
  const go = async () => { setErr(''); try { setRes(await appliesTo(url, site)); } catch (e) { setRes(null); setErr(errMsg(e)); } };
  return <Card title="¿Qué se cargaría en esta URL?">
    <p className="mb-3 text-[13px] text-slate">Comprueba tus reglas sin abrir la página: se calcula con la dirección que escribas (el servidor no la visita).</p>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input aria-label="URL a comprobar" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && void go()} placeholder="https://nexahome.example/roofing" />
      <Select aria-label="Sitio" value={site} onChange={e => setSite(e.target.value)}><option value="web">Sitio comercial</option><option value="crm">Formularios del CRM</option></Select></div>
    <div className="mt-2"><Button onClick={() => void go()}>Comprobar</Button></div>
    {err && <p role="alert" className="mt-2 text-[13px] text-bad">{err}</p>}
    {res && <div className="mt-3 text-[13px]"><p className="text-slate">Página: <code className="font-mono">{res.ctx.host}{res.ctx.path}</code> · tipo “{PAGE_TYPE_LABEL[res.ctx.type]}”{!res.master && <b className="text-bad"> · el interruptor general está APAGADO</b>}</p>
      <ul className="mt-1.5 divide-y divide-line/70">{res.results.length === 0 && <li className="py-1.5 text-slate">No hay códigos.</li>}{res.results.map(r => <li key={r.id} className="flex items-center justify-between gap-2 py-1.5"><span className="min-w-0 truncate">{r.name}</span>
        <span className="shrink-0 text-[12.5px]">{!r.applies ? <span className="text-slate">no aplica</span> : !r.enabled ? <span className="text-warn">aplicaría, pero está desactivado</span> : r.consent === 'essential' ? <b className="text-good">se carga</b> : <b className="text-good">se carga con consentimiento ({CONSENT_LABEL[r.consent].toLowerCase()})</b>}</span></li>)}</ul></div>}
  </Card>;
}

function BannerCard({ banner, onSaved }: { banner: Banner; onSaved: (b: Banner) => void }) {
  const [b, setB] = useState(banner); const [saving, setSaving] = useState(false); const toast = useToast(); const set = (p: Partial<Banner>) => setB(x => ({ ...x, ...p }));
  const dirty = JSON.stringify(b) !== JSON.stringify(banner);
  const save = async () => { setSaving(true); try { const r = await saveBanner(b); onSaved(r.banner); setB(r.banner); toast('Banner guardado'); } catch (e: any) { toast(errMsg(e), 'err'); } setSaving(false); };
  return <Card title="Banner de consentimiento (opcional)" action={<Switch on={b.enabled} onChange={v => set({ enabled: v })} label="Mostrar el banner de consentimiento" />}>
    <p className="mb-3 text-[13px] text-slate">Apagado por defecto. Solo aparece si hay códigos de analítica o marketing que apliquen a la página, y guarda la elección 180 días en una cookie (<code className="font-mono">nx_consent</code>). Si usas otra herramienta de cookies, déjalo apagado y llama a <code className="font-mono">window.nxConsent.grant('marketing')</code> cuando la persona acepte.</p>
    <div className="grid gap-x-4 gap-y-0 sm:grid-cols-2">
      <Field label="Modo" hint={b.mode === 'optout' ? 'Opt-out (EE. UU.): los códigos cargan hasta que la persona se opone; se respeta Global Privacy Control para marketing.' : 'Opt-in: ningún código de analítica/marketing carga hasta que la persona acepta.'}><Select value={b.mode} onChange={e => set({ mode: e.target.value as Banner['mode'] })}><option value="optout">Opt-out (EE. UU., por defecto)</option><option value="optin">Opt-in (previo consentimiento)</option></Select></Field>
      <Field label="Enlace a la política de privacidad" hint="https://… o /ruta. Vacío = sin enlace."><Input value={b.policyUrl} onChange={e => set({ policyUrl: e.target.value })} placeholder="https://nexahome.example/privacy" /></Field>
      <div className="sm:col-span-2"><Field label="Texto del banner" hint="El texto es el que verá el público; por defecto está en inglés."><Textarea rows={2} maxLength={400} value={b.text} onChange={e => set({ text: e.target.value })} /></Field></div>
      <Field label="Botón de aceptar"><Input maxLength={40} value={b.accept} onChange={e => set({ accept: e.target.value })} /></Field>
      <Field label={b.mode === 'optout' ? 'Botón de oponerse (“Do not sell or share…”)' : 'Botón de rechazar'}><Input maxLength={40} value={b.reject} onChange={e => set({ reject: e.target.value })} /></Field>
    </div>
    <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? 'Guardando…' : 'Guardar banner'}</Button>
  </Card>;
}

function HowToCheck({ onClose }: { onClose: () => void }) {
  const forms = useDbValue(() => (store.forms() as any[]).filter(f => f.status === 'published'), []); const [formCode, setFormCode] = useState(''); const [web, setWeb] = useState('https://nexahome.example/');
  const code = formCode || forms[0]?.code || forms[0]?.slug || '';
  const open = (u: string) => { try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) return; x.searchParams.set('tagdebug', '1'); window.open(x.toString(), '_blank', 'noopener,noreferrer'); } catch { /* URL inválida */ } };
  return <Modal title="Cómo comprobar que un código se instaló" onClose={onClose} width="max-w-2xl" footer={<Button onClick={onClose}>Cerrar</Button>}>
    <ol className="list-decimal space-y-4 pl-5 text-[13.5px]">
      <li><b>Abre la página en modo depuración.</b> Añade <code className="font-mono">?tagdebug=1</code> a la dirección y abre la consola del navegador (F12 → Consola): verás líneas <code className="font-mono">[nx-tags]</code> con lo que se insertó, lo que está esperando consentimiento y lo que no aplica a esa página.
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Select aria-label="Formulario" value={code} onChange={e => setFormCode(e.target.value)}>{forms.length === 0 && <option value="">(no hay formularios publicados)</option>}{forms.map(f => <option key={f.id} value={f.code ?? f.slug}>{f.name}</option>)}</Select><Button disabled={!code} onClick={() => open(`${location.origin}/landing/${code}`)}>Abrir formulario con ?tagdebug=1</Button></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Input aria-label="URL del sitio" value={web} onChange={e => setWeb(e.target.value)} /><Button onClick={() => open(web)}>Abrir sitio con ?tagdebug=1</Button></div></li>
      <li><b>Inspecciona la página.</b> Cada elemento insertado lleva el atributo <code className="font-mono">data-nx-tag</code> (clic derecho → Inspeccionar). En Consola puedes escribir <code className="font-mono">nxConsent.status()</code> para ver el consentimiento actual.</li>
      <li><b>Comprueba con la herramienta del proveedor.</b> Google Tag Manager: “Vista previa” en tagmanager.google.com y la extensión <i>Tag Assistant</i>. Meta: extensión <i>Meta Pixel Helper</i> y “Probar eventos” en el Administrador de eventos. GA4: informe “Tiempo real”. Clarity: aparece en su panel tras unos minutos.</li>
      <li><b>Si no aparece:</b> ¿el interruptor general está encendido? ¿el código está activo y aplica a esa URL (usa “¿Qué se cargaría en esta URL?”)? ¿espera consentimiento (modo opt-in o señal Global Privacy Control)? ¿un bloqueador de anuncios lo frena? Los cambios tardan hasta ~1 minuto por la caché.</li>
    </ol>
    <p className="mt-4 rounded-lg bg-canvas p-3 text-[12.5px] text-slate">El CRM no visita tus páginas por ti (para que nadie pueda usar esta herramienta para hacer peticiones a direcciones internas): la comprobación se hace en tu navegador, con tus propios ojos.</p>
  </Modal>;
}
