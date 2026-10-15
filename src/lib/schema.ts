// Registro de objetos, propiedades (catálogo REAL de Nexa), pipelines, owners y vistas por defecto.
import catalogJson from '../data/property-catalog.json';
import pipelinesJson from '../data/pipelines.json';
import ownersJson from '../data/owners.json';
import type { FilterGroup, KpiDef, ObjKey, Owner, Sort, ViewDef } from './types';

export type PropOption = { label: string; value: string; hidden?: boolean; color?: string | null };
export type PropDef = { name: string; label: string; type: string; fieldType: string; groupName?: string; hubspotDefined?: boolean; calculated?: boolean; hasUniqueValue?: boolean; readOnlyValue?: boolean; hidden?: boolean; options?: PropOption[] };
export const CATALOG = catalogJson as unknown as Record<string, PropDef[]>;
const INDEX: Record<string, Map<string, PropDef>> = {};
// Propiedades creadas desde Configuración (se guardan en db.ts y se registran aquí al iniciar)
export const CUSTOM_PROPS: Record<string, PropDef[]> = {};
export function registerProp(obj: ObjKey, def: PropDef) { (CUSTOM_PROPS[obj] ??= []).push(def); delete INDEX[obj]; }
export const allProps = (obj: ObjKey): PropDef[] => [...(CATALOG[obj] ?? []), ...(CUSTOM_PROPS[obj] ?? [])];
export function propDef(obj: ObjKey, name: string): PropDef | undefined {
  if (!INDEX[obj]) INDEX[obj] = new Map(allProps(obj).map(p => [p.name, p]));
  return INDEX[obj].get(name);
}

// Etiquetas en español para las propiedades estándar de Nexa (las personalizadas de Nexa conservan su etiqueta).
const ES: Record<string, string> = {
  firstname: 'Nombre', lastname: 'Apellidos', email: 'Correo', phone: 'Número de teléfono', mobilephone: 'Número de móvil', hs_lead_status: 'Estado del lead',
  notes_next_activity_date: 'Fecha de la siguiente actividad', notes_last_updated: 'Última actividad', notes_last_contacted: 'Último contacto', address: 'Dirección', zip: 'Código postal',
  hubspot_owner_id: 'Propietario', hs_object_source_label: 'Fuente del registro', createdate: 'Fecha de creación', lastmodifieddate: 'Última modificación', city: 'Ciudad', state: 'Estado/región',
  company: 'Nombre de la empresa', lifecyclestage: 'Etapa del ciclo de vida', hs_object_id: 'ID del registro', appointment_datetime: 'Appointment datetime (GMT-4)',
  hs_appointment_name: 'Nombre de la cita', hs_appointment_start: 'Inicio de la cita (GMT-4)', hs_appointment_end: 'Fin de la cita (GMT-4)', hs_duration: 'Duración', hs_pipeline_stage: 'Etapa del pipeline', hs_pipeline: 'Pipeline',
  hs_createdate: 'Fecha y hora de creación del objeto', hs_lastmodifieddate: 'Fecha y hora de la última modificación', hs_object_source_detail_1: 'Detalle de la fuente del registro 1', hs_created_by_user_id: 'Creado por ID de usuario', hs_updated_by_user_id: 'Actualizado por ID de usuario',
  hs_task_subject: 'Título de la tarea', hs_task_type: 'Tipo de tarea', hs_task_status: 'Estado de la tarea', hs_task_priority: 'Prioridad', hs_timestamp: 'Fecha de vencimiento (GMT-4)', hs_task_body: 'Notas de la tarea', hs_queue_membership_ids: 'Cola',
  hs_call_title: 'Título de la llamada', hs_call_direction: 'Dirección de la llamada', hs_call_disposition: 'Resultado de la llamada', hs_call_duration: 'Duración de la llamada', hs_call_body: 'Notas de la llamada', hs_call_status: 'Estado de la llamada',
  dealname: 'Nombre del negocio', amount: 'Cantidad', closedate: 'Fecha de cierre', dealstage: 'Etapa del negocio', pipeline: 'Pipeline', name: 'Nombre de la empresa', domain: 'Nombre de dominio', industry: 'Sector', country: 'País/región',
  hs_note_body: 'Nota', hs_meeting_title: 'Título de la reunión',
};
export const OBJ_LABEL_OVERRIDE: Partial<Record<ObjKey, Record<string, string>>> = {
  companies: { hubspot_owner_id: 'Propietario del registro de empresa' }, contacts: { hubspot_owner_id: 'Propietario del contacto' }, deals: { hubspot_owner_id: 'Propietario del negocio' },
  tasks: { hubspot_owner_id: 'Asignado a' }, calls: { hubspot_owner_id: 'Actividad asignada a', hs_timestamp: 'Fecha de actividad (GMT-4)' }, appointments: { createdate: 'Fecha y hora de creación del objeto' },
};
export const propLabel = (obj: ObjKey, name: string): string => {
  if (name.startsWith('@')) return VIRTUAL[name] ?? name;
  return OBJ_LABEL_OVERRIDE[obj]?.[name] ?? ES[name] ?? propDef(obj, name)?.label ?? name;
};
// Columnas "virtuales" (valores de objetos asociados)
export const VIRTUAL: Record<string, string> = {
  '@contact': 'Contactos asociados', '@contactLastContacted': 'Último contacto', '@company': 'Empresas asociadas', '@appointment': 'Cita asociada', '@name': 'Nombre',
};

