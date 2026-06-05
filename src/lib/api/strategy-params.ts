import { apiClient } from './client';
import type {
  StrategyParamCreateRequest,
  StrategyParamPreset,
  StrategyParamUpdateRequest,
} from '@/types/strategy';

/**
 * Saved-preset CRUD against `/api/v1/strategy-params` (V29+ unified table).
 *
 * Additive to the existing `/api/v1/{lsr,vcb,vbo}-params` endpoints — those
 * still drive the live edit forms and now write into the active preset row of
 * this table behind the scenes. Code here powers a separate "manage presets"
 * UI without touching those forms.
 */
const BASE = '/api/v1/strategy-params';

/**
 * Coerce a single override value: a finite numeric string (e.g. the backend
 * serialized a `param_overrides` jsonb number as `"0.35"`) becomes a number;
 * everything else (already-numeric, genuine strings, booleans, null) passes
 * through untouched. Mirrors the `toNum` idiom but never collapses a real
 * non-numeric value to a number. Without this, the param forms' `typeof v ===
 * 'number'` guard silently drops string-encoded numerics.
 */
function coerceOverrideValue(v: unknown): unknown {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  }
  return v;
}

/** Map a wire preset, coercing each override value to a number where it is a
 *  finite numeric string. The rest of the shape passes through unchanged. */
export function mapStrategyParamPreset(p: StrategyParamPreset): StrategyParamPreset {
  const raw = p.overrides ?? {};
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    overrides[key] = coerceOverrideValue(value);
  }
  return { ...p, overrides };
}

export async function listStrategyParams(
  accountStrategyId: string,
): Promise<StrategyParamPreset[]> {
  const { data } = await apiClient.get<StrategyParamPreset[]>(BASE, {
    params: { accountStrategyId },
  });
  return (data ?? []).map(mapStrategyParamPreset);
}

export async function createStrategyParam(
  request: StrategyParamCreateRequest,
): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(BASE, request);
  return mapStrategyParamPreset(data);
}

export async function updateStrategyParam(
  paramId: string,
  request: StrategyParamUpdateRequest,
): Promise<StrategyParamPreset> {
  const { data } = await apiClient.patch<StrategyParamPreset>(`${BASE}/${paramId}`, request);
  return mapStrategyParamPreset(data);
}

export async function activateStrategyParam(paramId: string): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(`${BASE}/${paramId}/activate`);
  return mapStrategyParamPreset(data);
}

export async function deactivateStrategyParam(paramId: string): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(`${BASE}/${paramId}/deactivate`);
  return mapStrategyParamPreset(data);
}

export async function deleteStrategyParam(paramId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${paramId}`);
}
