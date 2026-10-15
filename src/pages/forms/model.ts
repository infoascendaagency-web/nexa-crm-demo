// Modelo de formularios v2 (espejo de backend/src/lib/form-schema.ts) + helpers del constructor.
import { allProps, propDef, propLabel } from '../../lib/schema';
import type { ObjKey } from '../../lib/types';
import { emptyActivation, type Activation } from './activation';

export const FORM_OBJECTS = ['contacts', 'companies', 'deals', 'appointments', 'tickets', 'notes'] as const;
export type FObj = (typeof FORM_OBJECTS)[number];
export const OBJ_LABEL: Record<FObj, string> = { contacts: 'Contacto', companies: 'Empresa', deals: 'Negocio', appointments: 'Cita', tickets: 'Ticket', notes: 'Nota' };
export const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'single-select', 'multi-select', 'image-select', 'checkbox', 'hidden', 'address', 'file'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const TYPE_LABEL: Record<FieldType, string> = { text: 'Texto corto', textarea: 'Texto largo', email: 'Correo', phone: 'Teléfono', number: 'Número', date: 'Fecha', 'single-select': 'Elegir una opción', 'multi-select': 'Elegir varias opciones', 'image-select': 'Elegir con imágenes', checkbox: 'Casilla sí/no', hidden: 'Oculto (valor fijo)', address: 'Dirección', file: 'Subir fotos' };

export type FOption = { label: string; value: string; image?: string; hidden?: boolean };
export type FField = { id: string; object: FObj; prop: string; type: FieldType; title: string; label: string; placeholder: string; helpText: string; required: boolean; options?: FOption[]; min?: number; max?: number; minLength?: number; maxLength?: number; defaultValue?: string; meta?: Record<string, unknown> };
export type StepKind = 'fields' | 'photos' | 'area' | 'message';
export type FStep = { id: string; title: string; subtitle: string; kind: StepKind; fields: FField[]; requireTerms: boolean; requireCheckbox: boolean; isHomeOwner: boolean };
export type FKV = { object: FObj; prop: string; value: string; when?: 'start' | 'submit' };
export type FOnSubmit = { match: ('email' | 'phone')[]; ifExists: 'note' | 'fill_empty' | 'create_new'; owner: { mode: 'none' | 'fixed' | 'round_robin'; ownerId?: string }; captureEarly?: boolean; captureFrom?: 'first_field' | 'identity'; setProps: FKV[]; createRecords: { object: 'deals' | 'appointments' | 'tickets'; props: { prop: string; value: string }[]; associate: boolean }[]; createNote: boolean };
export type FSettings = { language: 'es' | 'en'; submitLabel: string; nextLabel: string; backLabel: string; termsText: string; checkboxText: string; termsUrl?: string; success: { title1: string; title2: string; description1: string; description2: string; buttonLabel: string; buttonUrl?: string }; redirectUrl?: string; captcha?: { provider?: 'turnstile' | 'hcaptcha' }; calculator: boolean; onSubmit: FOnSubmit; activation: Activation };
export type FormV2 = { id: string; name: string; slug: string; code?: string; status: 'draft' | 'published'; steps: FStep[]; settings: FSettings; createdAt?: string; updatedAt?: string; submissions?: number };

export const rid = () => Math.random().toString(36).slice(2, 12);
export const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const defaultSettings = (): FSettings => ({ language: 'es', submitLabel: 'Enviar', nextLabel: 'Siguiente', backLabel: 'Atrás', termsText: '', checkboxText: '', termsUrl: '', success: { title1: '¡Gracias!', title2: '', description1: '', description2: '', buttonLabel: '', buttonUrl: '' }, redirectUrl: '', calculator: false,
  onSubmit: { match: ['email', 'phone'], ifExists: 'note', owner: { mode: 'none' }, setProps: [], createRecords: [], createNote: true, captureEarly: false, captureFrom: 'first_field' }, activation: emptyActivation() });
export const newStep = (kind: StepKind = 'fields'): FStep => ({ id: rid(), title: '', subtitle: '', kind, fields: [], requireTerms: false, requireCheckbox: false, isHomeOwner: false });

/** Propiedades que se pueden llenar desde un formulario (no calculadas, no de solo lectura, no ocultas). */
export const fillableProps = (obj: FObj) => allProps(obj as ObjKey).filter(p => !p.calculated && !p.readOnlyValue && !p.hidden && !/^hs_(object_id|createdate|lastmodifieddate)$/.test(p.name) && p.name !== 'hubspot_owner_id');
export const unfillableNames = (obj: FObj) => allProps(obj as ObjKey).filter(p => p.calculated || p.readOnlyValue || p.hidden || p.name === 'hubspot_owner_id').map(p => p.name);

