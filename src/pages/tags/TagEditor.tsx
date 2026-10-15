import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtDateTime } from '../../lib/fmt';
import { MODE } from '../../lib/auth';
import { Button, Card, Empty, ErrorState, Field, IconButton, Input, PageHeader, Select, Skeleton, Switch, Textarea, cx, useToast } from '../../components/ui';
import { Chip } from './Chip';
import { SecurityNotice } from './TagsList';
import {
  ACTION_LABEL, CONSENT_HELP, CONSENT_LABEL, PAGE_TYPE_LABEL, PLACEMENT_LABEL, SITE_LABEL, TEMPLATE_LABEL, createTag, errMsg, getTag, listTags, renderTemplate, restore, updateTag, versions,
  type Consent, type Part, type Placement, type Rule, type Tag, type TagDraft, type Template, type TemplateInfo, type Version, type Warning,
} from './tagsApi';

const TEMPLATES: Template[] = ['gtm', 'ga4', 'meta_pixel', 'clarity', 'search_console', 'custom'];
const empty = (): TagDraft => ({ name: '', notes: '', template: 'gtm', params: { id: '' }, parts: [], consent: 'essential', sites: [], pageTypes: ['all'], hosts: [], rules: [], priority: 100, enabled: false });
const fromTag = (t: Tag): TagDraft => ({ name: t.name, notes: t.notes, template: t.template, params: t.params, parts: t.parts, consent: t.consent, sites: t.sites, pageTypes: t.pageTypes, hosts: t.hosts, rules: t.rules, priority: t.priority, enabled: t.enabled });
const mono = 'font-mono text-[12.5px] leading-[1.5]';

