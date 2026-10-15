// Pestañas "Activación" (reglas por UTM) y "Probar" (enlace de prueba + simulador) del constructor de formularios.
import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../lib/auth';
import { Button, Card, Field, IconButton, Input, Pill, Select, Switch, cx } from '../../components/ui';
import Icon from '../../components/Icon';
import { KNOWN_PARAMS, OP_LABEL, conflicts, describeRule, emptyActivation, rank, type ActForm, type ActOp, type ActRule, type Activation, type Params } from './activation';
import type { FormV2 } from './model';

const origin = () => location.origin;
export const toAct = (f: FormV2, status?: string): ActForm => ({ id: f.id, code: f.code ?? f.slug, name: f.name, status: status ?? f.status, activation: { ...emptyActivation(), ...(f.settings.activation ?? {}) } });
/** Un valor de ejemplo que cumple la condición (para armar el enlace de prueba). */
const sample = (c: { op: ActOp; value: string }) => (c.op === 'in' ? c.value.split(',')[0].trim() : c.op === 'eq' ? c.value : c.value + (c.op === 'starts' ? '-prueba' : ''));
export const ruleParams = (r: ActRule): Params => { const o: Params = {}; for (const c of r.conditions) if (c.param && c.value && !(c.param in o)) o[c.param] = sample(c); return o; };
const qs = (p: Params) => new URLSearchParams(Object.entries(p).filter(([k, v]) => k && v)).toString();
export const contactoUrl = (p: Params, test = false, slot = 'contacto') => `${origin()}/contacto?${qs({ ...(slot !== 'contacto' ? { slot } : {}), ...p, ...(test ? { test: '1' } : {}) })}`;

/** Código para pegar en la web (nexahome.example/contacto): iframe con los parámetros UTM de la página y altura automática. */
export const embedSnippet = (crm: string) => `<div id="nx-contacto"></div>
<script>
(function () {
  var CRM = '${crm}';
  var q = new URLSearchParams(location.search);          // UTM y demás parámetros de ESTA página
  q.set('embed', '1'); q.set('_u', location.href.split('#')[0]);
  var f = document.createElement('iframe');
  f.src = CRM + '/contacto?' + q.toString();
  f.title = 'Formulario de contacto'; f.loading = 'lazy';
  f.style.cssText = 'width:100%;border:0;display:block;min-height:480px';
  document.getElementById('nx-contacto').appendChild(f);
  window.addEventListener('message', function (e) {      // el formulario avisa de su altura real
    if (e.source !== f.contentWindow || e.origin !== CRM) return;
    if (e.data && e.data.type === 'nx-form-height') f.style.height = Math.min(Math.max(Number(e.data.height) || 0, 320), 5000) + 'px';
  });
})();
</script>`;

