import { apiClient } from './client';
import type { LsrParams } from '@/types/strategy';
import type { BackendParamResponse } from '@/types/api';

const BASE = '/api/v1/lsr-params';

/** /defaults returns LsrParams directly (not wrapped in effectiveParams). */
export async function getLsrDefaults(): Promise<LsrParams> {
  const { data } = await apiClient.get<LsrParams>(`${BASE}/defaults`);
  return data;
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