export function TagEditor() {
  const { id } = useParams(); const isNew = id === 'nuevo'; const nid = Number(id); const nav = useNavigate(); const toast = useToast();
  const [d, setD] = useState<TagDraft | null>(isNew ? empty() : null); const [orig, setOrig] = useState<string>(''); const [err, setErr] = useState(''); const [tpl, setTpl] = useState<Record<string, TemplateInfo>>({});
  const [saving, setSaving] = useState(false); const [fieldErr, setFieldErr] = useState(''); const [warnings, setWarnings] = useState<Warning[]>([]); const [tag, setTag] = useState<Tag | null>(null);
  const load = useCallback(() => {
    listTags().then(l => setTpl(l.meta.templates)).catch(() => {});
    if (isNew) return; getTag(nid).then(t => { setTag(t); setD(fromTag(t)); setOrig(JSON.stringify(fromTag(t))); setWarnings(t.warnings); }).catch(e => setErr(errMsg(e)));
  }, [isNew, nid]);
  useEffect(load, [load]);
  if (MODE !== 'connected') return <div className="p-4 sm:p-6"><Empty icon="code" title="Disponible con el servidor conectado" /></div>;
  if (err) return <div className="p-4 sm:p-6"><ErrorState detail={err} onRetry={() => { setErr(''); load(); }} /></div>;
  if (!d) return <div className="space-y-3 p-4 sm:p-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>;
  const set = (p: Partial<TagDraft>) => { setD(x => x && { ...x, ...p }); setFieldErr(''); };
  const dirty = isNew || JSON.stringify(d) !== orig;
  const pickTemplate = (t: Template) => set({ template: t, params: t === 'custom' ? {} : { id: d.params.id ?? '' }, consent: t === 'custom' ? 'marketing' : tpl[t]?.consent ?? d.consent, parts: t === 'custom' && !d.parts.length ? [{ placement: 'head_end', code: '' }] : d.parts });
  const save = async () => {
    if (!d.name.trim()) return setFieldErr('Ponle un nombre al código');
    const body: TagDraft = { ...d, name: d.name.trim(), parts: d.template === 'custom' ? d.parts.filter(p => p.code.trim()) : [], hosts: d.hosts.map(h => h.trim().toLowerCase()).filter(Boolean), rules: d.rules.filter(r => r.value.trim()).map(r => ({ ...r, value: r.value.trim() })) };
    setSaving(true); setFieldErr('');
    try {
      const t = isNew ? await createTag(body) : await updateTag(nid, body);
      setWarnings(t.warnings); toast(isNew ? 'Código creado (apagado hasta que lo actives)' : 'Cambios guardados');
      if (isNew) nav(`/site/tags/${t.id}`, { replace: true }); else { setTag(t); setD(fromTag(t)); setOrig(JSON.stringify(fromTag(t))); }
    } catch (e: any) { setFieldErr(errMsg(e)); }
    setSaving(false);
  };
  return <div className="p-4 sm:p-6">
    <nav aria-label="Ruta" className="mb-2 text-[13px] text-slate"><Link to="/site/tags" className="text-link hover:underline">Códigos y scripts</Link> / {isNew ? 'Nuevo código' : d.name || 'Código'}</nav>
    <PageHeader title={isNew ? 'Añadir código' : d.name || 'Editar código'} sub={tag ? `Versión ${tag.version} · editado ${fmtDateTime(tag.updatedAt)}${tag.updatedBy ? ` por ${tag.updatedBy}` : ''}` : 'Se crea apagado: lo activas tú cuando lo hayas revisado.'}
      actions={<><Button onClick={() => nav('/site/tags')}>Volver</Button><Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? 'Guardando…' : 'Guardar'}</Button></>} />
    <div className="mb-4"><SecurityNotice /></div>
    {fieldErr && <p role="alert" className="mb-3 rounded-lg border border-bad/40 bg-red-50 px-3 py-2 text-[13.5px] text-bad">{fieldErr}</p>}
    {warnings.length > 0 && <ul aria-label="Avisos" className="mb-4 space-y-1.5">{warnings.map(w => <li key={w.code + w.message} className="flex gap-2 rounded-lg border border-warn/40 bg-[#FFF8EA] px-3 py-2 text-[13px]"><b className="shrink-0 text-warn">Aviso</b><span>{w.message}</span></li>)}</ul>}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card title="Qué código instalar">
          <div role="radiogroup" aria-label="Tipo de código" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{TEMPLATES.map(t => <button key={t} type="button" role="radio" aria-checked={d.template === t} onClick={() => pickTemplate(t)} className={cx('cursor-pointer rounded-lg border px-3 py-2 text-left text-[13.5px] font-semibold', d.template === t ? 'border-navy bg-sky text-navy' : 'border-line bg-white text-ink hover:bg-canvas')}>{TEMPLATE_LABEL[t]}{t === 'custom' && <span className="block text-[11.5px] font-normal text-slate">pegar HTML y elegir dónde</span>}</button>)}</div>
          <Field label="Nombre" hint="Solo para ti; no se publica."><Input value={d.name} maxLength={120} onChange={e => set({ name: e.target.value })} placeholder={d.template === 'custom' ? 'Ej.: Chat de soporte' : TEMPLATE_LABEL[d.template]} /></Field>
          {d.template === 'custom' ? <PartsEditor parts={d.parts} onChange={parts => set({ parts })} onGtm={id => set({ template: 'gtm', params: { id }, parts: [], consent: 'essential' })} /> : <TemplateId d={d} info={tpl[d.template]} onId={v => set({ params: { id: v } })} />}
          <Field label="Notas" hint="Para qué sirve, quién lo pidió, cuándo caduca…"><Textarea rows={2} maxLength={2000} value={d.notes} onChange={e => set({ notes: e.target.value })} /></Field>
        </Card>

        <Card title="Dónde aplica">
          <fieldset className="mb-4"><legend className="mb-1 text-[13px] font-semibold text-ink">Sitios <span className="font-normal text-slate">(ninguno marcado = todos)</span></legend>
            {Object.keys(SITE_LABEL).map(s => <label key={s} className="mr-5 inline-flex items-center gap-2 py-1 text-[13.5px]"><input type="checkbox" className="h-4 w-4 accent-navy" checked={d.sites.includes(s)} onChange={e => set({ sites: e.target.checked ? [...d.sites, s] : d.sites.filter(x => x !== s) })} />{SITE_LABEL[s]}</label>)}</fieldset>
          <fieldset className="mb-4"><legend className="mb-1 text-[13px] font-semibold text-ink">Tipos de página</legend>
            {Object.keys(PAGE_TYPE_LABEL).map(p => <label key={p} className="mr-5 inline-flex items-center gap-2 py-1 text-[13.5px]"><input type="checkbox" className="h-4 w-4 accent-navy" checked={d.pageTypes.includes(p)} onChange={e => { let n = e.target.checked ? (p === 'all' ? ['all'] : [...d.pageTypes.filter(x => x !== 'all'), p]) : d.pageTypes.filter(x => x !== p); if (!n.length) n = ['all']; set({ pageTypes: n }); }} />{PAGE_TYPE_LABEL[p]}</label>)}</fieldset>
          <Field label="Dominios" hint="Uno por línea. Vacío = cualquiera. Admite *.dominio.com para subdominios."><Textarea rows={2} className={mono} value={d.hosts.join('\n')} onChange={e => set({ hosts: e.target.value.split('\n') })} placeholder={'nexahome.example\n*.nexahome.example'} /></Field>
          <RulesEditor rules={d.rules} onChange={rules => set({ rules })} />
        </Card>

        <Card title="Consentimiento">
          <div role="radiogroup" aria-label="Categoría de consentimiento" className="space-y-2">{(['essential', 'analytics', 'marketing'] as Consent[]).map(c => <label key={c} className={cx('flex cursor-pointer gap-3 rounded-lg border p-3', d.consent === c ? 'border-navy bg-sky/50' : 'border-line')}><input type="radio" name="consent" className="mt-1 h-4 w-4 accent-navy" checked={d.consent === c} onChange={() => set({ consent: c })} /><span><b className="text-[13.5px]">{CONSENT_LABEL[c]}</b><span className="block text-[13px] text-slate">{CONSENT_HELP[c]}</span></span></label>)}</div>
          <p className="mt-2 text-[12.5px] text-slate">Con el banner apagado y modo opt-out, los códigos analíticos y de marketing cargan salvo que el navegador envíe Global Privacy Control (marketing) o la persona se haya opuesto. Ajusta el modo en la lista de códigos.</p>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card title="Estado y orden">
          <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-[13.5px] font-semibold text-ink">Activo</div><div className="text-[12.5px] text-slate">{d.enabled ? 'Se carga en las páginas que apliquen' : 'No se carga en ninguna página'}</div></div><Switch on={d.enabled} onChange={v => set({ enabled: v })} label="Código activo" /></div>
          <Field label="Prioridad" hint="Menor número = se inserta antes (GTM suele ir primero)."><Input type="number" min={0} max={9999} value={d.priority} onChange={e => set({ priority: Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0))) })} /></Field>
          <p className="text-[12px] text-slate">Los cambios activos llegan a las páginas en hasta ~1 minuto (caché).</p>
        </Card>
        {!isNew && tag && <History id={nid} onRestored={t => { setTag(t); setD(fromTag(t)); setOrig(JSON.stringify(fromTag(t))); setWarnings(t.warnings); }} version={tag.version} />}
      </aside>
    </div>
  </div>;
}

