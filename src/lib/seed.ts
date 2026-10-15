// Datos de EJEMPLO (ficticios) para ver la interfaz sin backend. Estructura idéntica a la de Nexa (nombres internos reales).
import { ME, OWNERS, PIPELINES, SETTERS } from './schema';
import type { AssocRow, ObjKey, Rec } from './types';

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export type Seed = { records: Record<ObjKey, Rec[]>; assoc: AssocRow[] };

const FIRST = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Pedro', 'Sofía', 'Miguel', 'Lucía', 'Diego', 'Elena', 'Andrés', 'Valeria', 'Javier', 'Camila', 'Rafael', 'Daniela', 'Mateo', 'Isabel', 'Tomás', 'John', 'Mary', 'Robert', 'Linda', 'James', 'Patricia', 'Michael', 'Jennifer', 'David', 'Sandra'];
const LAST = ['García', 'Rodríguez', 'Martínez', 'López', 'Pérez', 'Gómez', 'Sánchez', 'Díaz', 'Torres', 'Ramírez', 'Flores', 'Rivera', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'];
const STREETS = ['NW 201 Ter', 'SW 136th Ct', 'Coral Way', 'Biscayne Blvd', 'Palm Ave', 'Sunset Dr', 'Ocean View Rd', 'Maple St', 'Pine Hill Ln', 'Lakeshore Blvd'];
const CITIES: [string, string, string][] = [['Miami', 'FL', '331'], ['Hialeah', 'FL', '330'], ['Orlando', 'FL', '328'], ['Tampa', 'FL', '336'], ['Fort Lauderdale', 'FL', '333'], ['Los Angeles', 'CA', '900'], ['San Diego', 'CA', '921'], ['Sacramento', 'CA', '958']];
const STATUS_W: [string, number][] = [['New', 22], ['No Answer - Active Recall', 16], ['Research Pending', 8], ['Hot Follow-Up', 8], ['Recall - Short', 6], ['Recall - Long', 4], ['Follow-Up Needed', 6], ['Call later TODAY', 3], ['Appointment Set', 6], ['Sale', 3], ['Do Not Call', 3], ['Unreachable', 4], ['Lost - Not Interested', 4], ['Duplicate', 2], ['Switch Setter', 1], ['Future Buyer', 1], ['Out of Range', 1], ['Re-Hash', 1], ['B2B', 1]];
const PRODUCTS = ['Roofing', 'Windows', 'Kitchen', 'Bathroom'];
const PROD_DESC: Record<string, string[]> = { Roofing: ['Tile roof replacement', 'Shingles repair after storm', 'Metal roof quote', 'Flat roof leak'], Windows: ['Impact windows whole house', '5 windows + 1 door', 'Sliding glass door'], Kitchen: ['Full kitchen remodel', 'Countertops and cabinets'], Bathroom: ['Walk-in shower conversion', 'Master bath remodel'] };
const SLUGS = ['roofing-meta-es', 'windows-meta-es', 'kitchen-meta-en', 'roofing-organic', 'ddk-miami', 'bathroom-meta-es', 'roofing-meta-en'];
const CAMPAIGNS = ['META | Roofing | ES | Miami', 'META | Windows | ES | FL', 'META | Kitchen | EN | FL', 'META | Roofing | EN | CA', 'Organic Website'];
const CONTRACTORS: [string, string][] = [['Cedro Roofing Co', 'cedroroofing.example'], ['Atlas Construction', 'atlasconstruction.example'], ['Brisa Windows & Doors', 'brisawindows.example'], ['Faro Home Services', 'farohome.example'], ['Delta Remodeling', 'deltaremodeling.example'], ['Olmo Builders', 'olmobuilders.example'], ['Pinar Roofing', 'pinarroofing.example'], ['Costa Impact Windows', 'costaimpact.example'], ['Norte Construction Group', 'norteconstruction.example'], ['Sol Exteriors', 'solexteriors.example'], ['Mar Azul Builders', 'marazulbuilders.example'], ['Lumen Kitchens & Baths', 'lumenkb.example']];
const TASK_BRACKETS = ['Cold Recall', 'Hot Follow-Up', 'Recall Long', 'Call Later Today', 'Future Buyer', 'Re-Hash', 'Switch Setter', 'Cold Approach'];

export function buildSeed(now = Date.now()): Seed {
  const POOL = [...SETTERS, ME, ME];  // la sesión demo (Jose) también tiene registros asignados
  const R = rng(20261009);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const wpick = (w: [string, number][]) => { const t = w.reduce((s, x) => s + x[1], 0); let r = R() * t; for (const [v, n] of w) { if ((r -= n) < 0) return v; } return w[0][0]; };
  const iso = (ms: number) => new Date(ms).toISOString();
  const day = 86400000, hr = 3600000;
  const rec = (id: string, properties: Rec['properties'], created: number): Rec => ({ id, properties, createdAt: iso(created), updatedAt: iso(Math.min(now, created + R() * 3 * day)) });
  const records: Record<ObjKey, Rec[]> = { contacts: [], companies: [], deals: [], appointments: [], tasks: [], calls: [], notes: [], meetings: [], tickets: [], leads: [], communications: [], products: [], line_items: [], quotes: [], invoices: [] };
  const assoc: AssocRow[] = [];
  const link = (from: ObjKey, fromId: string, to: ObjKey, toId: string, label?: string) => assoc.push({ from, fromId, to, toId, label });
  let seq = 567000000000;
  const nid = () => String(seq += Math.floor(R() * 90000) + 1000);

  // Empresas (contratistas)
  CONTRACTORS.forEach(([name, domain], i) => {
    const c = pick(CITIES); const id = nid();
    records.companies.push(rec(id, { name, domain, phone: `+1305555${String(1000 + i * 7).slice(-4)}`, city: c[0], state: c[1], country: 'United States', industry: i % 3 === 0 ? 'Roofing' : i % 3 === 1 ? 'Construction' : 'Windows & Doors', hubspot_owner_id: i % 4 === 0 ? SETTERS[0].id : null, b2b_eligibility_status: pick(['Eligible', 'Review', 'Rejected', 'Eligible']), b2b_research_status: pick(['New', 'In Research', 'Research Complete', 'Needs Review']), notes_last_updated: iso(now - R() * 20 * day) }, now - (200 - i * 9) * day));
  });

  // Contactos
  const N = 340;
  for (let i = 0; i < N; i++) {
    const created = now - Math.pow(R(), 1.6) * 90 * day;
    const city = pick(CITIES); const first = pick(FIRST), last = pick(LAST);
    const product = pick(PRODUCTS); const status = wpick(STATUS_W);
    const ownerless = R() < 0.1; const setter = pick(POOL);
    const ctype = R() < 0.72 ? 'b2c' : R() < 0.5 ? 'nexahome' : 'B2B';
    const noEmail = R() < 0.2;
    const lastAct = status === 'New' && R() < 0.5 ? null : iso(created + R() * (now - created));
    const id = nid();
    const p: Rec['properties'] = {
      firstname: first, lastname: R() < 0.12 ? null : last, email: noEmail ? null : `${first}.${last}${i}@example.test`.toLowerCase().replace(/[áéíóúñ]/g, m => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n' } as any)[m]),
      mobilephone: `+1${city[2]}555${String(1000 + i * 13).slice(-4)}`, phone: R() < 0.2 ? `+1${city[2]}555${String(2000 + i * 11).slice(-4)}` : null,
      hs_lead_status: status, hubspot_owner_id: ownerless ? null : setter.id, contact_type: ctype, lead_temperature: pick(['Tier A', 'Tier B', 'Tier C']),
      lead_source: wpick([['Paid Ads', 60], ['Organic Website', 15], ['Digital Door Knocking', 10], ['Manual Setter', 8], ['Referral', 5], ['Other', 2]]),
      lead_language: R() < 0.7 ? 'Spanish' : 'English', product, product_description: pick(PROD_DESC[product]), slug: pick(SLUGS), meta_campaign_source: pick(CAMPAIGNS),
      address: `${100 + Math.floor(R() * 9000)} ${pick(STREETS)}`, city: city[0], state: city[1], zip: city[2] + String(10 + Math.floor(R() * 89)), lead_intake_status: wpick([['Complete', 70], ['Incomplete', 22], ['Manual Search Campaign', 8]]),
      hs_object_source_label: pick(['INTEGRATION', 'FORM', 'INTEGRATION', 'CRM_UI']), prioridad_de_seguimiento: pick(['Normal', 'Alta', 'Crítico', 'Confirmación']), buying_timeline: R() < 0.2 ? pick(['ASAP', '1-3 months', '3-6 months']) : null,
      notes_last_updated: lastAct, notes_last_contacted: lastAct && R() < 0.8 ? lastAct : null, notes_next_activity_date: R() < 0.35 ? iso(now + (R() * 6 - 1) * day) : null,
      roof_area: product === 'Roofing' ? String(1200 + Math.floor(R() * 2600)) : null, roof_report_sent: product === 'Roofing' && R() < 0.7 ? 'true' : null, contact_score: String(Math.floor(R() * 100)),
      report_reintentar: null, landing_page_url: `https://nexahome.example/${pick(SLUGS)}?utm_source=facebook&utm_campaign=demo`, utm_campaign: pick(CAMPAIGNS), nx__dispo_note: null, lifecyclestage: 'lead',
      kitchen_report_sent: product === 'Kitchen' && R() < 0.6 ? 'true' : null, kitchen_render_sent: product === 'Kitchen' && R() < 0.3 ? 'true' : null,
    };
    if (status === 'Appointment Set' || status === 'Sale') p.appointment_datetime = iso(now + (R() * 8 - 3) * day);
    records.contacts.push(rec(id, p, created));
  }

  const pc = records.contacts;
  // Citas (pipeline B2C)
  const apPipe = PIPELINES.appointments[0]; const apStages = apPipe.stages;
  const contactsWithAppt = pc.filter(c => ['Appointment Set', 'Sale', 'Hot Follow-Up', 'Recall - Short'].includes(c.properties.hs_lead_status!)).slice(0, 130);
  contactsWithAppt.forEach((c, i) => {
    const start = now + (R() * 9 - 4) * day; const id = nid();
    const pastLabel = wpick([['Completed', 30], ['Canceled', 10], ['Sale', 8], ['Still Working', 6], ['To Assign', 6]]);
    const stage = start > now ? (R() < 0.7 ? apStages[0] : apStages[1]) : apStages.find(st => st.label === pastLabel)!;
    const company = pick(records.companies);
    const confirmed = stage.label.startsWith('Confirmed') || stage.label === 'Completed' || stage.label === 'Sale' ? 'Confirmed' : stage.label === 'Canceled' ? 'Canceled' : 'Pending';
    records.appointments.push(rec(id, {
      hs_appointment_name: `${c.properties.firstname} ${c.properties.lastname ?? ''}`.trim() + (R() < 0.15 ? "'s Meeting" : ''), hs_appointment_start: iso(start), hs_appointment_end: null, hs_duration: null,
      hubspot_owner_id: c.properties.hubspot_owner_id ?? pick(POOL).id, hs_pipeline: apPipe.id, hs_pipeline_stage: stage.id, nx___appointment_confirmed_: confirmed, hs_object_source_label: pick(['CRM_UI', 'INTEGRATION']), hs_object_source_detail_1: null,
      hs_created_by_user_id: c.properties.hubspot_owner_id ?? null, hs_updated_by_user_id: c.properties.hubspot_owner_id ?? null, empresa_asignada: stage.label.startsWith('Confirmed') || stage.label === 'Completed' ? company.properties.name : null,
      nx___disposition__vendor_: stage.label === 'Sale' ? 'Won – Sale' : stage.label === 'Completed' ? pick(['Pending – Estimate delivered', 'Lost – Price too high', 'Lost – Chose competitor']) : null, nx___dispo_note__vendor_: null, hs_createdate: iso(start - (2 + R() * 3) * day),
    }, start - 3 * day));
    link('contacts', c.id, 'appointments', id); link('appointments', id, 'contacts', c.id);
    if (stage.label !== 'Scheduled') { link('appointments', id, 'companies', company.id); link('companies', company.id, 'appointments', id); }
  });

  // Tareas
  pc.forEach((c, i) => {
    const n = R() < 0.6 ? 1 : R() < 0.5 ? 2 : 0;
    for (let k = 0; k < n; k++) {
      const bracket = pick(TASK_BRACKETS); const open = R() < 0.55; const due = now + (R() * 7 - 3.2) * day; const id = nid();
      const nm = `${c.properties.firstname}`;
      const subject = R() < 0.12 ? 'Cold Approach' : R() < 0.04 ? "Don't you give up now" : `[Nexa AUTO] [${bracket}] | Llamar a ${nm}`;
      records.tasks.push(rec(id, { hs_task_subject: subject, hs_task_body: `Seguimiento automático (${bracket}).`, hs_task_status: open ? 'NOT_STARTED' : 'COMPLETED', hs_task_type: subject === 'Cold Approach' ? 'CALL' : R() < 0.15 ? 'CALL' : 'TODO', hs_task_priority: pick(['MEDIUM', 'HIGH', 'LOW']), hs_timestamp: iso(due), hubspot_owner_id: c.properties.hubspot_owner_id ?? pick(POOL).id, hs_task_completion_date: open ? null : iso(due + hr) }, due - 2 * day));
      link('contacts', c.id, 'tasks', id); link('tasks', id, 'contacts', c.id);
    }
  });
  records.appointments.forEach(a => {
    const cid = assoc.find(x => x.from === 'appointments' && x.fromId === a.id && x.to === 'contacts')!.toId;
    const c = pc.find(x => x.id === cid)!;
    [['Confirmar cita con homeowner', 'Appointment'], ['QC post-cita', 'Appointment']].forEach(([t, b], idx) => {
      const start = Date.parse(a.properties.hs_appointment_start!); const due = idx === 0 ? start - 3 * hr : start + day; const id = nid();
      records.tasks.push(rec(id, { hs_task_subject: `[Nexa AUTO] [${b}] | ${t} | ${c.properties.firstname}`, hs_task_body: null, hs_task_status: due < now - day ? 'COMPLETED' : 'NOT_STARTED', hs_task_type: 'TODO', hs_task_priority: 'HIGH', hs_timestamp: iso(due), hubspot_owner_id: a.properties.hubspot_owner_id }, start - 2 * day));
      link('appointments', a.id, 'tasks', id); link('tasks', id, 'appointments', a.id); link('contacts', c.id, 'tasks', id); link('tasks', id, 'contacts', c.id);
    });
  });

  // Llamadas (Dialpad)
  for (let i = 0; i < 900; i++) {
    const c = pc[Math.floor(Math.pow(R(), 1.3) * pc.length)]; const at = now - Math.pow(R(), 2) * 30 * day; const id = nid();
    const dir = R() < 0.9 ? 'OUTBOUND' : 'INBOUND'; const answered = R() < 0.38; const dur = answered ? (R() < 0.5 ? Math.floor(5 + R() * 40) : Math.floor(40 + R() * 600)) * 1000 : 0;
    const owner = c.properties.hubspot_owner_id ?? pick(POOL).id;
    const nm = c.properties.firstname;
    records.calls.push(rec(id, {
      hs_call_title: dir === 'OUTBOUND' ? (R() < 0.15 ? `Cancelled call to ${nm}` : `Outbound call to ${nm}`) : `Call with ${nm}`, hs_timestamp: iso(at), hs_call_direction: dir, hs_call_status: answered ? 'COMPLETED' : pick(['NO_ANSWER', 'MISSED', 'BUSY']),
      hs_call_disposition: answered ? 'Connected' : pick(['No answer', 'Left voicemail', 'Busy']), hs_call_duration: String(dur), hs_call_body: answered ? 'Cliente interesado en cotización; pidió llamar más tarde.' : null, hubspot_owner_id: owner,
      hs_call_recording_url: answered && R() < 0.7 ? `https://dialpad.example/callhistory/callreview/${id}` : null, dialpad_call_id: String(5000000000 + i), dialpad_shared_line_name: pick(['Hot Leads', 'Cold Team']),
      dialpad_call_ai_summary: answered && R() < 0.5 ? 'Resumen IA: el cliente confirma interés y disponibilidad esta semana.' : null, dialpad_call_ai_outcome: answered ? pick(['Confirmation/reminder', 'Call back', 'Status update']) : pick(['Voicemail Success', 'Unsuccessful contact']),
    }, at));
    link('contacts', c.id, 'calls', id); link('calls', id, 'contacts', c.id);
  }

  // Notas y reuniones
  for (let i = 0; i < 320; i++) {
    const c = pick(pc); const at = now - R() * 40 * day; const id = nid();
    records.notes.push(rec(id, { hs_note_body: pick(['App set by Clara', 'Owner: cambió de setter por solicitud', 'Cliente pide reagendar', 'Reporte híbrido enviado (diseño + precio)', 'Falló envío del reporte — reintentando', 'Straight to voicemail']), hs_timestamp: iso(at), hubspot_owner_id: c.properties.hubspot_owner_id ?? pick(POOL).id }, at));
    link('contacts', c.id, 'notes', id); link('notes', id, 'contacts', c.id);
  }
  for (let i = 0; i < 6; i++) { const c = pick(pc); const at = now + (R() * 10 - 4) * day; const id = nid(); records.meetings.push(rec(id, { hs_meeting_title: `Reunión con ${c.properties.firstname}`, hs_timestamp: iso(at), hubspot_owner_id: pick(POOL).id }, at - 2 * day)); link('contacts', c.id, 'meetings', id); link('meetings', id, 'contacts', c.id); }

  // Negocios (pipelines reales, de cero: solo ejemplos)
  const dp = PIPELINES.deals[0];
  contactsWithAppt.slice(0, 48).forEach((c, i) => {
    const st = dp.stages[Math.floor(R() * dp.stages.length)]; const created = now - R() * 50 * day; const id = nid();
    records.deals.push(rec(id, { dealname: `${c.properties.firstname} ${c.properties.lastname ?? ''} — ${c.properties.product}`.trim(), amount: String(4000 + Math.floor(R() * 26000)), pipeline: dp.id, dealstage: st.id, closedate: iso(created + 14 * day), hubspot_owner_id: pick(POOL).id, payment_status: st.label.includes('Payment') ? 'Pending' : null }, created));
    link('deals', id, 'contacts', c.id); link('contacts', c.id, 'deals', id); const co = pick(records.companies); link('deals', id, 'companies', co.id);
  });
  const lb = PIPELINES.deals[2];
  for (let i = 0; i < 3; i++) { const co = records.companies[i]; const id = nid(); const st = pick(lb.stages); records.deals.push(rec(id, { dealname: `${co.properties.name} — Lead Buyer`, amount: String(2500 + i * 1500), pipeline: lb.id, dealstage: st.id, closedate: iso(now + 20 * day), hubspot_owner_id: OWNERS.find(o => o.firstName === 'Lucas')!.id }, now - (10 + i * 5) * day)); link('deals', id, 'companies', co.id); link('companies', co.id, 'deals', id); }

  return { records, assoc };
}
