import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../lib/auth';
import { Logo, Spinner } from '../../components/ui';
import FormRenderer, { type SubmitPayload } from './FormRenderer';
import type { PublicForm as Def } from './model';

const base = `${API_URL}/api/v1/public/forms`;
type Resolved = NonNullable<SubmitPayload['resolved']>;
type State = 'loading' | 'ok' | 'missing' | 'error' | 'blocked';
/** Dominio que nos incrusta (Chrome/Safari: ancestorOrigins; si no, el referrer). Vacío = no se pudo saber. */
const parentOrigin = () => { try { const a = (window.location as any).ancestorOrigins?.[0]; if (a) return String(a); return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } };

/**
 * Página pública de un formulario, sin sesión ni menú del CRM.
 *  · /landing/<código>  → ese formulario, siempre (no cambia con la UTM).
 *  · /contacto          → resuelve el formulario según los parámetros UTM de la URL (ranura "contacto"). ?form=<código> fuerza uno; ?test=1 = envíos de prueba; ?embed=1 = dentro de un iframe.
 */
export default function PublicForm({ code, slot }: { code?: string; slot?: string }) {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const test = q.get('test') === '1'; const embed = q.get('embed') === '1';
  const [def, setDef] = useState<Def | null>(null); const [resolved, setResolved] = useState<Resolved | undefined>(); const [state, setState] = useState<State>('loading');
  useEffect(() => {
    let alive = true; setState('loading');
    (async () => {
      if (embed && window.top !== window.self) {   // defensa extra: la barrera real es frame-ancestors en el servidor web; aquí se corta si sabemos quién nos incrusta y no está en la lista
        try { const ok = await fetch(`${base}/embed-config`).then(r => r.json()) as { allowedOrigins: string[] }; const po = parentOrigin(); if (po && po !== window.location.origin && ok.allowedOrigins.length && !ok.allowedOrigins.includes(po)) { if (alive) setState('blocked'); return; } } catch { /* sin lista: se sigue */ }
      }
      let url: string; const explicit = slot ? q.get('form') : null;
      if (slot && !explicit) { const p = new URLSearchParams(); q.forEach((v, k) => { if (!['form', 'test', 'embed', '_u', 'slot'].includes(k)) p.append(k, v); }); const s = q.get('slot'); p.set('slot', s && /^[a-z0-9-]{1,40}$/.test(s) ? s : slot); url = `${base}/resolve?${p}`; }
      else url = `${base}/${encodeURIComponent(explicit ?? code ?? '')}`;
      const r = await fetch(url); if (!alive) return;
      if (r.status === 404) return setState('missing'); if (!r.ok) return setState('error');
      const j = await r.json(); setDef(j); setResolved(j.resolved); setState('ok');
    })().catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [code, slot, embed, q]);
  useEffect(() => { if (def) document.title = def.name; }, [def]);
  useEffect(() => {   // dentro de un iframe: avisa a la página contenedora de la altura real para que no haya barra de desplazamiento interna
    if (!embed || window.parent === window) return;
    const el = document.getElementById('nx-public-form'); document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
    const send = () => window.parent.postMessage({ type: 'nx-form-height', height: Math.ceil((el?.getBoundingClientRect().height ?? document.body.scrollHeight) + 8) }, '*');   // se mide el contenido, no la ventana (si no, el iframe nunca encoge)   // solo un número: no hay nada que proteger
    send(); const ro = new ResizeObserver(send); ro.observe(el ?? document.body); window.addEventListener('load', send);
    return () => { ro.disconnect(); window.removeEventListener('load', send); };
  }, [embed, state, def]);
  const fcode = def?.code ?? code ?? '';
  const submit = async (p: SubmitPayload) => {
    try {
      const r = await fetch(`${base}/${encodeURIComponent(fcode)}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        if (!test) { // aviso a Google Tag Manager / GA4 / Meta (vía GTM): lead enviado. Sin datos personales, solo identificadores del formulario y la campaña.
          try { const w = window as unknown as { dataLayer?: Record<string, unknown>[] }; (w.dataLayer ??= []).push({ event: 'generate_lead', nx_event: 'form_submit', form_code: fcode, form_name: def?.name ?? '', form_language: def?.language ?? '', utm_source: p.utm?.utm_source ?? '', utm_medium: p.utm?.utm_medium ?? '', utm_campaign: p.utm?.utm_campaign ?? '' }); } catch { /* sin dataLayer */ }
        }
        return { ok: true as const, redirectUrl: test ? undefined : j.redirectUrl as string | undefined };
      }
      return { ok: false as const, fields: j.fields as Record<string, string> | undefined, error: j.error as string | undefined };
    } catch { return { ok: false as const, error: 'network' }; }
  };
  const partial = async (p: SubmitPayload) => {
    const r = await fetch(`${base}/${encodeURIComponent(fcode)}/partial`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    const j = await r.json().catch(() => ({})); return { token: r.ok && typeof j.token === 'string' ? j.token as string : null, stop: r.ok && j.reason === 'exists' || r.status === 404 || r.status === 429 };   // 'exists': el contacto ya existía, no se vuelve a intentar
  };
  const upload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) throw new Error('too_large');
    const r = await fetch(`${base}/${encodeURIComponent(fcode)}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    if (!r.ok) throw new Error('upload_failed'); return (await r.json()).key as string;
  };
  const card = (title: string, text: string, retry?: boolean) => <div role={retry ? 'alert' : undefined} className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center"><h1 className="font-display text-[22px] font-bold text-navy">{title}</h1><p className="mt-2 text-[14.5px] text-slate">{text}</p>{retry && <button onClick={() => location.reload()} className="mt-4 cursor-pointer rounded-lg bg-navy px-5 py-2.5 text-[14.5px] font-semibold text-white">Reintentar</button>}</div>;
  return <main id="nx-public-form" className={embed ? 'min-h-0 bg-transparent px-1 py-2' : 'min-h-full bg-canvas px-4 py-8 sm:py-12'}>
    {!embed && <div className="mx-auto mb-6 flex max-w-xl items-center gap-2.5"><Logo size={30} /><span className="font-display text-[16px] font-bold text-navy">Nexa Home</span></div>}
    {test && state === 'ok' && <p role="status" data-testid="test-banner" className="mx-auto mb-4 max-w-xl rounded-lg border border-[#F0D9A6] bg-[#FFF8E6] px-3 py-2 text-center text-[13px] font-semibold text-[#7A5600]">Modo de prueba: lo que envíes se guarda como prueba y no crea ningún contacto.</p>}
    {state === 'loading' && <div className="grid place-items-center py-20 text-slate"><Spinner s={22} /></div>}
    {state === 'missing' && card(slot ? 'Todavía no hay un formulario para este enlace' : 'Este formulario no está disponible', slot ? 'Escríbenos y te ayudamos directamente.' : 'Puede que el enlace sea incorrecto o que ya no esté activo.')}
    {state === 'error' && card('No pudimos cargar el formulario', 'Revisa tu conexión e inténtalo de nuevo.', true)}
    {state === 'blocked' && card('Este formulario no se puede mostrar aquí', 'La página que lo incrusta no está autorizada.')}
    {state === 'ok' && def && <FormRenderer key={def.code} def={def} onSubmit={submit} onUpload={upload} onPartial={partial} test={test} resolved={resolved} />}
  </main>;
}