function TemplateId({ d, info, onId }: { d: TagDraft; info?: TemplateInfo; onId: (v: string) => void }) {
  const id = d.params.id ?? ''; const [prev, setPrev] = useState<{ parts: Part[]; warnings: Warning[] } | null>(null); const [perr, setPerr] = useState('');
  const valid = !!info && new RegExp(info.idPattern).test(id.trim());
  useEffect(() => {
    setPrev(null); setPerr(''); if (!id.trim() || !info) return;
    const t = setTimeout(() => renderTemplate(d.template, id.trim()).then(r => setPrev(r)).catch(e => setPerr(e?.detail?.message ?? 'ID no válido')), 250); return () => clearTimeout(t);
  }, [id, d.template, info]);
  return <>
    {info && <p className="mb-3 rounded-lg bg-canvas p-3 text-[13px] text-slate">{info.hint}</p>}
    <Field label={info?.idLabel ?? 'ID'} hint={info ? `Ejemplo: ${info.example}` : undefined}><Input value={id} onChange={e => onId(e.target.value.trim())} spellCheck={false} autoComplete="off" aria-invalid={!!id && !valid} className={cx(mono, id && !valid && 'border-bad')} placeholder={info?.example} /></Field>
    {id && !valid && <p role="alert" className="-mt-2 mb-3 text-[12.5px] text-bad">{perr || 'Formato no válido. Cópialo tal cual lo muestra la herramienta.'}</p>}
    {prev && <div className="mb-3"><div className="mb-1 text-[13px] font-semibold text-ink">Código que se instalará <span className="font-normal text-slate">(generado, no editable)</span></div>
      {prev.parts.map((p, i) => <div key={i} className="mb-2"><div className="mb-0.5 text-[12px] font-bold text-slate">{PLACEMENT_LABEL[p.placement]}</div><pre tabIndex={0} aria-label={`Código en ${PLACEMENT_LABEL[p.placement]}`} className={cx('max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2.5', mono)}>{p.code}</pre></div>)}</div>}
  </>;
}