/** Un campo nuevo a partir de la propiedad elegida: tipo, pregunta, opciones y validaciones salen de la definición real. */
export function fieldFromProperty(object: FObj, name: string): FField {
  const d = propDef(object as ObjKey, name); const label = propLabel(object as ObjKey, name);
  let type: FieldType = 'text';
  if (d) {
    if (d.type === 'enumeration') type = d.fieldType === 'checkbox' ? 'multi-select' : 'single-select';
    else if (d.type === 'bool') type = 'checkbox';
    else if (d.type === 'number') type = 'number';
    else if (d.type === 'date' || d.type === 'datetime') type = 'date';
    else if (d.fieldType === 'phonenumber' || /phone/.test(name)) type = 'phone';
    else if (/(^|_)email$/.test(name)) type = 'email';
    else if (d.fieldType === 'textarea' || d.fieldType === 'html') type = 'textarea';
  }
  if (name === 'address' || name === 'street_address') type = 'address';
  const f: FField = { id: rid(), object, prop: name, type, title: label, label, placeholder: '', helpText: '', required: false };
  if (type === 'single-select' || type === 'multi-select') f.options = (d?.options ?? []).filter(o => !o.hidden).map(o => ({ label: o.label, value: o.value }));
  return f;
}

/** Vista de lo que el servidor mandará al renderizador público (mismo contrato que publicFormView del backend). */
export type PublicForm = { code: string; slug: string; name: string; language: 'es' | 'en'; steps: FStep[]; settings: { submitLabel: string; nextLabel: string; backLabel: string; termsText: string; checkboxText: string; termsUrl?: string; success: FSettings['success']; redirectUrl?: string; captcha?: { provider?: string } | null; calculator: boolean; captureEarly?: boolean; captureFrom?: 'first_field' | 'identity' } };
export function toPublic(f: FormV2): PublicForm {
  return { code: f.code ?? f.slug, slug: f.slug, name: f.name, language: f.settings.language, steps: f.steps, settings: { submitLabel: f.settings.submitLabel, nextLabel: f.settings.nextLabel, backLabel: f.settings.backLabel, termsText: f.settings.termsText, checkboxText: f.settings.checkboxText, termsUrl: f.settings.termsUrl, success: f.settings.success, redirectUrl: f.settings.redirectUrl, captcha: f.settings.captcha ?? null, calculator: f.settings.calculator, captureEarly: !!f.settings.onSubmit.captureEarly, captureFrom: f.settings.onSubmit.captureFrom ?? 'first_field' } };
}

export function newFormV2(): FormV2 {
  const contact = newStep(); contact.title = 'Tus datos'; contact.subtitle = 'Para enviarte la información.'; contact.requireTerms = true;
  contact.fields = [{ ...fieldFromProperty('contacts', 'firstname'), required: true }, { ...fieldFromProperty('contacts', 'email'), required: true }];
  const s = defaultSettings();
  return { id: rid() + rid(), name: 'Formulario nuevo', slug: 'formulario-' + rid().slice(0, 5), status: 'draft', steps: [contact], settings: s };
}
/** Revisión previa a publicar: avisos entendibles para quien arma el formulario. */
export function checkForm(f: FormV2): { level: 'error' | 'warn'; msg: string }[] {
  const out: { level: 'error' | 'warn'; msg: string }[] = []; const fields = f.steps.flatMap(s => s.fields);
  if (!f.steps.length) out.push({ level: 'error', msg: 'Agrega al menos un paso.' });
  if (!fields.some(x => x.prop === 'email' || x.prop === 'phone' || x.prop === 'mobilephone')) out.push({ level: 'warn', msg: 'Ningún campo guarda correo o teléfono: no se podrán detectar contactos repetidos ni enviarles nada.' });
  for (const s of f.steps) { if (s.kind === 'fields' && !s.fields.length) out.push({ level: 'warn', msg: `El paso “${s.title || 'sin título'}” no tiene campos.` }); }
  for (const x of fields) {
    if ((x.type === 'single-select' || x.type === 'multi-select' || x.type === 'image-select') && !(x.options ?? []).length) out.push({ level: 'error', msg: `“${x.title || x.prop}” necesita opciones.` });
    if (!propDef(x.object as ObjKey, x.prop)) out.push({ level: 'error', msg: `La propiedad ${x.prop} ya no existe en ${OBJ_LABEL[x.object]}.` });
  }
  const dup = fields.map(x => x.object + '.' + x.prop).filter((k, i, a) => a.indexOf(k) !== i);
  if (dup.length) out.push({ level: 'warn', msg: `Hay campos que guardan en la misma propiedad (${[...new Set(dup)].join(', ')}): el último gana.` });
  return out;
}
