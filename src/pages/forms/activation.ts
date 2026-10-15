// Reglas de activación de formularios por UTM (puro, sin dependencias). ESTE ARCHIVO SE COPIA TAL CUAL a
// web/src/pages/forms/activation.ts (el smoke comprueba que ambos son idénticos): el simulador del constructor
// y el servidor aplican exactamente la misma lógica.
//
// Modelo (form.settings.activation): { slot, isDefault, priority, rules[] }
//  · una regla = lista de condiciones que se cumplen TODAS (Y); basta UNA regla del formulario (O).
//  · operadores: eq (igual), starts (empieza con), contains (contiene), in (está en la lista, separada por comas). Sin distinguir mayúsculas.
//  · gana el formulario con mayor prioridad; si empatan, la regla con más condiciones; si empatan, el código menor (determinista).
//  · si ninguna regla coincide se usa el formulario "por defecto" de la ranura (si hay).
export type ActOp = 'eq' | 'starts' | 'contains' | 'in';
export type ActCond = { param: string; op: ActOp; value: string };
export type ActRule = { name?: string; conditions: ActCond[] };
export type Activation = { slot: string; isDefault: boolean; priority: number; rules: ActRule[] };
export type ActForm = { id: string; code: string; name: string; status: string; activation: Activation };
export type Params = Record<string, string>;

export const OP_LABEL: Record<ActOp, string> = { eq: 'es igual a', starts: 'empieza con', contains: 'contiene', in: 'está en la lista' };
export const KNOWN_PARAMS = ['utm_campaign', 'utm_source', 'utm_medium', 'utm_content', 'utm_term', 'utm_id', 'nx_service', 'nx_flow', 'nx_market', 'nx_lang', 'nx_lane'];
export const emptyActivation = (): Activation => ({ slot: '', isDefault: false, priority: 100, rules: [] });
const norm = (s: string) => String(s ?? '').trim().toLowerCase();
const list = (v: string) => v.split(',').map(norm).filter(Boolean);

export function condMatches(c: ActCond, params: Params): boolean {
  const raw = params[norm(c.param)]; if (raw === undefined) return false;
  const a = norm(raw), b = norm(c.value); if (!b) return false;
  switch (c.op) { case 'eq': return a === b; case 'starts': return a.startsWith(b); case 'contains': return a.includes(b); case 'in': return list(c.value).includes(a); default: return false; }
}
export const ruleMatches = (r: ActRule, params: Params) => r.conditions.length > 0 && r.conditions.every(c => condMatches(c, params));

export type Pick = { form: ActForm; via: 'rule' | 'default'; ruleIndex: number | null; priority: number };
/** Candidatos de una ranura (solo formularios cuya activación está en esa ranura), ordenados de mejor a peor. */
export function rank(forms: ActForm[], slot: string, params: Params): Pick[] {
  const inSlot = forms.filter(f => f.activation.slot === slot);
  const out: (Pick & { spec: number })[] = [];
  for (const f of inSlot) f.activation.rules.forEach((r, i) => { if (ruleMatches(r, params)) out.push({ form: f, via: 'rule', ruleIndex: i, priority: f.activation.priority, spec: r.conditions.length }); });
  const cmp = (a: { priority: number; spec: number; form: ActForm }, b: typeof a) => b.priority - a.priority || b.spec - a.spec || a.form.code.localeCompare(b.form.code);
  out.sort(cmp);
  const seen = new Set<string>(); const rules = out.filter(x => (seen.has(x.form.id) ? false : (seen.add(x.form.id), true)));   // una entrada por formulario (su mejor regla)
  const defs = inSlot.filter(f => f.activation.isDefault && !seen.has(f.id)).map(f => ({ form: f, via: 'default' as const, ruleIndex: null, priority: f.activation.priority, spec: 0 })).sort(cmp);
  return [...rules, ...defs].map(({ spec: _s, ...p }) => p);
}
/** Ganador: la mejor regla; si ninguna coincide, el formulario por defecto. */
export function pick(forms: ActForm[], slot: string, params: Params): Pick | null {
  const r = rank(forms, slot, params); return r.find(x => x.via === 'rule') ?? r.find(x => x.via === 'default') ?? null;
}