function PartsEditor({ parts, onChange, onGtm }: { parts: Part[]; onChange: (p: Part[]) => void; onGtm: (id: string) => void }) {
  const upd = (i: number, p: Partial<Part>) => onChange(parts.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const all = parts.map(p => p.code).join('\n'); const gtmId = /GTM-[A-Z0-9]{4,10}/.exec(all)?.[0]; const isGtm = !!gtmId && /googletagmanager\.com\/(gtm\.js|ns\.html)/.test(all);
  const total = parts.reduce((n, p) => n + new Blob([p.code]).size, 0);
  const splitGtm = () => { const out: Part[] = []; for (const p of parts) { const m = /<noscript[\s\S]*?<\/noscript>/i.exec(p.code); if (m && /googletagmanager\.com\/ns\.html/i.test(m[0]) && /<script/i.test(p.code.replace(m[0], ''))) { out.push({ placement: 'head_start', code: p.code.replace(m[0], '').trim() }, { placement: 'body_start', code: m[0].trim() }); } else out.push(p); } onChange(out); };
  const mixed = parts.some(p => /<script[\s\S]*googletagmanager\.com\/gtm\.js[\s\S]*<noscript[\s\S]*googletagmanager\.com\/ns\.html/i.test(p.code));
  return <div className="mb-3">
    {isGtm && <div role="status" className="mb-3 rounded-lg border border-link/30 bg-sky p-3 text-[13px]">Parece el código de <b>Google Tag Manager</b> ({gtmId}). Lo más seguro es usar la plantilla: genera el script y el noscript en su sitio exacto.
      <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => onGtm(gtmId!)}>Usar la plantilla con {gtmId}</Button>{mixed && <Button size="sm" onClick={splitGtm}>Separar en Head y Body</Button>}</div></div>}
    {parts.map((p, i) => <div key={i} className="mb-3 rounded-lg border border-line p-3">
      <div className="mb-2 flex items-end gap-2"><div className="min-w-0 flex-1"><label className="mb-1 block text-[12.5px] font-semibold text-ink" htmlFor={`pl-${i}`}>Ubicación{parts.length > 1 ? ` · parte ${i + 1}` : ''}</label><Select id={`pl-${i}`} value={p.placement} onChange={e => upd(i, { placement: e.target.value as Placement })}>{(Object.keys(PLACEMENT_LABEL) as Placement[]).map(k => <option key={k} value={k}>{PLACEMENT_LABEL[k]}</option>)}</Select></div>{parts.length > 1 && <IconButton n="trash" label={`Quitar la parte ${i + 1}`} onClick={() => onChange(parts.filter((_, j) => j !== i))} />}</div>
      <label className="mb-1 block text-[12.5px] font-semibold text-ink" htmlFor={`cd-${i}`}>Código pegado</label>
      <Textarea id={`cd-${i}`} rows={7} spellCheck={false} className={mono} value={p.code} onChange={e => upd(i, { code: e.target.value })} placeholder={'<script>\n  // pega aquí el código del proveedor\n</script>'} />
    </div>)}
    <div className="flex flex-wrap items-center justify-between gap-2"><Button size="sm" icon="plus" onClick={() => onChange([...parts, { placement: 'body_end', code: '' }])} disabled={parts.length >= 6}>Añadir otra parte (p. ej. el noscript en Body)</Button><span className={cx('text-[12px]', total > 100 * 1024 ? 'text-bad' : 'text-slate')}>{(total / 1024).toFixed(1)} KB de 100 KB</span></div>
    <p className="mt-2 text-[12px] text-slate">Se admiten <code className="font-mono">&lt;script&gt;</code> (en línea o con <code className="font-mono">src</code>, respetando async/defer/type), <code className="font-mono">&lt;noscript&gt;</code>, <code className="font-mono">&lt;iframe&gt;</code>, <code className="font-mono">&lt;meta&gt;</code>, <code className="font-mono">&lt;link&gt;</code> y <code className="font-mono">&lt;style&gt;</code>. Un mismo código puede tener varias partes en ubicaciones distintas.</p>
  </div>;
}

