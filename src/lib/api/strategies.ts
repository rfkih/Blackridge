import { apiClient } from './client';
import type { AccountStrategy, AccountStrategyStatus } from '@/types/strategy';
import type { BackendAccountStrategy, PageResponse } from '@/types/api';

function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}

/**
 * Coerce a possibly-null BigDecimal string from the wire into a number. Java
 * serialises BigDecimal as either number or string depending on Jackson config;
 * anything that can't be parsed cleanly falls back to 0 so arithmetic stays
 * safe (sort-by-capital, aggregates) and the UI renders "0" instead of NaN.
 */
function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Map Java DTO field names to the frontend AccountStrategy shape. */
function mapAccountStrategy(s: BackendAccountStrategy): AccountStrategy {
  return {
    id: s.accountStrategyId,
    accountId: s.accountId,
    strategyCode: s.strategyCode,
    presetName: (s.presetName ?? '').trim() || 'Default',
    symbol: s.symbol,
    interval: s.intervalName,
    status: (s.enabled ? 'LIVE' : 'STOPPED') as AccountStrategyStatus,
    capitalAllocationPct: toNumber(s.capitalAllocationPct),
    maxOpenPositions: toNumber(s.maxOpenPositions),
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
  const { data } = await apiClient.get<BackendAccountStrategy>(`/api/v1/account-strategies/${id}`);
  return mapAccountStrategy(data);
}

export interface CreateAccountStrategyPayload {
  accountId: string;
  strategyCode: string;
  /** Optional user-facing preset label. Backend auto-names as "Preset N" if omitted. */
  presetName?: string;
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

/**
 * Activate this preset for its (account, strategy, symbol, interval) tuple.
 * Any currently-active sibling is deactivated atomically. Rejects (409) if a
 * sibling with open trades would have to be deactivated first.
 */
export async function activateAccountStrategy(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}/activate`,
  );
  return mapAccountStrategy(data);
}
