import { apiClient } from './client';
import type { PnlSummary } from '@/types/trading';
import type { DailyPnl, StrategyPnl } from '@/types/pnl';

interface BackendPnlSummary {
  period: string | null;
  realizedPnl: number | string | null;
  unrealizedPnl: number | string | null;
  totalPnl: number | string | null;
  tradeCount: number | null;
  winRate: number | string | null;
  openCount: number | null;
}

interface BackendDailyPnl {
  date: string | null;
  realizedPnl: number | string | null;
  tradeCount: number | null;
}

interface BackendStrategyPnl {
  strategyCode: string | null;
  // Backend emits `realizedPnl`; older builds shipped `totalPnl`. Accept both.
  realizedPnl?: number | string | null;
  totalPnl?: number | string | null;
  tradeCount: number | null;
  winRate: number | string | null;
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

export async function getDailyPnl(
  from: string,
  to: string,
  strategyCode?: string,
): Promise<DailyPnl[]> {
  const params: Record<string, unknown> = { from, to };
  if (strategyCode) params.strategyCode = strategyCode;
  const { data } = await apiClient.get<BackendDailyPnl[]>('/api/v1/pnl/daily', { params });
  return (data ?? [])
    .map((d) => ({
      date: d.date ?? '',
      realizedPnl: num(d.realizedPnl),
      tradeCount: d.tradeCount ?? 0,
    }))
    .filter((d) => d.date.length > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function getPnlByStrategy(from?: string, to?: string): Promise<StrategyPnl[]> {
  const params: Record<string, unknown> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await apiClient.get<BackendStrategyPnl[]>('/api/v1/pnl/by-strategy', { params });
  return (data ?? []).map((s) => ({
    strategyCode: s.strategyCode ?? '',
    totalPnl: num(s.totalPnl ?? s.realizedPnl),
    winRate: num(s.winRate),
    tradeCount: s.tradeCount ?? 0,
  }));
}