function RulesEditor({ rules, onChange }: { rules: Rule[]; onChange: (r: Rule[]) => void }) {
  const upd = (i: number, p: Partial<Rule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return <fieldset><legend className="mb-1 text-[13px] font-semibold text-ink">Reglas de ruta <span className="font-normal text-slate">(vacío = todas las rutas)</span></legend>
    <p className="mb-2 text-[12.5px] text-slate">Se compara con la ruta sin parámetros (<code className="font-mono">/roofing/miami</code>). El comodín <code className="font-mono">*</code> vale por cualquier texto. Si hay reglas “Incluir”, la página debe cumplir al menos una; una regla “Excluir” siempre gana.</p>
    {rules.map((r, i) => <div key={i} className="mb-2 grid grid-cols-[110px_150px_1fr_auto] items-center gap-2 max-sm:grid-cols-2">
      <Select aria-label={`Regla ${i + 1}: acción`} value={r.mode} onChange={e => upd(i, { mode: e.target.value as Rule['mode'] })}><option value="include">Incluir</option><option value="exclude">Excluir</option></Select>
      <Select aria-label={`Regla ${i + 1}: tipo`} value={r.op} onChange={e => upd(i, { op: e.target.value as Rule['op'] })}><option value="equals">es igual a</option><option value="starts">empieza con</option><option value="contains">contiene</option></Select>
      <Input aria-label={`Regla ${i + 1}: ruta`} className={cx(mono, 'max-sm:col-span-2')} value={r.value} maxLength={200} onChange={e => upd(i, { value: e.target.value.replace(/\s/g, '') })} placeholder="/gracias*" />
      <IconButton n="trash" label={`Quitar regla ${i + 1}`} onClick={() => onChange(rules.filter((_, j) => j !== i))} /></div>)}
    <Button size="sm" icon="plus" onClick={() => onChange([...rules, { mode: 'include', op: 'starts', value: '' }])} disabled={rules.length >= 20}>Añadir regla</Button>
  </fieldset>;
}

function History({ id, version, onRestored }: { id: number; version: number; onRestored: (t: Tag) => void }) {
  const [vs, setVs] = useState<Version[] | null>(null); const [open, setOpen] = useState<number | null>(null); const toast = useToast();
  useEffect(() => { versions(id).then(r => setVs(r.results)).catch(() => setVs([])); }, [id, version]);
  const rest = async (v: Version) => { if (!confirm(`¿Restaurar la versión ${v.version}? Se recupera su código y reglas (el estado Activo no cambia) y queda registrado en el historial.`)) return; try { const t = await restore(id, v.id); toast(`Versión ${v.version} restaurada`); onRestored(t); } catch (e) { toast(errMsg(e), 'err'); } };
  return <Card title="Historial de versiones" pad={false}>
    {!vs ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : vs.length === 0 ? <p className="p-4 text-[13px] text-slate">Sin historial.</p> :
      <ul className="max-h-[420px] divide-y divide-line/70 overflow-auto">{vs.map((v, i) => <li key={v.id} className="px-4 py-2.5 text-[13px]">
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="font-semibold text-ink">v{v.version} · {ACTION_LABEL[v.action] ?? v.action} {i === 0 && <Chip tone="good">actual</Chip>}</div><div className="text-[12px] text-slate">{fmtDateTime(v.at)}{v.by ? ` · ${v.by}` : ''}</div></div>
          <div className="flex shrink-0 gap-1"><Button size="sm" onClick={() => setOpen(open === v.id ? null : v.id)} aria-expanded={open === v.id}>Ver</Button>{i > 0 && v.action !== 'delete' && <Button size="sm" onClick={() => void rest(v)}>Restaurar</Button>}</div></div>
        {open === v.id && <div className="mt-2 space-y-1.5">{v.parts.map((p, k) => <div key={k}><div className="text-[11.5px] font-bold text-slate">{PLACEMENT_LABEL[p.placement]}</div><pre className={cx('max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-canvas p-2', mono)}>{p.code}</pre></div>)}</div>}
      </li>)}</ul>}
  </Card>;
}
