import { apiClient } from './client';
import type { PageEnvelope } from '@/types/api';

export type SpecOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPGRADE';

export interface StrategyDefinitionHistoryRow {
  historyId: string;
  priorHistoryId: string | null;
  strategyCode: string;
  strategyDefinitionId: string;
  archetype: string;
  archetypeVersion: number;
  specSchemaVersion: number;
  operation: SpecOperation;
  changedByUserId: string | null;
  changedAt: string | null;
  changeReason: string | null;
}

export interface StrategyDefinitionHistoryDetail extends StrategyDefinitionHistoryRow {
  specJsonb: Record<string, unknown> | null;
}

export type StrategyDefinitionHistoryPage = PageEnvelope<StrategyDefinitionHistoryRow>;

export interface ListHistoryParams {
  strategyCode: string;
  page?: number;
  size?: number;
}

export async function listStrategyDefinitionHistory(
  opts: ListHistoryParams,
): Promise<StrategyDefinitionHistoryPage> {
  const { data } = await apiClient.get<StrategyDefinitionHistoryPage>(
    '/api/v1/strategy-definition-history',
    {
      params: {
        strategyCode: opts.strategyCode,
        page: opts.page ?? 0,
        size: opts.size ?? 50,
      },
    },
  );
  return data;
}

export async function getStrategyDefinitionHistory(
  id: string,
): Promise<StrategyDefinitionHistoryDetail> {
  const { data } = await apiClient.get<StrategyDefinitionHistoryDetail>(
    `/api/v1/strategy-definition-history/${id}`,
  );
  return data;
}
