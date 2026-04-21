'use client';

import { useQuery } from '@tanstack/react-query';
import { getOpenTrades, getRecentTrades } from '@/lib/api/trades';
import { getPnlSummary } from '@/lib/api/pnl';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useWsStore } from '@/store/wsStore';
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

const OPEN_TRADES_REST_POLL_MS = 15_000;

export function useOpenTrades(accountId?: string) {
  // While the WS is connected we get live PnL frames + lifecycle events, so
  // 15s REST polling is duplicative. Fall back to it only when the socket is
  // down (initial connect, reconnect window, or backend WS outage).
  const wsConnected = useWsStore((s) => s.connected);
  return useQuery({
    queryKey: ['trades', 'open', accountId ?? null],
    queryFn: () => getOpenTrades(accountId),
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: wsConnected ? false : OPEN_TRADES_REST_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useRecentTrades(limit = 10, accountId?: string) {
  return useQuery({
    queryKey: ['trades', 'recent', limit, accountId ?? null],
    queryFn: () => getRecentTrades(limit, accountId),
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
