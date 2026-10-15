import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, inputCls } from '../../components/ui';
import Icon from '../../components/Icon';
import type { FField, FStep, PublicForm } from './model';

export type SubmitPayload = { values: Record<string, unknown>; terms: boolean; files: string[]; utm: Record<string, string>; lang: 'es' | 'en'; website: string; token?: string; test?: boolean; resolved?: { slot: string; via: 'rule' | 'default'; rule: number | null } };
type Props = {
  def: PublicForm; preview?: boolean; stepIndex?: number; onStepChange?: (i: number) => void;
  onSubmit?: (p: SubmitPayload) => Promise<{ ok: true; redirectUrl?: string } | { ok: false; fields?: Record<string, string>; error?: string }>;
  onUpload?: (file: File) => Promise<string>;
  /** Captura temprana: se llama al avanzar del paso con correo/teléfono; devuelve el token del contacto parcial (o null). */
  onPartial?: (p: SubmitPayload) => Promise<{ token: string | null; stop?: boolean }>;
  test?: boolean; resolved?: SubmitPayload['resolved'];
};
const T = {
  es: { required: 'Obligatorio', email: 'Escribe un correo válido', phone: 'Escribe un teléfono válido', number: 'Escribe un número', min: (n: number) => `Mínimo ${n}`, max: (n: number) => `Máximo ${n}`, terms: 'Debes aceptarlo para continuar', pick: 'Elige una opción', step: (i: number, n: number) => `Paso ${i} de ${n}`, owner: 'Soy el propietario de la vivienda', upload: 'Toca para elegir fotos', photos: (n: number) => `${n} foto${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'}`, sending: 'Enviando…', err: 'No pudimos enviar el formulario. Inténtalo de nuevo.', area: 'Estamos preparando tus medidas con la dirección que indicaste.', preview: 'Vista previa: no se envía nada.', remove: 'Quitar', uploadFail: 'No se pudo subir esa foto' },
  en: { required: 'Required', email: 'Enter a valid email', phone: 'Enter a valid phone number', number: 'Enter a number', min: (n: number) => `Minimum ${n}`, max: (n: number) => `Maximum ${n}`, terms: 'You must accept to continue', pick: 'Choose an option', step: (i: number, n: number) => `Step ${i} of ${n}`, owner: 'I am the homeowner', upload: 'Tap to choose photos', photos: (n: number) => `${n} photo${n === 1 ? '' : 's'} ready`, sending: 'Sending…', err: 'We could not send the form. Please try again.', area: 'We are preparing your measurements from the address you entered.', preview: 'Preview: nothing is sent.', remove: 'Remove', uploadFail: 'That photo could not be uploaded' },
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export default function FormRenderer({ def, preview, stepIndex, onStepChange, onSubmit, onUpload, onPartial, test, resolved }: Props) {
  const t = T[def.language === 'en' ? 'en' : 'es']; const steps = def.steps; const n = steps.length;
  const [idxState, setIdxState] = useState(0); const idx = Math.min(stepIndex ?? idxState, Math.max(0, n - 1)); const go = (i: number) => { setIdxState(i); onStepChange?.(i); window.scrollTo?.({ top: 0 }); };
  const [vals, setVals] = useState<Record<string, unknown>>({}); const [errs, setErrs] = useState<Record<string, string>>({}); const [boxes, setBoxes] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<{ key: string; url: string }[]>([]); const [busy, setBusy] = useState(false); const [done, setDone] = useState<null | { redirectUrl?: string }>(null); const [fail, setFail] = useState('');
  const [hp, setHp] = useState(''); const topRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true); const tokenRef = useRef<string | undefined>(undefined); const lastPartial = useRef(''); const chain = useRef<Promise<unknown>>(Promise.resolve()); const stopped = useRef(false);
  useEffect(() => { setErrs({}); if (first.current) { first.current = false; return; } topRef.current?.focus({ preventScroll: true }); }, [idx]);   // el foco pasa al título del paso nuevo (lectores de pantalla), no en la carga inicial
  useEffect(() => { if (done?.redirectUrl) { const u = done.redirectUrl; const h = setTimeout(() => { window.location.href = u; }, 1500); return () => clearTimeout(h); } }, [done]);
  const step = steps[idx]; const set = (id: string, v: unknown) => { setVals(s => ({ ...s, [id]: v })); setErrs(e => { if (!e[id]) return e; const { [id]: _, ...r } = e; return r; }); };
  // _u: la página contenedora cuando el formulario va en un iframe
  const utm = useMemo(() => { const o: Record<string, string> = {}; try { const q = new URLSearchParams(window.location.search); for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid', 'ad_platform']) { const v = q.get(k); if (v) o[k] = v.slice(0, 300); } o.landing_page_url = window.location.href.slice(0, 1000); const u = q.get('_u'); if (u && /^https?:\/\//i.test(u)) o.landing_page_url = u.slice(0, 1000); } catch { /* */ } return o; }, []);

  const validateField = (f: FField): string => {
    if (f.type === 'hidden' || f.type === 'file') return '';
    const v = vals[f.id]; const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) return f.required ? t.required : '';
    const s = String(v);
    if (f.type === 'email' && !EMAIL.test(s)) return t.email;
    if (f.type === 'phone' && s.replace(/\D/g, '').length < 8) return t.phone;
    if (f.type === 'number') { const x = Number(s.replace(',', '.')); if (!Number.isFinite(x)) return t.number; if (f.min !== undefined && x < f.min) return t.min(f.min); if (f.max !== undefined && x > f.max) return t.max(f.max); }
    if (f.minLength && s.length < f.minLength) return t.min(f.minLength);
    if (f.type === 'checkbox' && f.required && v !== true) return t.required;
    return '';
  };
  const validateStep = (s: FStep): boolean => {
    const e: Record<string, string> = {}; for (const f of s.fields) { const m = validateField(f); if (m) e[f.id] = m; }
    if (s.requireTerms && !boxes[s.id + ':terms']) e[s.id + ':terms'] = t.terms;
    if ((s.requireCheckbox || (s.isHomeOwner && s.requireCheckbox)) && !boxes[s.id + ':owner']) e[s.id + ':owner'] = t.terms;
    setErrs(e); return !Object.keys(e).length;
  };
  const payload = (): SubmitPayload => ({ values: vals, terms: true, files: files.map(f => f.key), utm, lang: def.language, website: hp, ...(tokenRef.current ? { token: tokenRef.current } : {}), ...(test ? { test: true } : {}), ...(resolved ? { resolved } : {}) });
  const finish = async () => {
    for (let i = 0; i < n; i++) if (!validateStep(steps[i])) { go(i); return; }
    if (preview || !onSubmit) { setDone({}); return; }
    setBusy(true); setFail(''); await chain.current; const r = await onSubmit(payload()); setBusy(false);   // espera a que termine la captura en curso (trae el token)
    if (r.ok) { setDone({ redirectUrl: r.redirectUrl }); return; }
    if (r.fields) { setErrs(Object.fromEntries(Object.entries(r.fields).map(([k, m]) => [k, String(m)]))); const bad = steps.findIndex(s => s.fields.some(f => r.fields![f.id])); if (bad >= 0) go(bad); else setFail(t.err); } else setFail(t.err);
  };
  const hasContact = (s: FStep) => s.fields.some(f => f.type === 'email' || f.type === 'phone');   // la vista pública no trae el objeto: basta el tipo (el servidor solo usa lo que va a contactos)
  const anyValue = Object.values(vals).some(v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length));
  // Captura temprana (opcional, sin bloquear al visitante). 'first_field': desde el primer campo, con espera (debounce) al escribir y al cambiar de paso, y se va completando.
  // 'identity': solo al salir del paso con correo/teléfono. Las peticiones van en cola (una a la vez) para que el token llegue antes del siguiente envío.
  const capture = (force = false) => {
    if (!def.settings.captureEarly || !onPartial || preview || stopped.current) return;
    const first = def.settings.captureFrom !== 'identity';
    if (first ? !anyValue : !(force && hasContact(step))) return;
    const sig = JSON.stringify([vals, boxes]); if (sig === lastPartial.current) return; lastPartial.current = sig;
    chain.current = chain.current.then(() => onPartial({ ...payload(), terms: Object.values(boxes).some(Boolean) })).then(r => { if (r.token) tokenRef.current = r.token; if (r.stop) stopped.current = true; }).catch(() => {});
  };
  useEffect(() => { if (def.settings.captureFrom === 'identity' || !anyValue) return; const h = setTimeout(() => capture(), 1200); return () => clearTimeout(h); }, [vals]);   // eslint-disable-line
  const next = () => { if (!validateStep(step)) return; if (idx < n - 1) { capture(true); go(idx + 1); } else void finish(); };
  const single = step && step.fields.length === 1 && ['single-select', 'image-select'].includes(step.fields[0].type) && !step.requireTerms && !step.requireCheckbox;
  const pickAuto = (f: FField, v: string) => { set(f.id, v); if (single && !preview && idx < n - 1) setTimeout(() => go(idx + 1), 220); };   // un paso con una sola pregunta de opciones avanza solo (nunca tiene correo/teléfono)

  if (done) { const s = def.settings.success; return <div className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm" role="status"><span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#E6F4EC] text-good"><Icon n="check" s={26} /></span>
    <h2 className="font-display text-[24px] font-bold text-navy">{s.title1 || '✓'}</h2>{s.title2 && <p className="mt-2 text-[16px] font-semibold text-ink">{s.title2}</p>}{s.description1 && <p className="mt-2 text-[14.5px] text-slate">{s.description1}</p>}{s.description2 && <p className="mt-2 text-[14.5px] text-slate">{s.description2}</p>}
    {s.buttonLabel && s.buttonUrl && <a href={s.buttonUrl} className="mt-5 inline-flex h-11 items-center rounded-lg bg-navy px-6 text-[15px] font-semibold text-white hover:bg-navy-700">{s.buttonLabel}</a>}
    {preview && <p className="mt-4 text-[12.5px] text-mute">{t.preview}</p>}</div>; }
  if (!step) return null;
  const upload = async (list: FileList | null) => {
    if (!list || !onUpload) return; for (const file of Array.from(list).slice(0, 8 - files.length)) {
      try { const key = await onUpload(file); setFiles(a => [...a, { key, url: URL.createObjectURL(file) }]); } catch { setErrs(e => ({ ...e, [step.id + ':files']: t.uploadFail })); }
    }
  };
  return <form onSubmit={e => { e.preventDefault(); next(); }} noValidate className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8" aria-labelledby={'st-' + step.id}>
    {n > 1 && <div className="mb-5"><div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-slate"><span>{t.step(idx + 1, n)}</span><span>{Math.round(((idx + 1) / n) * 100)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((idx + 1) / n) * 100)}><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((idx + 1) / n) * 100}%` }} /></div></div>}
    <h2 id={'st-' + step.id} ref={topRef} tabIndex={-1} className="font-display text-[22px] font-bold leading-tight text-navy outline-none focus:outline-none focus-visible:!outline-none sm:text-[26px]">{step.title}</h2>
    {step.subtitle && <p className="mt-1.5 text-[14.5px] text-slate">{step.subtitle}</p>}
    <div className="mt-5 space-y-5">
      {step.kind === 'area' && <p className="rounded-xl bg-sky px-4 py-3 text-[14px] text-navy">{t.area}</p>}
      {step.fields.filter(f => f.type !== 'hidden').map(f => <FieldView key={f.id} f={f} v={vals[f.id]} err={errs[f.id]} t={t} onChange={v => (f.type === 'single-select' || f.type === 'image-select') ? pickAuto(f, String(v)) : set(f.id, v)} onUpload={upload} files={files} removeFile={k => setFiles(a => a.filter(x => x.key !== k))} />)}
      {errs[step.id + ':files'] && <p role="alert" className="text-[13px] font-medium text-bad">{errs[step.id + ':files']}</p>}
      {step.isHomeOwner && <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-ink"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!boxes[step.id + ':owner']} onChange={e => setBoxes(b => ({ ...b, [step.id + ':owner']: e.target.checked }))} /><span>{def.settings.checkboxText || t.owner}</span></label>}
      {errs[step.id + ':owner'] && <p role="alert" className="-mt-3 text-[13px] font-medium text-bad">{errs[step.id + ':owner']}</p>}
      {step.requireTerms && <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-slate"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!boxes[step.id + ':terms']} onChange={e => setBoxes(b => ({ ...b, [step.id + ':terms']: e.target.checked }))} /><span>{def.settings.termsText || (def.language === 'en' ? 'I agree to be contacted and accept the terms and privacy policy.' : 'Acepto que me contacten y los términos y la política de privacidad.')}{def.settings.termsUrl && <> <a href={def.settings.termsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-link underline">↗</a></>}</span></label>}
      {errs[step.id + ':terms'] && <p role="alert" className="-mt-3 text-[13px] font-medium text-bad">{errs[step.id + ':terms']}</p>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e => setHp(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
    </div>
    {fail && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] font-medium text-bad">{fail}</p>}
    <div className="mt-6 flex items-center gap-3">
      {idx > 0 && <button type="button" onClick={() => go(idx - 1)} className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-lg border border-line-2 px-4 text-[14.5px] font-semibold text-navy hover:bg-sky"><Icon n="chevL" s={14} />{def.settings.backLabel}</button>}
      {!single && <button type="submit" disabled={busy} className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-navy px-5 text-[15px] font-semibold text-white hover:bg-navy-700 disabled:opacity-60">{busy ? t.sending : idx === n - 1 ? def.settings.submitLabel : def.settings.nextLabel}</button>}
      {single && idx === n - 1 && <button type="submit" disabled={busy} className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-navy px-5 text-[15px] font-semibold text-white hover:bg-navy-700 disabled:opacity-60">{busy ? t.sending : def.settings.submitLabel}</button>}
    </div>
    {preview && <p className="mt-3 text-center text-[12px] text-mute">{t.preview}</p>}
  </form>;
}

type FV = { f: FField; v: unknown; err?: string; t: (typeof T)['es']; onChange: (v: unknown) => void; onUpload: (l: FileList | null) => void; files: { key: string; url: string }[]; removeFile: (k: string) => void };
function FieldView({ f, v, err, t, onChange, onUpload, files, removeFile }: FV) {
  const id = 'f-' + f.id; const label = f.title || f.label; const opts = (f.options ?? []).filter(o => !o.hidden); const imgs = opts.some(o => o.image);
  const head = <legend className="mb-2 block text-[15px] font-semibold text-navy">{label}{f.required && <span className="text-bad" aria-hidden="true"> *</span>}</legend>;
  const msg = err ? <p role="alert" id={id + '-e'} className="mt-1.5 text-[13px] font-medium text-bad">{err}</p> : null;
  if (f.type === 'single-select' || f.type === 'image-select') return <fieldset aria-describedby={err ? id + '-e' : undefined}>{head}{f.helpText && <p className="-mt-1 mb-2 text-[13px] text-slate">{f.helpText}</p>}
    <div className={cx('grid gap-2.5', imgs ? 'grid-cols-2' : 'grid-cols-1')} role="radiogroup">{opts.map(o => { const on = v === o.value; return <button type="button" key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)} className={cx('cursor-pointer overflow-hidden rounded-xl border-2 text-left transition-colors', on ? 'border-link bg-sky' : 'border-line hover:border-line-2')}>
      {o.image && <img src={o.image} alt="" loading="lazy" className="h-28 w-full bg-white object-contain" />}<span className="flex items-center gap-2 px-3.5 py-3 text-[14.5px] font-semibold text-navy"><span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded-full border-2', on ? 'border-link bg-link' : 'border-line-2')}>{on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>{o.label}</span></button>; })}</div>{msg}</fieldset>;
  if (f.type === 'multi-select') { const sel = Array.isArray(v) ? (v as string[]) : []; return <fieldset aria-describedby={err ? id + '-e' : undefined}>{head}{f.helpText && <p className="-mt-1 mb-2 text-[13px] text-slate">{f.helpText}</p>}
    <div className={cx('grid gap-2.5', imgs ? 'grid-cols-2' : 'grid-cols-1')}>{opts.map(o => { const on = sel.includes(o.value); return <button type="button" key={o.value} role="checkbox" aria-checked={on} onClick={() => onChange(on ? sel.filter(x => x !== o.value) : [...sel, o.value])} className={cx('cursor-pointer overflow-hidden rounded-xl border-2 text-left transition-colors', on ? 'border-link bg-sky' : 'border-line hover:border-line-2')}>
      {o.image && <img src={o.image} alt="" loading="lazy" className="h-24 w-full bg-white object-contain" />}<span className="flex items-center gap-2 px-3.5 py-3 text-[14.5px] font-semibold text-navy"><span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded border-2', on ? 'border-link bg-link text-white' : 'border-line-2')}>{on && <Icon n="check" s={11} />}</span>{o.label}</span></button>; })}</div>{msg}</fieldset>; }
  if (f.type === 'checkbox') return <div><label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] text-ink"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={v === true} onChange={e => onChange(e.target.checked)} /><span>{label}{f.required && <span className="text-bad"> *</span>}</span></label>{msg}</div>;
  if (f.type === 'file') return <div><span className="mb-2 block text-[15px] font-semibold text-navy">{label}</span>
    <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-2 px-4 py-6 text-center text-[14px] text-slate hover:bg-sky/50"><Icon n="plus" s={20} />{t.upload}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" onChange={e => { onUpload(e.target.files); e.target.value = ''; }} /></label>
    {files.length > 0 && <><p className="mt-2 text-[13px] font-semibold text-good">{t.photos(files.length)}</p><div className="mt-2 flex flex-wrap gap-2">{files.map(x => <div key={x.key} className="relative"><img src={x.url} alt="" className="h-16 w-16 rounded-lg object-cover" /><button type="button" aria-label={t.remove} onClick={() => removeFile(x.key)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-navy text-white"><Icon n="x" s={10} /></button></div>)}</div></>}{msg}</div>;
  const common = { id, 'aria-invalid': !!err, 'aria-describedby': err ? id + '-e' : undefined, placeholder: f.placeholder, value: (v as string) ?? '', className: cx(inputCls, '!h-12 !text-[16px]', err && '!border-bad') };
  const type = f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : f.type === 'number' ? 'text' : f.type === 'date' ? 'date' : 'text';
  return <div><label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold text-navy">{label}{f.required && <span className="text-bad" aria-hidden="true"> *</span>}</label>{f.helpText && <p className="-mt-1 mb-1.5 text-[13px] text-slate">{f.helpText}</p>}
    {f.type === 'textarea' ? <textarea {...common} rows={4} maxLength={f.maxLength ?? 5000} onChange={e => onChange(e.target.value)} className={cx(common.className, '!h-auto py-3')} />
      : <input {...common} type={type} inputMode={f.type === 'phone' ? 'tel' : f.type === 'number' ? 'decimal' : f.type === 'email' ? 'email' : undefined} autoComplete={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : f.type === 'address' ? 'street-address' : f.prop === 'firstname' ? 'given-name' : f.prop === 'lastname' ? 'family-name' : undefined} maxLength={f.maxLength ?? 1000} onChange={e => onChange(e.target.value)} />}{msg}</div>;
}
