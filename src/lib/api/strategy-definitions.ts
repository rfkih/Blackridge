import type {
  CreateStrategyDefinitionPayload,
  StrategyDefinition,
  UpdateStrategyDefinitionPayload,
} from '@/types/strategyDefinition';
import { apiClient } from './client';

interface BackendStrategyDefinition {
  strategyDefinitionId: string | null;
  strategyCode: string | null;
  strategyName: string | null;
  strategyType: string | null;
  description: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
}

function map(r: BackendStrategyDefinition): StrategyDefinition {
  return {
    id: r.strategyDefinitionId ?? '',
    strategyCode: r.strategyCode ?? '',
    strategyName: r.strategyName ?? '',
    strategyType: r.strategyType ?? '',
    description: r.description,
    status: (r.status ?? 'ACTIVE') as StrategyDefinition['status'],
    createdAt: r.createdTime ?? '',
    updatedAt: r.updatedTime ?? '',
  };
}

const BASE = '/api/v1/strategy-definitions';

export async function listStrategyDefinitions(): Promise<StrategyDefinition[]> {
  const { data } = await apiClient.get<BackendStrategyDefinition[]>(BASE);
  return (data ?? []).map(map);
}

export async function getStrategyDefinition(id: string): Promise<StrategyDefinition> {
  const { data } = await apiClient.get<BackendStrategyDefinition>(`${BASE}/${id}`);
  return map(data);
}

export async function createStrategyDefinition(
  payload: CreateStrategyDefinitionPayload,
): Promise<StrategyDefinition> {
  const { data } = await apiClient.post<BackendStrategyDefinition>(BASE, payload);
  return map(data);
}

export async function updateStrategyDefinition(
  id: string,
  payload: UpdateStrategyDefinitionPayload,
): Promise<StrategyDefinition> {
  const { data } = await apiClient.patch<BackendStrategyDefinition>(`${BASE}/${id}`, payload);
  return map(data);
}

export async function deprecateStrategyDefinition(id: string): Promise<StrategyDefinition> {
  // DELETE is intentionally a soft-delete: the service flips status to
  // DEPRECATED so historical account_strategy / backtest_run rows still
  // resolve their strategy metadata.
  const { data } = await apiClient.delete<BackendStrategyDefinition>(`${BASE}/${id}`);
  return map(data);
}
