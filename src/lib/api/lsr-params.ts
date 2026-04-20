import { apiClient } from './client';
import type { LsrParams } from '@/types/strategy';
import type { BackendParamResponse } from '@/types/api';

const BASE = '/api/v1/lsr-params';

/** /defaults returns the same envelope as /:id — params live under effectiveParams. */
export async function getLsrDefaults(): Promise<LsrParams> {
  const { data } = await apiClient.get<BackendParamResponse<LsrParams>>(`${BASE}/defaults`);
  return data.effectiveParams;
}

/** Individual strategy endpoint wraps params in effectiveParams. */
export async function getLsrParams(accountStrategyId: string): Promise<LsrParams> {
  const { data } = await apiClient.get<BackendParamResponse<LsrParams>>(
    `${BASE}/${accountStrategyId}`,
  );
  return data.effectiveParams;
}

export async function putLsrParams(
  accountStrategyId: string,
  params: LsrParams,
): Promise<LsrParams> {
  const { data } = await apiClient.put<BackendParamResponse<LsrParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function patchLsrParams(
  accountStrategyId: string,
  params: Partial<LsrParams>,
): Promise<LsrParams> {
  const { data } = await apiClient.patch<BackendParamResponse<LsrParams>>(
    `${BASE}/${accountStrategyId}`,
    params,
  );
  return data.effectiveParams;
}

export async function deleteLsrParams(accountStrategyId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${accountStrategyId}`);
}
