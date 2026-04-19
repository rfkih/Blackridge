'use client';

import { useQuery } from '@tanstack/react-query';
import { getOpenTrades, getRecentTrades } from '@/lib/api/trades';
import { getPnlSummary } from '@/lib/api/pnl';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { PnlSummary } from '@/types/trading';

const FALLBACK_PNL: PnlSummary = {
  period: 'today',
  realizedPnl: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  tradeCount: 0,
  winRate: 0,
  openCount: 0,
};

export function useOpenTrades(accountId?: string) {
  return useQuery({
    queryKey: ['trades', 'open', accountId ?? null],
    queryFn: () => getOpenTrades(accountId),
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: 15_000,
  });
}

export function useRecentTrades(limit = 10) {
  return useQuery({
    queryKey: ['trades', 'recent', limit],
    queryFn: () => getRecentTrades(limit),
    staleTime: QUERY_STALE_TIMES.closedTrades,
  });
}

export function usePnlSummary(period: 'today' | 'week' | 'month' = 'today') {
  return useQuery({
    queryKey: ['pnl', 'summary', period],
    queryFn: () => getPnlSummary(period),
    staleTime: QUERY_STALE_TIMES.pnlSummary,
    placeholderData: FALLBACK_PNL,
    retry: false,
  });
}
