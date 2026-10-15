// Constantes y tipos compartidos de «Redes sociales» (plataformas, canales, formato de fechas).
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp';
export const PLATFORMS: { id: Platform; label: string; short: string; tone: string }[] = [
  { id: 'instagram', label: 'Instagram', short: 'IG', tone: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
  { id: 'facebook', label: 'Facebook', short: 'FB', tone: 'bg-[#0866FF]' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', tone: 'bg-[#111111]' },
  { id: 'whatsapp', label: 'WhatsApp', short: 'WA', tone: 'bg-[#25D366]' },
];
export const platformLabel = (p: string) => PLATFORMS.find(x => x.id === p)?.label ?? p;
export const when = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '' : d.toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export const AI_STATE: Record<string, string> = { idle: '', awaiting_n8n: 'IA preparando respuesta…', draft_ready: 'Borrador de IA por aprobar', needs_human: 'Necesita a una persona', replied: 'Respondida por IA', off: '' };
