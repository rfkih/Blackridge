import { apiClient } from './client';
import type { AccountStrategy, AccountStrategyStatus } from '@/types/strategy';
import type { BackendAccountStrategy, PageResponse } from '@/types/api';

function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}

/** Map Java DTO field names to the frontend AccountStrategy shape. */
function mapAccountStrategy(s: BackendAccountStrategy): AccountStrategy {
  return {
    id: s.accountStrategyId,
    accountId: s.accountId,
    strategyCode: s.strategyCode,
    symbol: s.symbol,
    interval: s.intervalName,
    status: (s.enabled ? 'LIVE' : 'STOPPED') as AccountStrategyStatus,
    capitalAllocatedUsdt: s.capitalAllocatedUsdt,
    allowLong: s.allowLong,
    allowShort: s.allowShort,
    priorityOrder: s.priorityOrder,
    createdAt: s.createdTime,
    updatedAt: s.updatedTime,
  };
}

export async function getAccountStrategies(userId?: string): Promise<AccountStrategy[]> {
  const params: Record<string, unknown> = {};
  if (userId) params.userId = userId;
  const { data } = await apiClient.get<
    BackendAccountStrategy[] | PageResponse<BackendAccountStrategy>
  >('/api/v1/account-strategies', { params });
  return extractList(data).map(mapAccountStrategy);
}

export async function getAccountStrategyById(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.get<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}`,
  );
  return mapAccountStrategy(data);
}

export interface CreateAccountStrategyPayload {
  accountId: string;
  strategyCode: string;
  symbol: string;
  intervalName: string;
  allowLong: boolean;
  allowShort: boolean;
  maxOpenPositions: number;
  capitalAllocationPct: number;
  priorityOrder: number;
  enabled?: boolean;
}

export async function createAccountStrategy(
  payload: CreateAccountStrategyPayload,
): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    '/api/v1/account-strategies',
    payload,
  );
  return mapAccountStrategy(data);
}

export async function deleteAccountStrategy(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/account-strategies/${id}`);
}