/* ---------- conflictos ---------- */
const vals = (c: ActCond) => (c.op === 'in' ? list(c.value) : [norm(c.value)]);
function pairOk(o1: ActOp, x: string, o2: ActOp, y: string): boolean {
  if (o1 === 'in') o1 = 'eq'; if (o2 === 'in') o2 = 'eq';
  if (o1 === 'eq' && o2 === 'eq') return x === y;
  if (o1 === 'eq') return o2 === 'starts' ? x.startsWith(y) : x.includes(y);
  if (o2 === 'eq') return o1 === 'starts' ? y.startsWith(x) : y.includes(x);
  if (o1 === 'starts' && o2 === 'starts') return x.startsWith(y) || y.startsWith(x);
  return true;   // starts/contains · contains/contains: pueden coincidir
}
const condsOverlap = (a: ActCond, b: ActCond) => vals(a).some(x => vals(b).some(y => pairOk(a.op, x, b.op, y)));
/** ¿Existe alguna URL que cumpla las dos reglas a la vez? (comparación conservadora: parámetros distintos siempre pueden coincidir) */
export function rulesOverlap(a: ActRule, b: ActRule): boolean {
  for (const ca of a.conditions) for (const cb of b.conditions) if (norm(ca.param) === norm(cb.param) && !condsOverlap(ca, cb)) return false;
  return true;
}
export const describeCond = (c: ActCond) => `${c.param} ${OP_LABEL[c.op]} “${c.value}”`;
export const describeRule = (r: ActRule) => r.conditions.map(describeCond).join(' y ');
export type ActIssue = { level: 'tie' | 'overlap'; a: string; b: string; slot: string; msg: string };
/** Pares de formularios de la misma ranura que se podrían activar con la misma URL. 'tie' = empate real (error); 'overlap' = se resuelve por prioridad (aviso). */
export function conflicts(forms: ActForm[]): ActIssue[] {
  const out: ActIssue[] = [];
  for (let i = 0; i < forms.length; i++) for (let j = i + 1; j < forms.length; j++) {
    const A = forms[i], B = forms[j]; if (!A.activation.slot || A.activation.slot !== B.activation.slot) continue;
    const slot = A.activation.slot; const samePrio = A.activation.priority === B.activation.priority;
    const who = (hi: ActForm, lo: ActForm) => `Gana “${hi.name}” (prioridad ${hi.activation.priority}) sobre “${lo.name}” (${lo.activation.priority}).`;
    const tieMsg = `empatan en prioridad ${A.activation.priority}: no se sabe cuál gana. Cambia la prioridad de uno de los dos.`;
    rules: for (const ra of A.activation.rules) for (const rb of B.activation.rules) {
      if (!rulesOverlap(ra, rb)) continue;
      const shared = ra.conditions.some(ca => rb.conditions.some(cb => norm(ca.param) === norm(cb.param)));   // reglas sobre parámetros distintos solo chocan si la URL trae ambos: aviso, no error
      const tie = samePrio && shared && ra.conditions.length === rb.conditions.length;
      const why = `“${A.name}” (${describeRule(ra)}) y “${B.name}” (${describeRule(rb)}) se activarían con las mismas UTM`;
      out.push({ level: tie ? 'tie' : 'overlap', a: A.id, b: B.id, slot, msg: tie ? `${why} y ${tieMsg}` : `${why}. ${!shared ? 'Solo chocan si la URL trae ambos parámetros; en ese caso gana el de mayor prioridad (o, a igualdad, el de código menor).' : samePrio ? 'Gana la regla con más condiciones.' : A.activation.priority > B.activation.priority ? who(A, B) : who(B, A)}` });
      break rules;
    }
    if (A.activation.isDefault && B.activation.isDefault) out.push({ level: samePrio ? 'tie' : 'overlap', a: A.id, b: B.id, slot, msg: `“${A.name}” y “${B.name}” son formulario por defecto de la misma ranura “${slot}”. ${samePrio ? 'Quita uno o cambia la prioridad.' : 'Se usará el de mayor prioridad.'}` });
  }
  return out;
}
