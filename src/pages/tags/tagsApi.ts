import { api } from '../../lib/backend';
import { API_URL } from '../../lib/auth';

export type Placement = 'head_start' | 'head_end' | 'body_start' | 'body_end';
export type Consent = 'essential' | 'analytics' | 'marketing';
export type Part = { placement: Placement; code: string };
export type Rule = { mode: 'include' | 'exclude'; op: 'equals' | 'starts' | 'contains'; value: string };
export type Template = 'gtm' | 'ga4' | 'meta_pixel' | 'clarity' | 'search_console' | 'custom';
export type Warning = { code: string; message: string };
export type Tag = { id: number; name: string; notes: string; template: Template; params: { id?: string }; parts: Part[]; consent: Consent; sites: string[]; pageTypes: string[]; hosts: string[]; rules: Rule[]; priority: number; enabled: boolean; version: number; updatedBy: string | null; createdAt: string; updatedAt: string; warnings: Warning[] };
export type TagDraft = Omit<Tag, 'id' | 'version' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'warnings'>;
export type Banner = { enabled: boolean; mode: 'optout' | 'optin'; text: string; accept: string; reject: string; policyUrl: string; policyLabel: string };
export type TemplateInfo = { label: string; idLabel: string; example: string; consent: Consent; hint: string; idPattern: string };
export type TagsList = { master: boolean; banner: Banner; results: Tag[]; meta: { maxTags: number; maxBytes: number; templates: Record<string, TemplateInfo> } };
export type Version = { id: number; version: number; action: string; at: string; by: string | null; name: string; enabled: boolean; parts: Part[] };

export const PLACEMENT_LABEL: Record<Placement, string> = { head_start: 'Head (al inicio)', head_end: 'Head (al final)', body_start: 'Body (al inicio)', body_end: 'Body (al final)' };
export const CONSENT_LABEL: Record<Consent, string> = { essential: 'Esencial', analytics: 'Analítica', marketing: 'Marketing' };
export const CONSENT_HELP: Record<Consent, string> = { essential: 'Se carga siempre. Solo para lo imprescindible (verificaciones, GTM con modo de consentimiento).', analytics: 'Mide visitas y comportamiento. Espera al consentimiento (en EE. UU. se permite hasta que la persona se oponga).', marketing: 'Publicidad y remarketing (píxeles). Espera al consentimiento y respeta la señal “Global Privacy Control”.' };
export const TEMPLATE_LABEL: Record<Template, string> = { gtm: 'Google Tag Manager', ga4: 'Google Analytics 4', meta_pixel: 'Píxel de Meta', clarity: 'Microsoft Clarity', search_console: 'Search Console', custom: 'Código personalizado' };
export const SITE_LABEL: Record<string, string> = { web: 'Sitio comercial (nexahome.example)', crm: 'Formularios del CRM (/landing, /contacto)' };
export const PAGE_TYPE_LABEL: Record<string, string> = { all: 'Todas las páginas', form: 'Formularios del CRM', blog: 'Blog', site: 'Sitio comercial (resto)' };
export const ACTION_LABEL: Record<string, string> = { create: 'Creado', update: 'Editado', enable: 'Activado', disable: 'Desactivado', restore: 'Restaurado', delete: 'Eliminado' };

export const listTags = () => api<TagsList>('GET', '/site/tags');
export const getTag = (id: number) => api<Tag>('GET', `/site/tags/${id}`);
export const createTag = (b: TagDraft) => api<Tag>('POST', '/site/tags', b);
export const updateTag = (id: number, b: TagDraft) => api<Tag>('PUT', `/site/tags/${id}`, b);
export const setEnabled = (id: number, enabled: boolean) => api<Tag>('PATCH', `/site/tags/${id}/enabled`, { enabled });
export const deleteTag = (id: number) => api('DELETE', `/site/tags/${id}`);
export const versions = (id: number) => api<{ results: Version[] }>('GET', `/site/tags/${id}/versions`);
export const restore = (id: number, vid: number) => api<Tag>('POST', `/site/tags/${id}/versions/${vid}/restore`);
export const setMaster = (enabled: boolean) => api<{ master: boolean }>('PUT', '/site/tags/master', { enabled });
export const saveBanner = (b: Banner) => api<{ banner: Banner }>('PUT', '/site/tags/banner', b);
export const renderTemplate = (template: string, id: string) => api<{ parts: Part[]; consent: Consent; warnings: Warning[] }>('POST', '/site/tags/render-template', { template, id });
export const appliesTo = (url: string, site: string) => api<{ ctx: { host: string; path: string; type: string }; master: boolean; results: { id: number; name: string; enabled: boolean; consent: Consent; applies: boolean }[] }>('GET', `/site/tags/applies?site=${site}&url=${encodeURIComponent(url)}`);
export const errMsg = (e: any) => {
  const m: Record<string, string> = { section_not_permitted: 'No tienes permiso sobre Códigos y scripts', too_many_tags: 'Llegaste al máximo de códigos', code_too_large: 'El código supera el tamaño máximo (100 KB)', invalid_template_id: 'El ID no tiene el formato correcto', code_required: 'Pega al menos un código', invalid_url: 'URL no válida', rate_limited: 'Demasiadas peticiones; espera un momento' };
  const d = (e?.detail as any)?.message; return m[e?.code] ?? (d ? `${e.code}: ${d}` : e?.code ?? 'Error');
};
export const loaderUrl = (site: 'web' | 'crm') => `${API_URL || location.origin}/api/v1/public/tags.js?site=${site}`;
export const loaderSnippet = (site: 'web' | 'crm') => `<script src="${loaderUrl(site)}" async></script>`;
