import { apiClient } from './client';
import type { LivePosition, Trades } from '@/types/trading';
import type { PageResponse } from '@/types/api';

function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}

/**
 * The unified GET /api/v1/trades endpoint returns Trades objects with `id`.
 * The open-positions panel expects LivePosition with `tradeId` and `openedAt`.
 * Map at the API boundary so the rest of the app stays consistent.
 */
function tradeToLivePosition(t: Trades): LivePosition {
  return {
    tradeId: t.id,
    accountId: t.accountId,
    accountStrategyId: t.accountStrategyId,
    symbol: t.symbol,
    direction: t.direction,
    quantity: t.quantity,
    entryPrice: t.entryPrice,
    // Pass null through — UI renders "—" for absent marks instead of entryPrice
    // (which would falsely imply "no movement since open").
    markPrice: t.markPrice ?? null,
    unrealizedPnl: t.unrealizedPnl ?? 0,
    unrealizedPnlPct: t.unrealizedPnlPct ?? 0,
    openedAt: t.entryTime,
  };
}

export async function getOpenTrades(accountId?: string): Promise<LivePosition[]> {
  const params: Record<string, unknown> = { status: 'OPEN' };
  if (accountId) params.accountId = accountId;
  const { data } = await apiClient.get<Trades[] | PageResponse<Trades>>('/api/v1/trades', {
    params,
  });
  return extractList(data).map(tradeToLivePosition);
}

export async function getRecentTrades(limit = 10, accountId?: string): Promise<Trades[]> {
  const params: Record<string, unknown> = { status: 'CLOSED', limit };
  if (accountId) params.accountId = accountId;
  const { data } = await apiClient.get<Trades[] | PageResponse<Trades>>('/api/v1/trades', {
    params,
  });
  return extractList(data);
}

export async function getTradeById(id: string): Promise<Trades> {
  const { data } = await apiClient.get<Trades>(`/api/v1/trades/${id}`);
  return data;
}