/* ============================ Activación ============================ */
export function ActivationTab({ f, setS, allForms }: { f: FormV2; setS: (p: Partial<FormV2['settings']>) => void; allForms: FormV2[] }) {
  const a: Activation = { ...emptyActivation(), ...(f.settings.activation ?? {}) }; const set = (p: Partial<Activation>) => setS({ activation: { ...a, ...p } });
  const setRule = (i: number, r: ActRule) => set({ rules: a.rules.map((x, k) => (k === i ? r : x)) });
  const slots = useMemo(() => [...new Set(['contacto', ...allForms.map(x => x.settings.activation?.slot).filter(Boolean) as string[]])], [allForms]);
  const issues = useMemo(() => { const others = allForms.filter(x => x.id !== f.id && x.status === 'published').map(x => toAct(x)); return conflicts([...others, toAct(f, 'published')]).filter(i => i.a === f.id || i.b === f.id); }, [allForms, f]);
  const ties = issues.filter(i => i.level === 'tie'); const cond0 = a.rules.some(r => r.conditions.some(c => !c.param || !c.value.trim()));
  const noSlot = (a.rules.length > 0 || a.isDefault) && !a.slot;
  return <div className="space-y-4">
    <Card title="¿Dónde y con qué prioridad aparece?"><p className="mb-3 text-[13px] text-slate">Una <b>ranura</b> es un lugar de la web donde el formulario cambia según la UTM. La página <code className="font-mono">/contacto</code> usa la ranura <code className="font-mono">contacto</code>: allí gana el formulario cuyas reglas coinciden con los parámetros de la URL.</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Ranura"><Input list="act-slots" value={a.slot} onChange={e => set({ slot: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) })} placeholder="contacto" aria-invalid={noSlot} /><datalist id="act-slots">{slots.map(s => <option key={s} value={s} />)}</datalist></Field>
        <Field label="Prioridad (0–1000)"><Input inputMode="numeric" value={a.priority} onChange={e => set({ priority: Math.max(0, Math.min(1000, Number(e.target.value.replace(/\D/g, '')) || 0)) })} /></Field></div>
      <p className="-mt-1 mb-3 text-[12.5px] text-slate">Si dos formularios coinciden con la misma URL, gana el de <b>mayor prioridad</b>; si empatan, el que tiene más condiciones.</p>
      <div className="flex items-start gap-3"><Switch on={a.isDefault} onChange={v => set({ isDefault: v, slot: a.slot || (v ? 'contacto' : '') })} label="Formulario por defecto de la ranura" /><span className="text-[13.5px]"><b className="text-navy">Formulario por defecto</b> — se muestra cuando ninguna regla coincide (por ejemplo, tráfico sin UTM).</span></div>
      {noSlot && <p role="alert" className="mt-2 text-[13px] font-semibold text-bad">Indica la ranura (por ejemplo, contacto).</p>}</Card>
    <Card title="Reglas de activación" action={<Button size="sm" icon="plus" onClick={() => set({ rules: [...a.rules, { name: '', conditions: [{ param: 'utm_campaign', op: 'starts', value: '' }] }] })}>Agregar regla</Button>}>
      <p className="mb-3 text-[13px] text-slate">Dentro de una regla se deben cumplir <b>todas</b> las condiciones (Y). Basta con que se cumpla <b>una</b> regla (O). Sin distinguir mayúsculas.</p>
      {a.rules.length === 0 && <p className="rounded-lg bg-canvas px-3 py-4 text-center text-[13.5px] text-slate">Sin reglas: este formulario solo aparece en su ranura si lo marcas como “por defecto”. Agrega una regla para activarlo con una UTM.</p>}
      <ul className="space-y-3">{a.rules.map((r, i) => <li key={i}>{i > 0 && <p className="mb-1 text-center text-[12px] font-bold tracking-wide text-mute">— O —</p>}
        <div className="rounded-xl border border-line p-3" data-testid="rule">
          <div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{i + 1}</span><Input aria-label={`Nombre de la regla ${i + 1}`} placeholder="Nombre (opcional), p. ej. Campaña cocina ESP" value={r.name ?? ''} onChange={e => setRule(i, { ...r, name: e.target.value })} /><IconButton n="trash" label={`Quitar regla ${i + 1}`} onClick={() => set({ rules: a.rules.filter((_, k) => k !== i) })} /></div>
          <ul className="space-y-2">{r.conditions.map((c, j) => <li key={j} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <Input list="act-params" aria-label="Parámetro de la URL" placeholder="utm_campaign" value={c.param} onChange={e => setRule(i, { ...r, conditions: r.conditions.map((x, k) => (k === j ? { ...x, param: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') } : x)) })} />
            <Select aria-label="Operador" value={c.op} onChange={e => setRule(i, { ...r, conditions: r.conditions.map((x, k) => (k === j ? { ...x, op: e.target.value as ActOp } : x)) })}>{(Object.keys(OP_LABEL) as ActOp[]).map(o => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</Select>
            <Input aria-label="Valor" placeholder={c.op === 'in' ? 'valor1, valor2, valor3' : 'valor'} value={c.value} onChange={e => setRule(i, { ...r, conditions: r.conditions.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })} />
            <IconButton n="x" label="Quitar condición" disabled={r.conditions.length === 1} onClick={() => setRule(i, { ...r, conditions: r.conditions.filter((_, k) => k !== j) })} /></li>)}</ul>
          <datalist id="act-params">{KNOWN_PARAMS.map(p => <option key={p} value={p} />)}</datalist>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Button size="sm" icon="plus" onClick={() => setRule(i, { ...r, conditions: [...r.conditions, { param: 'nx_flow', op: 'eq', value: '' }] })}>Y otra condición</Button>
            {r.conditions.every(c => c.param && c.value.trim()) && a.slot && <a href={contactoUrl(ruleParams(r), true, a.slot)} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-link hover:underline">Probar esta regla ↗</a>}</div></div></li>)}</ul>
      {cond0 && <p role="alert" className="mt-2 text-[13px] font-semibold text-bad">Completa el parámetro y el valor de todas las condiciones (o quita las que sobren).</p>}</Card>
    <Card title="Avisos de conflicto">
      {f.status !== 'published' && (a.rules.length > 0 || a.isDefault) && <p className="mb-2 rounded-lg bg-[#FFF8E6] px-3 py-2 text-[13px] text-[#7A5600]">Este formulario es un borrador: sus reglas solo actúan cuando lo publiques. El análisis de abajo supone que ya está publicado.</p>}
      {issues.length === 0 ? <p className="flex items-center gap-2 text-[13.5px] text-good"><Icon n="check" s={15} />Sin conflictos con otros formularios publicados.</p>
        : <ul className="space-y-2" aria-live="polite">{issues.map((i, k) => <li key={k} className={cx('flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]', i.level === 'tie' ? 'bg-red-50 font-semibold text-bad' : 'bg-[#FFF8E6] text-[#7A5600]')}><Icon n="warn" s={14} className="mt-0.5 shrink-0" /><span>{i.level === 'tie' ? 'Conflicto: ' : 'Aviso: '}{i.msg}</span></li>)}</ul>}
      {ties.length > 0 && f.status === 'published' && <p className="mt-2 text-[12.5px] font-semibold text-bad">El servidor no deja guardar un formulario publicado con un empate. Cambia la prioridad.</p>}</Card>
  </div>;
}

/* ============================ Probar ============================ */
type Pair = { k: string; v: string };
export function TestTab({ f, saved, dirty, allForms, copy }: { f: FormV2; saved: FormV2 | null; dirty: boolean; allForms: FormV2[]; copy: (t: string, m?: string) => void }) {
  const a = { ...emptyActivation(), ...(f.settings.activation ?? {}) }; const o = f.settings.onSubmit;
  const direct = f.code ? `${origin()}/landing/${f.code}` : '';
  const [slot, setSlot] = useState(a.slot || 'contacto');
  const [pairs, setPairs] = useState<Pair[]>(() => { const r = a.rules[0]; const p = r ? ruleParams(r) : {}; const e = Object.entries(p); return e.length ? e.map(([k, v]) => ({ k, v })) : [{ k: 'utm_campaign', v: '' }]; });
  const params: Params = useMemo(() => Object.fromEntries(pairs.filter(p => p.k.trim() && p.v.trim()).map(p => [p.k.trim().toLowerCase(), p.v.trim()])), [pairs]);
  // el simulador usa los formularios guardados; el actual entra con lo que estás editando (así ves el efecto antes de guardar)
  const forms = useMemo(() => [...allForms.filter(x => x.id !== f.id).map(x => toAct(x)), toAct(f)], [allForms, f]);
  const ranked = useMemo(() => rank(forms, slot, params), [forms, slot, params]);
  const pub = ranked.filter(r => r.form.status === 'published'); const winner = pub.find(r => r.via === 'rule') ?? pub.find(r => r.via === 'default') ?? null;
  const setPair = (i: number, p: Partial<Pair>) => setPairs(a => a.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const [server, setServer] = useState<string>('');
  useEffect(() => {   // confirma con el servidor real (solo formularios guardados y publicados)
    if (dirty) { setServer('Guarda los cambios para comparar con lo que responde el servidor.'); return; }
    const h = setTimeout(() => { fetch(`${API_URL}/api/v1/public/forms/resolve?${new URLSearchParams({ slot, ...params })}`).then(async r => { if (r.status === 404) return setServer('El servidor no tiene ningún formulario para estos parámetros.'); if (!r.ok) return setServer(`El servidor respondió ${r.status}.`); const j = await r.json(); setServer(`El servidor mostraría: “${j.name}” (${j.code})${j.resolved?.via === 'default' ? ' · por defecto' : j.resolved?.rule ? ` · regla ${j.resolved.rule}` : ''}.`); }).catch(() => setServer('')); }, 400);
    return () => clearTimeout(h);
  }, [slot, params, dirty]);
  const mine = winner?.form.id === f.id;
  const startProps = o.setProps.filter(k => (k.when ?? 'submit') === 'start'), submitProps = o.setProps.filter(k => (k.when ?? 'submit') === 'submit');
  return <div className="space-y-4">
    <Card title="Enlace directo"><p className="mb-2 text-[13px] text-slate">Abre este formulario tal cual, sin importar la UTM.</p>
      {direct ? <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 font-mono text-[13px]">{direct}</code><Button onClick={() => copy(direct, 'Enlace copiado')}>Copiar</Button><Button onClick={() => window.open(direct, '_blank', 'noopener')}>Abrir</Button></div>
        <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-[#FFF8E6] px-3 py-2 font-mono text-[13px]">{direct}?test=1</code><Button onClick={() => copy(direct + '?test=1', 'Enlace de prueba copiado')}>Copiar</Button><Button data-testid="open-test" onClick={() => window.open(direct + '?test=1', '_blank', 'noopener')}>Abrir en modo prueba</Button></div></div>
        : <p className="text-[13.5px] text-slate">Guarda el formulario para generar su enlace.</p>}
      {f.status !== 'published' && direct && <p className="mt-2 rounded-lg bg-[#FFF8E6] px-3 py-2 text-[13px] text-[#7A5600]">Es un borrador: el enlace no abrirá hasta que lo publiques.</p>}
      <p className="mt-3 text-[12.5px] text-slate"><b>Modo prueba</b> (<code className="font-mono">?test=1</code>): se valida todo igual que en un envío real, pero <b>no se crea ni se modifica ningún contacto ni registro</b>. El envío queda guardado con la etiqueta PRUEBA (en Compartir → Últimos envíos) junto con lo que se habría guardado.</p></Card>
    <Card title="Simulador de UTM"><p className="mb-3 text-[13px] text-slate">Escribe los parámetros de una URL de campaña y mira qué formulario se activaría en esa ranura.</p>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]"><Field label="Ranura"><Input value={slot} onChange={e => setSlot(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></Field>
        <div><span className="mb-1.5 block text-[12.5px] font-bold text-slate">Parámetros de la URL</span><ul className="space-y-2">{pairs.map((p, i) => <li key={i} className="grid items-center gap-2 grid-cols-[1fr_1.4fr_auto]"><Input list="act-params" aria-label="Parámetro" value={p.k} onChange={e => setPair(i, { k: e.target.value })} placeholder="utm_campaign" /><Input aria-label="Valor del parámetro" value={p.v} onChange={e => setPair(i, { v: e.target.value })} placeholder="valor" /><IconButton n="x" label="Quitar parámetro" onClick={() => setPairs(a => a.filter((_, k) => k !== i))} /></li>)}</ul>
          <div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" icon="plus" onClick={() => setPairs(a => [...a, { k: '', v: '' }])}>Parámetro</Button>{KNOWN_PARAMS.filter(k => !pairs.some(p => p.k === k)).slice(0, 5).map(k => <Button key={k} size="sm" onClick={() => setPairs(a => [...a.filter(x => x.k || x.v), { k, v: '' }])}>+ {k}</Button>)}</div></div></div>
      <div className="mt-4 rounded-xl border border-line bg-canvas p-3" aria-live="polite" data-testid="sim-result">
        {winner ? <p className="text-[14px]"><span className="text-slate">Se activaría: </span><b className="text-navy" data-testid="sim-winner">{winner.form.name}</b> <Pill color={mine ? 'bg-[#E6F4EC] text-[#00704A]' : 'bg-line text-slate'}>{mine ? 'este formulario' : 'otro formulario'}</Pill> <span className="text-[12.5px] text-slate">{winner.via === 'default' ? 'por ser el formulario por defecto' : `por la regla ${(winner.ruleIndex ?? 0) + 1}: ${describeRule(winner.form.activation.rules[winner.ruleIndex ?? 0])}`}</span></p>
          : <p className="text-[14px] text-bad" data-testid="sim-winner">Ningún formulario publicado se activaría con estos parámetros{ranked.length ? '' : ' (y la ranura no tiene formulario por defecto)'}.</p>}
        {ranked.filter(r => r.form.status !== 'published').map(r => <p key={r.form.id} className="mt-1 text-[12.5px] text-[#7A5600]">“{r.form.name}” también coincidiría, pero es un borrador: no aparece al público.</p>)}
        {pub.length > 1 && <p className="mt-1 text-[12.5px] text-slate">También coinciden: {pub.filter(r => r !== winner).map(r => `“${r.form.name}”`).join(', ')} (gana el de mayor prioridad).</p>}
        {server && <p className="mt-2 border-t border-line pt-2 text-[12.5px] text-slate" data-testid="sim-server">{server}</p>}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 font-mono text-[12.5px]">{contactoUrl(params, true, slot)}</code>
        <Button onClick={() => copy(contactoUrl(params, true, slot), 'Enlace copiado')}>Copiar</Button><Button variant="primary" data-testid="open-contacto" onClick={() => window.open(contactoUrl(params, true, slot), '_blank', 'noopener')}>Abrir /contacto (prueba)</Button><Button onClick={() => window.open(contactoUrl(params, false, slot), '_blank', 'noopener')}>Abrir sin prueba</Button></div>
      {saved === null && <p className="mt-2 text-[12.5px] text-slate">Guarda el formulario para probar el enlace real.</p>}</Card>
    <Card title="Qué se llena solo al activarse"><p className="mb-2 text-[13px] text-slate">Valores fijos de la pestaña “Al enviar”, según el momento elegido.</p>
      <div className="grid gap-3 sm:grid-cols-2"><div><h4 className="mb-1 text-[12.5px] font-bold text-slate">Al empezar a llenar {o.captureEarly ? <Pill color="bg-[#E6F4EC] text-[#00704A]">captura temprana activa</Pill> : <Pill color="bg-line text-slate">captura temprana apagada</Pill>}</h4>{startProps.length ? <ul className="text-[13px]">{startProps.map((k, i) => <li key={i}><code className="font-mono">{k.prop}</code> = <b>{k.value || '—'}</b></li>)}</ul> : <p className="text-[13px] text-slate">Ninguno.</p>}{startProps.length > 0 && !o.captureEarly && <p className="mt-1 text-[12px] text-[#7A5600]">Con la captura temprana apagada se guardan al enviar.</p>}</div>
        <div><h4 className="mb-1 text-[12.5px] font-bold text-slate">Al enviar</h4>{submitProps.length ? <ul className="text-[13px]">{submitProps.map((k, i) => <li key={i}><code className="font-mono">{k.prop}</code> = <b>{k.value || '—'}</b></li>)}</ul> : <p className="text-[13px] text-slate">Ninguno.</p>}</div></div></Card>
  </div>;
}
