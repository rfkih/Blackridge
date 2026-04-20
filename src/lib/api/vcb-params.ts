import { apiClient } from './client';
import type { VcbParams } from '@/types/strategy';
import type { BackendParamResponse } from '@/types/api';

const BASE = '/api/v1/vcb-params';

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export async function getVcbDefaults(): Promise<VcbParams> {
  const { data } = await apiClient.get<BackendParamResponse<VcbParams>>(`${BASE}/defaults`);
  return data.effectiveParams;
}

export async function getVcbParams(accountStrategyId: string): Promise<VcbParams> {
  const { data } = await apiClient.get<BackendParamResponse<VcbParams>>(
    `${BASE}/${accountStrategyId}`,
  );
  return data.effectiveParams;
}

export async function putVcbParams(
  accountStrategyId: string,
  params: VcbParams,
): Promise<VcbParams> {
  const { data } = await apiClient.put<BackendParamResponse<VcbParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function patchVcbParams(
  accountStrategyId: string,
  params: Partial<VcbParams>,
): Promise<VcbParams> {
  const { data } = await apiClient.patch<BackendParamResponse<VcbParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function deleteVcbParams(accountStrategyId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${accountStrategyId}`);
}
