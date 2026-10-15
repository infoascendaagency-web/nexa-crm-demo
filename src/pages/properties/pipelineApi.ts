// Guardado de pipelines con respuesta del servidor (para poder mostrar "etapa en uso", validaciones, etc.). Demo: local.
import { api, ApiError, rehydrate } from '../../lib/backend';
import { CONNECTED, patchState, savePipelines, search } from '../../lib/db';
import { PIPELINES, type Pipeline, type PipeObj } from '../../lib/schema';
import { OBJECTS } from '../../lib/schema';

export type Move = { from: { pipeline: string; stage: string }; to: { pipeline: string; stage: string } };
export const STAGE_PROP: Record<PipeObj, { pipeline: string; stage: string }> = { deals: { pipeline: 'pipeline', stage: 'dealstage' }, appointments: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage' }, tickets: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage' }, leads: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage' } };

/** Registros por etapa: "pipeline:etapa" → n */
export async function stageUsage(obj: PipeObj): Promise<Record<string, number>> {
  if (CONNECTED) { try { return (await api<{ results: Record<string, number> }>('GET', `/pipelines/${obj}/usage`)).results; } catch { return {}; } }
  const sp = STAGE_PROP[obj]; const out: Record<string, number> = {}; const first = PIPELINES[obj][0]?.id;
  for (const r of search(obj, { limit: 100000 }).results) { const s = r.properties[sp.stage]; if (!s) continue; const k = `${r.properties[sp.pipeline] ?? first}:${s}`; out[k] = (out[k] ?? 0) + 1; }
  return out;
}
const ERR: Record<string, string> = {
  stage_in_use: 'Hay registros en una etapa que quitaste: elige a qué etapa moverlos.', duplicate_pipeline_label: 'Dos pipelines tienen el mismo nombre.', duplicate_stage_label: 'Dos etapas del mismo pipeline tienen el mismo nombre.',
  invalid_probability: 'La probabilidad debe estar entre 0 y 100 %.', unknown_required_property: 'Una propiedad obligatoria ya no existe.', required_properties_not_supported: 'Las propiedades obligatorias solo existen para negocios y tickets.',
  forbidden: 'Solo un administrador puede editar pipelines.', move_target_missing: 'La etapa de destino del movimiento no existe.',
};
export const pipeErr = (e: unknown) => e instanceof ApiError ? ERR[e.code] ?? `Error del servidor (${e.code})` : (e as Error).message;

export async function savePipelineSet(obj: PipeObj, pipes: Pipeline[], moves: Move[]): Promise<void> {
  const norm = pipes.map(p => ({ ...p, label: p.label.trim(), stages: p.stages.map((s, i) => ({ ...s, label: s.label.trim(), order: i })) }));
  if (!CONNECTED) { PIPELINES[obj] = norm; savePipelines(); return; }
  try {
    const r = await api<{ results: Pipeline[] }>('PUT', `/pipelines/${obj}`, {
      pipelines: norm.map(p => ({ id: p.id, label: p.label, stages: p.stages.map(s => ({ id: s.id, label: s.label, closed: !!s.closed, ...(s.probability !== undefined && s.probability !== '' ? { probability: String(s.probability) } : {}), ...(s.requiredProperties?.length ? { requiredProperties: s.requiredProperties } : {}) })) })),
      ...(moves.length ? { moves } : {}),
    });
    PIPELINES[obj] = r.results; patchState(() => {}); await rehydrate();
  } catch (e) { throw new Error(pipeErr(e)); }
}
export const objName = (o: PipeObj) => OBJECTS[o].plural;
