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

export async function listStrategyParams(
  accountStrategyId: string,
): Promise<StrategyParamPreset[]> {
  const { data } = await apiClient.get<StrategyParamPreset[]>(BASE, {
    params: { accountStrategyId },
  });
  return data;
}

export async function getStrategyParam(paramId: string): Promise<StrategyParamPreset> {
  const { data } = await apiClient.get<StrategyParamPreset>(`${BASE}/${paramId}`);
  return data;
}

export async function createStrategyParam(
  request: StrategyParamCreateRequest,
): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(BASE, request);
  return data;
}

export async function updateStrategyParam(
  paramId: string,
  request: StrategyParamUpdateRequest,
): Promise<StrategyParamPreset> {
  const { data } = await apiClient.patch<StrategyParamPreset>(`${BASE}/${paramId}`, request);
  return data;
}

export async function activateStrategyParam(paramId: string): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(`${BASE}/${paramId}/activate`);
  return data;
}

export async function deactivateStrategyParam(paramId: string): Promise<StrategyParamPreset> {
  const { data } = await apiClient.post<StrategyParamPreset>(`${BASE}/${paramId}/deactivate`);
  return data;
}

export async function deleteStrategyParam(paramId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${paramId}`);
}
