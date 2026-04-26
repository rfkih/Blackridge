import { apiClient } from './client';
import type { VboParams } from '@/types/strategy';
import type { BackendParamResponse } from '@/types/api';

const BASE = '/api/v1/vbo-params';

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export async function getVboDefaults(): Promise<VboParams> {
  const { data } = await apiClient.get<BackendParamResponse<VboParams>>(`${BASE}/defaults`);
  return data.effectiveParams;
}

export async function getVboParams(accountStrategyId: string): Promise<VboParams> {
  const { data } = await apiClient.get<BackendParamResponse<VboParams>>(
    `${BASE}/${accountStrategyId}`,
  );
  return data.effectiveParams;
}

export async function putVboParams(
  accountStrategyId: string,
  params: VboParams,
): Promise<VboParams> {
  const { data } = await apiClient.put<BackendParamResponse<VboParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function patchVboParams(
  accountStrategyId: string,
  params: Partial<VboParams>,
): Promise<VboParams> {
  const { data } = await apiClient.patch<BackendParamResponse<VboParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function deleteVboParams(accountStrategyId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${accountStrategyId}`);
}
