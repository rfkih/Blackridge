import { apiClient } from './client';
import type { PnlSummary } from '@/types/trading';

interface BackendPnlSummary {
  period: string | null;
  realizedPnl: number | string | null;
  unrealizedPnl: number | string | null;
  totalPnl: number | string | null;
  tradeCount: number | null;
  winRate: number | string | null;
  openCount: number | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function narrowPeriod(v: string | null | undefined): PnlSummary['period'] {
  if (v === 'week' || v === 'month') return v;
  return 'today';
}

export async function getPnlSummary(period: 'today' | 'week' | 'month'): Promise<PnlSummary> {
  const { data } = await apiClient.get<BackendPnlSummary>('/api/v1/pnl/summary', {
    params: { period },
  });
  return {
    period: narrowPeriod(data.period) || period,
    realizedPnl: num(data.realizedPnl),
    unrealizedPnl: num(data.unrealizedPnl),
    totalPnl: num(data.totalPnl),
    tradeCount: data.tradeCount ?? 0,
    winRate: num(data.winRate),
    openCount: data.openCount ?? 0,
  };
}