export const OWNERS = ownersJson as unknown as Owner[];
export const ME: Owner = { ...OWNERS.find(o => o.email === 'alex.rivera@nexa.example')! }; // sesión demo: Alex (Super admin)
export const ownerName = (id?: string | null) => { const o = OWNERS.find(x => x.id === id); return o ? `${o.firstName} ${o.lastName}`.trim() : null; };
export const SETTERS = OWNERS.filter(o => o.teams.includes('Nexa - Hot Leads'));

export type Stage = { id: string; label: string; order: number; closed: boolean; probability?: string; requiredProperties?: string[] };
export type PipeObj = 'deals' | 'appointments' | 'tickets' | 'leads';
export type Pipeline = { id: string; label: string; stages: Stage[] };
export const PIPELINES = pipelinesJson as unknown as Record<PipeObj, Pipeline[]>;
export const stageLabel = (obj: PipeObj, pipelineId: string | null | undefined, stageId: string | null | undefined) => {
  const p = PIPELINES[obj].find(x => x.id === pipelineId); return p?.stages.find(s => s.id === stageId)?.label ?? stageId ?? '—';
};

export type ObjectCfg = {
  key: ObjKey; typeId: string; singular: string; plural: string; path: string; icon: string;
  titleProp: string; searchProps: string[]; createFields: string[];
  pipelineProp?: string; stageProp?: string; boardAmountProp?: string;
};
export const OBJECTS: Record<ObjKey, ObjectCfg> = {
  contacts: { key: 'contacts', typeId: '0-1', singular: 'contacto', plural: 'Contactos', path: '/contacts', icon: 'contacts', titleProp: '@name', searchProps: ['firstname', 'lastname', 'email', 'phone', 'mobilephone'], createFields: ['email', 'firstname', 'lastname', 'mobilephone', 'hs_lead_status', 'hubspot_owner_id'] },
  companies: { key: 'companies', typeId: '0-2', singular: 'empresa', plural: 'Empresas', path: '/companies', icon: 'companies', titleProp: 'name', searchProps: ['name', 'domain', 'phone'], createFields: ['name', 'domain', 'phone', 'hubspot_owner_id'] },
  deals: { key: 'deals', typeId: '0-3', singular: 'negocio', plural: 'Negocios', path: '/deals', icon: 'deals', titleProp: 'dealname', searchProps: ['dealname'], createFields: ['dealname', 'amount', 'closedate', 'hubspot_owner_id'], pipelineProp: 'pipeline', stageProp: 'dealstage', boardAmountProp: 'amount' },
  appointments: { key: 'appointments', typeId: '0-421', singular: 'cita', plural: 'Citas', path: '/appointments', icon: 'calendar', titleProp: 'hs_appointment_name', searchProps: ['hs_appointment_name'], createFields: ['hs_appointment_name', 'hs_appointment_start', 'hubspot_owner_id'], pipelineProp: 'hs_pipeline', stageProp: 'hs_pipeline_stage' },
  tasks: { key: 'tasks', typeId: '0-27', singular: 'tarea', plural: 'Tareas', path: '/tasks', icon: 'tasks', titleProp: 'hs_task_subject', searchProps: ['hs_task_subject', 'hs_task_body'], createFields: ['hs_task_subject', 'hs_task_type', 'hs_timestamp', 'hs_task_priority', 'hubspot_owner_id'] },
  calls: { key: 'calls', typeId: '0-48', singular: 'llamada', plural: 'Llamadas', path: '/calls', icon: 'phone', titleProp: 'hs_call_title', searchProps: ['hs_call_title', 'hs_call_body'], createFields: ['hs_call_title', 'hs_call_direction', 'hs_timestamp'] },
  notes: { key: 'notes', typeId: '0-46', singular: 'nota', plural: 'Notas', path: '/notes', icon: 'note', titleProp: 'hs_note_body', searchProps: ['hs_note_body'], createFields: ['hs_note_body'] },
  meetings: { key: 'meetings', typeId: '0-47', singular: 'reunión', plural: 'Reuniones', path: '/meetings', icon: 'calendar', titleProp: 'hs_meeting_title', searchProps: ['hs_meeting_title'], createFields: ['hs_meeting_title'] },
  tickets: { key: 'tickets', typeId: '0-5', singular: 'ticket', plural: 'Tickets', path: '/tickets', icon: 'tasks', titleProp: 'subject', searchProps: ['subject', 'content'], createFields: ['subject', 'content', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_priority', 'hubspot_owner_id'], pipelineProp: 'hs_pipeline', stageProp: 'hs_pipeline_stage' },
  leads: { key: 'leads', typeId: '0-136', singular: 'lead', plural: 'Leads', path: '/leads', icon: 'contacts', titleProp: 'hs_lead_name', searchProps: ['hs_lead_name'], createFields: ['hs_lead_name', 'hs_pipeline', 'hs_pipeline_stage', 'hubspot_owner_id'], pipelineProp: 'hs_pipeline', stageProp: 'hs_pipeline_stage' },
  communications: { key: 'communications', typeId: '0-18', singular: 'comunicación', plural: 'Comunicaciones', path: '/communications', icon: 'note', titleProp: 'hs_communication_body', searchProps: ['hs_communication_body'], createFields: ['hs_communication_channel_type', 'hs_communication_body'] },
  products: { key: 'products', typeId: '0-7', singular: 'producto', plural: 'Productos', path: '/products', icon: 'deals', titleProp: 'name', searchProps: ['name', 'hs_sku'], createFields: ['name', 'price', 'hs_sku', 'description'] },
  line_items: { key: 'line_items', typeId: '0-8', singular: 'partida', plural: 'Partidas (line items)', path: '/line_items', icon: 'deals', titleProp: 'name', searchProps: ['name', 'hs_sku'], createFields: ['name', 'quantity', 'price'] },
  quotes: { key: 'quotes', typeId: '0-14', singular: 'cotización', plural: 'Cotizaciones', path: '/quotes', icon: 'note', titleProp: 'hs_title', searchProps: ['hs_title'], createFields: ['hs_title', 'hs_expiration_date', 'hubspot_owner_id'] },
  invoices: { key: 'invoices', typeId: '0-53', singular: 'factura', plural: 'Facturas', path: '/invoices', icon: 'note', titleProp: 'hs_number', searchProps: ['hs_number'], createFields: ['hs_number', 'hs_invoice_status', 'hs_currency'] },
};
export const OBJ_BY_TYPEID = Object.fromEntries(Object.values(OBJECTS).map(o => [o.typeId, o.key])) as Record<string, ObjKey>;

/* ---------- Vistas integradas ----------
   Tokens dinámicos en valores de filtro: {{me}} {{now}} {{today_start}} {{today_end}} {{days_ago:N}} {{days_ahead:N}} */
const f = (propertyName: string, operator: any, value?: string, values?: string[]) => ({ propertyName, operator, ...(value !== undefined ? { value } : {}), ...(values ? { values } : {}) });
const g = (...filters: any[]): FilterGroup => ({ filters });
const desc = (p: string): Sort[] => [{ propertyName: p, direction: 'DESCENDING' }];

export const SETTER_COLUMNS = ['@name', 'email', 'phone', 'mobilephone', 'lead_language', 'meta_campaign_source', 'lead_source', 'hs_lead_status', 'notes_next_activity_date', 'notes_last_updated', 'notes_last_contacted', 'product', 'product_description', 'address', 'zip', 'appointment_datetime', 'hubspot_owner_id', 'hs_object_source_label', 'lead_intake_status', 'createdate', 'slug', 'lastmodifieddate', 'contact_type'];
const HOT_COLS = ['@name', 'lead_language', 'hs_lead_status', 'lead_source', 'createdate', 'notes_last_contacted', 'product', 'hubspot_owner_id'];
const HOT_STATUS = ['New', 'Hot Follow-Up', 'Call later TODAY', 'No Answer - Active Recall'];
const HOT_KPIS: KpiDef[] = [
  { label: 'Contactos falta el propietario', filterGroups: [g(f('hubspot_owner_id', 'NOT_HAS_PROPERTY'))] },
  { label: 'Contactos falta e-mail', filterGroups: [g(f('email', 'NOT_HAS_PROPERTY'))] },
  { label: 'Contactos falta leads estado', filterGroups: [g(f('hs_lead_status', 'NOT_HAS_PROPERTY'))] },
  { label: 'Contactos sin actividad reciente', filterGroups: [g(f('notes_last_updated', 'LT', '{{days_ago:7}}')), g(f('notes_last_updated', 'NOT_HAS_PROPERTY'))] },
];
const CQF = ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'hs_lead_status'];
const cv = (id: string, name: string, groups: FilterGroup[], opts: Partial<ViewDef> = {}): ViewDef => ({ id, objectType: 'contacts', name, filterGroups: groups, columns: opts.columns ?? ['@name', 'createdate', 'lead_source', 'hs_lead_status', 'hubspot_owner_id', 'phone', 'email'], sorts: opts.sorts ?? desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: opts.quickFilters ?? CQF, builtin: true, ...opts });

export const BUILTIN_VIEWS: ViewDef[] = [
  // CONTACTOS — las 6 fijadas + las más usadas de las 35 (filtros APROXIMADOS salvo "Setter": a confirmar)
  cv('c-hot-roofing', 'Hot Leads - ROOFING', [g(f('product', 'EQ', 'Roofing'), f('hs_lead_status', 'IN', undefined, HOT_STATUS))], { columns: HOT_COLS, kpis: HOT_KPIS, quickFilters: [...CQF, 'lead_source'] }),
  cv('c-hot-kitchen', 'Hot Leads - KITCHEN', [g(f('product', 'EQ', 'Kitchen'), f('hs_lead_status', 'IN', undefined, HOT_STATUS))], { columns: HOT_COLS, kpis: HOT_KPIS }),
  cv('c-hot-windows', 'Hot Leads - WINDOWS', [g(f('product', 'EQ', 'Windows'), f('hs_lead_status', 'IN', undefined, HOT_STATUS))], { columns: HOT_COLS, kpis: HOT_KPIS }),
  cv('c-setter', 'Setter', [g(f('contact_type', 'IN', undefined, ['b2c', 'nexahome']))], { columns: SETTER_COLUMNS, sorts: desc('createdate') }),
  cv('c-setter-answered', 'Setter - Answered', [g(f('contact_type', 'IN', undefined, ['b2c', 'nexahome']), f('hs_lead_status', 'NOT_IN', undefined, ['New', 'No Answer - Active Recall', 'Unreachable', 'Duplicate']))], { columns: SETTER_COLUMNS }),
  cv('c-all', 'Todos contactos', []),
  cv('c-b2b', 'B2B', [g(f('contact_type', 'EQ', 'B2B'))]),
  cv('c-research', 'Research Pending', [g(f('hs_lead_status', 'EQ', 'Research Pending'))]),
  cv('c-unassigned', 'Unassigned Leads', [g(f('hubspot_owner_id', 'NOT_HAS_PROPERTY'))]),
  cv('c-donotcall', '🚨DO NOT CALL🚨', [g(f('hs_lead_status', 'EQ', 'Do Not Call'))]),
  cv('c-followup', 'Follow up needed.', [g(f('hs_lead_status', 'EQ', 'Follow-Up Needed'))]),
  cv('c-calllater', 'B2C | Call Later Today | Hot Leads | Admin', [g(f('hs_lead_status', 'EQ', 'Call later TODAY'))]),
  cv('c-dups', 'Duplicateds Control | All Contacts', [g(f('hs_lead_status', 'EQ', 'Duplicate'))]),
  cv('c-mine', 'My leads/appointments', [g(f('hubspot_owner_id', 'EQ', '{{me}}'))]),
  cv('c-meta-roof', 'B2C | Roofing | Meta Contacts', [g(f('product', 'EQ', 'Roofing'), f('lead_source', 'EQ', 'Paid Ads'))]),
  cv('c-meta-win', 'B2C | Windows | Meta Contacts', [g(f('product', 'EQ', 'Windows'), f('lead_source', 'EQ', 'Paid Ads'))]),
  cv('c-ddk', 'Digital Door Knocking', [g(f('lead_source', 'EQ', 'Digital Door Knocking'))]),
  // CITAS
  { id: 'a-all', objectType: 'appointments', name: 'Todos citas', filterGroups: [], columns: ['hs_appointment_name', 'hs_appointment_start', 'hs_appointment_end', 'hs_duration', '@contact', 'hubspot_owner_id', 'hs_object_source_label', 'hs_object_source_detail_1', 'hs_created_by_user_id', 'hs_updated_by_user_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: desc('hs_appointment_start'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], builtin: true },
  // CITAS — vistas útiles adicionales (spec §2/§4)
  { id: 'a-mine', objectType: 'appointments', name: 'Mis citas', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: desc('hs_appointment_start'), quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'a-today', objectType: 'appointments', name: 'Citas de hoy', filterGroups: [g(f('hs_appointment_start', 'GTE', '{{today_start}}'), f('hs_appointment_start', 'LTE', '{{today_end}}'))], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: [{ propertyName: 'hs_appointment_start', direction: 'ASCENDING' }], quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'a-upcoming', objectType: 'appointments', name: 'Próximas (7 días)', filterGroups: [g(f('hs_appointment_start', 'GTE', '{{now}}'), f('hs_appointment_start', 'LTE', '{{days_ahead:7}}'))], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: [{ propertyName: 'hs_appointment_start', direction: 'ASCENDING' }], quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'a-pending', objectType: 'appointments', name: 'Pendientes de confirmar', filterGroups: [g(f('nx___appointment_confirmed_', 'EQ', 'Pending'))], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: [{ propertyName: 'hs_appointment_start', direction: 'ASCENDING' }], quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'a-noowner', objectType: 'appointments', name: 'Sin propietario', filterGroups: [g(f('hubspot_owner_id', 'NOT_HAS_PROPERTY'))], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: desc('hs_createdate'), quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'a-board', objectType: 'appointments', name: 'Tablero de citas', filterGroups: [], columns: ['hs_appointment_name', 'hs_appointment_start', '@contact', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'hs_createdate'], sorts: desc('hs_appointment_start'), quickFilters: ['hs_appointment_name', 'hs_createdate', 'hs_lastmodifieddate', 'hs_appointment_end'], mode: 'board', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  // TAREAS
  { id: 't-all', objectType: 'tasks', name: 'Todos tareas', filterGroups: [g(f('hs_task_status', 'NEQ', 'COMPLETED'), f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['hs_task_subject', '@contact', '@contactLastContacted', 'hs_task_type', 'hs_timestamp'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_task_type', 'hs_task_status', 'hs_timestamp', 'hs_queue_membership_ids'], builtin: true },
  { id: 't-today', objectType: 'tasks', name: 'Vencen hoy', filterGroups: [g(f('hs_task_status', 'NEQ', 'COMPLETED'), f('hs_timestamp', 'GTE', '{{today_start}}'), f('hs_timestamp', 'LTE', '{{today_end}}'))], columns: ['hs_task_subject', '@contact', '@contactLastContacted', 'hs_task_type', 'hs_timestamp'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_task_type', 'hs_task_status', 'hs_timestamp', 'hs_queue_membership_ids'], builtin: true },
  { id: 't-overdue', objectType: 'tasks', name: 'Atrasado', filterGroups: [g(f('hs_task_status', 'NEQ', 'COMPLETED'), f('hs_timestamp', 'LT', '{{today_start}}'))], columns: ['hs_task_subject', '@contact', '@contactLastContacted', 'hs_task_type', 'hs_timestamp'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_task_type', 'hs_task_status', 'hs_timestamp', 'hs_queue_membership_ids'], builtin: true },
  { id: 't-upcoming', objectType: 'tasks', name: 'Próximamente', filterGroups: [g(f('hs_task_status', 'NEQ', 'COMPLETED'), f('hs_timestamp', 'GT', '{{today_end}}'))], columns: ['hs_task_subject', '@contact', '@contactLastContacted', 'hs_task_type', 'hs_timestamp'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_task_type', 'hs_task_status', 'hs_timestamp', 'hs_queue_membership_ids'], builtin: true },
  // NEGOCIOS
  { id: 'd-all', objectType: 'deals', name: 'Todos negocios', filterGroups: [], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'board', builtin: true },
  { id: 'd-mine', objectType: 'deals', name: 'Mis negocios', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['createdate', 'closedate'], mode: 'table', builtin: true },
  // NEGOCIOS — vistas adicionales
  { id: 'd-open', objectType: 'deals', name: 'Abiertos', filterGroups: [g(f('dealstage', 'NOT_IN', undefined, ['closedlost', '2184273616', '4282648259', '4282648260', '2544669414', '2544669415']))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: [{ propertyName: 'closedate', direction: 'ASCENDING' }], quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'table', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'd-closing', objectType: 'deals', name: 'Cierran en 30 días', filterGroups: [g(f('closedate', 'GTE', '{{now}}'), f('closedate', 'LTE', '{{days_ahead:30}}'))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: [{ propertyName: 'closedate', direction: 'ASCENDING' }], quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'table', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'd-big', objectType: 'deals', name: 'Mayor valor', filterGroups: [g(f('amount', 'GT', '5000'))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: desc('amount'), quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'table', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'd-noowner', objectType: 'deals', name: 'Sin propietario', filterGroups: [g(f('hubspot_owner_id', 'NOT_HAS_PROPERTY'))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: desc('createdate'), quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'table', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'd-new7', objectType: 'deals', name: 'Nuevos (7 días)', filterGroups: [g(f('createdate', 'GTE', '{{days_ago:7}}'))], columns: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id', 'createdate'], sorts: desc('createdate'), quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'closedate'], mode: 'table', owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  // EMPRESAS
  ...[['co-all', 'Todos empresas', []], ['co-new', 'New', [g(f('b2b_research_status', 'EQ', 'New'))]], ['co-research', 'In Research', [g(f('b2b_research_status', 'EQ', 'In Research'))]], ['co-review', 'Review', [g(f('b2b_eligibility_status', 'EQ', 'Review'))]], ['co-eligible', 'Eligible', [g(f('b2b_eligibility_status', 'EQ', 'Eligible'))]], ['co-rejected', 'Rejected', [g(f('b2b_eligibility_status', 'EQ', 'Rejected'))]], ['co-ready', 'Ready for Decision Maker', [g(f('b2b_research_status', 'EQ', 'Research Complete'))]]].map(([id, name, groups]: any): ViewDef => ({ id, objectType: 'companies', name, filterGroups: groups, columns: ['name', 'hubspot_owner_id', 'createdate', 'phone', 'notes_last_updated', 'city', 'country', 'industry'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'createdate', 'notes_last_updated', 'b2b_eligibility_status'], builtin: true })),
  // LLAMADAS
  { id: 'l-rec', objectType: 'calls', name: 'Llamadas grabadas', filterGroups: [g(f('hs_call_recording_url', 'HAS_PROPERTY'))], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_direction', 'hs_call_disposition', 'hubspot_owner_id', 'hs_call_duration', 'hs_call_body', '@contact', '@company'], sorts: desc('hs_timestamp'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hs_call_recording_url', 'hubspot_owner_id', 'hs_timestamp', 'hs_call_duration'], builtin: true },
  { id: 'l-all', objectType: 'calls', name: 'Todas las llamadas', filterGroups: [], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_direction', 'hs_call_disposition', 'hubspot_owner_id', 'hs_call_duration', 'hs_call_body', '@contact', '@company'], sorts: desc('hs_timestamp'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['dialpad_call_ai_summary', 'hubspot_owner_id', 'hs_timestamp', 'hs_call_duration'], builtin: true },
  { id: 'm-all', objectType: 'meetings', name: 'Todas las reuniones', filterGroups: [], columns: ['hs_meeting_title', 'hs_timestamp', 'hubspot_owner_id', '@contact'], sorts: desc('hs_timestamp'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_timestamp'], builtin: true },
  { id: 'tk-all', objectType: 'tickets', name: 'Todos los tickets', filterGroups: [], columns: ['subject', 'hs_pipeline_stage', 'hs_ticket_priority', 'hubspot_owner_id', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'createdate'], builtin: true },
  { id: 'tk-mine', objectType: 'tickets', name: 'Mis tickets', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['subject', 'hs_pipeline_stage', 'hs_ticket_priority', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['createdate'], builtin: true },
  { id: 'ld-all', objectType: 'leads', name: 'Todos los leads', filterGroups: [], columns: ['hs_lead_name', 'hs_pipeline_stage', 'hs_lead_label', 'hubspot_owner_id', 'hs_createdate'], sorts: desc('hs_createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id'], builtin: true },
  { id: 'cm-all', objectType: 'communications', name: 'Todas las comunicaciones', filterGroups: [], columns: ['hs_communication_channel_type', 'hs_communication_body', 'hs_timestamp', 'hubspot_owner_id'], sorts: desc('hs_timestamp'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hs_timestamp'], builtin: true },
  { id: 'pr-all', objectType: 'products', name: 'Todos los productos', filterGroups: [], columns: ['name', 'price', 'hs_sku', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: [], builtin: true },
  { id: 'li-all', objectType: 'line_items', name: 'Todas las partidas', filterGroups: [], columns: ['name', 'quantity', 'price', 'amount', 'createdate'], sorts: desc('createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: [], builtin: true },
  { id: 'qt-all', objectType: 'quotes', name: 'Todas las cotizaciones', filterGroups: [], columns: ['hs_title', 'hs_status', 'hs_expiration_date', 'hubspot_owner_id', 'hs_createdate'], sorts: desc('hs_createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id'], builtin: true },
  { id: 'iv-all', objectType: 'invoices', name: 'Todas las facturas', filterGroups: [], columns: ['hs_number', 'hs_invoice_status', 'hs_amount_billed', 'hs_due_date', 'hs_createdate'], sorts: desc('hs_createdate'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: [], builtin: true },
  { id: 'n-all', objectType: 'notes', name: 'Todas las notas', filterGroups: [], columns: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', '@contact'], sorts: desc('hs_timestamp'), owner: 'Nexa Partners', shared: 'PUBLIC', quickFilters: ['hubspot_owner_id', 'hs_timestamp'], builtin: true },
  { id: 'l-in', objectType: 'calls', name: 'Entrantes', filterGroups: [g(f('hs_call_direction', 'EQ', 'INBOUND'))], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_disposition', 'hubspot_owner_id', 'hs_call_duration', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hubspot_owner_id', 'hs_timestamp', 'hs_call_duration'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'l-out', objectType: 'calls', name: 'Salientes', filterGroups: [g(f('hs_call_direction', 'EQ', 'OUTBOUND'))], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_disposition', 'hubspot_owner_id', 'hs_call_duration', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hubspot_owner_id', 'hs_timestamp', 'hs_call_duration'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'l-missed', objectType: 'calls', name: 'Sin contestar', filterGroups: [g(f('hs_call_status', 'IN', undefined, ['MISSED', 'NO_ANSWER', 'BUSY', 'FAILED']))], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_direction', 'hubspot_owner_id', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hubspot_owner_id', 'hs_timestamp'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'l-mine', objectType: 'calls', name: 'Mis llamadas', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['hs_call_title', 'hs_timestamp', 'hs_call_direction', 'hs_call_duration', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hs_timestamp', 'hs_call_duration'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'm-mine', objectType: 'meetings', name: 'Mis reuniones', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['hs_meeting_title', 'hs_timestamp', 'hubspot_owner_id', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hs_timestamp'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'm-upcoming', objectType: 'meetings', name: 'Próximas', filterGroups: [g(f('hs_timestamp', 'GTE', '{{now}}'))], columns: ['hs_meeting_title', 'hs_timestamp', 'hubspot_owner_id', '@contact'], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], quickFilters: ['hubspot_owner_id', 'hs_timestamp'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
  { id: 'n-mine', objectType: 'notes', name: 'Mis notas', filterGroups: [g(f('hubspot_owner_id', 'EQ', '{{me}}'))], columns: ['hs_note_body', 'hs_timestamp', '@contact'], sorts: desc('hs_timestamp'), quickFilters: ['hs_timestamp'], owner: 'Nexa Partners', shared: 'PUBLIC', builtin: true },
];
export const PINNED_DEFAULT: Record<ObjKey, string[]> = {
  contacts: ['c-hot-roofing', 'c-hot-kitchen', 'c-hot-windows', 'c-setter', 'c-setter-answered', 'c-all'],
  appointments: ['a-all', 'a-today', 'a-upcoming', 'a-pending', 'a-board', 'a-mine'], tasks: ['t-all', 't-today', 't-overdue', 't-upcoming'], deals: ['d-all', 'd-open', 'd-mine', 'd-closing'],
  companies: ['co-ready', 'co-eligible', 'co-research', 'co-review', 'co-new', 'co-all'], calls: ['l-rec', 'l-all', 'l-missed', 'l-mine'], notes: ['n-all', 'n-mine'], meetings: ['m-all', 'm-upcoming', 'm-mine'],
  tickets: ['tk-all', 'tk-mine'], leads: ['ld-all'], communications: ['cm-all'], products: ['pr-all'], line_items: ['li-all'], quotes: ['qt-all'], invoices: ['iv-all'],
};

export const PERMISSION_CATEGORIES = ['CRM (objetos y herramientas)', 'Marketing', 'Ventas', 'Ingresos', 'Servicio', 'Gestión de datos', 'Automatización', 'Informes', 'Funciones de IA', 'Cuenta (configuración y acceso)'];
const SCOPE_OBJS = Object.values(OBJECTS);
export const SCOPES: { group: string; scopes: string[] }[] = [
  ...SCOPE_OBJS.map(o => ({ group: o.plural, scopes: [`crm.objects.${o.key}.read`, `crm.objects.${o.key}.write`, `crm.objects.${o.key}.delete`, `crm.schemas.${o.key}.read`, `crm.schemas.${o.key}.write`] })),
  { group: 'Llamadas: transcripciones', scopes: ['crm.extensions_calling_transcripts.read', 'crm.extensions_calling_transcripts.write'] },
  { group: 'Listas, importación, propietarios', scopes: ['crm.lists.read', 'crm.lists.write', 'crm.import', 'crm.objects.owners.read'] },
  { group: 'Archivos y formularios', scopes: ['files.read', 'files.write', 'forms.read', 'forms.write', 'forms.submissions.read', 'forms', 'forms-uploaded-files'] },
  { group: 'Dashboards', scopes: ['dashboards.read', 'dashboards.write'] },
  { group: 'Sitio (blog y dominios)', scopes: ['content', 'cms.domains.read'] },
  { group: 'Notificaciones (bandeja de avisos)', scopes: ['notifications.read', 'notifications.write'] },
  { group: 'Redes sociales (n8n)', scopes: ['social.read', 'social.write'] },
  { group: 'Automatización y ajustes', scopes: ['automation', 'actions', 'settings.users.read', 'settings.users.teams.read', 'oauth'] },
];
