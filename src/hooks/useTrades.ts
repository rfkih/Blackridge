'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getOpenTrades,
  getRecentTrades,
  getTradeAttribution,
  getTradeById,
  getTradePositions,
  getTradesPage,
  type TradesPageFilters,
} from '@/lib/api/trades';
import { getDailyPnl, getPnlByStrategy, getPnlSummary } from '@/lib/api/pnl';
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

/**
 * Paginated + filtered trades list. Filter state is carried in URL search
 * params at the page layer; this hook just receives the already-parsed
 * filters as its queryKey so cache entries are scoped to each unique combo.
 */
export function useTradesList(filters: TradesPageFilters) {
  return useQuery({
    queryKey: [
      'trades',
      'list',
      filters.status ?? 'ALL',
      filters.strategyCode ?? null,
      filters.symbol ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.accountId ?? null,
      filters.page ?? 0,
      filters.size ?? 20,
    ],
    queryFn: () => getTradesPage(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
    // Keep the previous page's data visible while the new page loads so the
    // table doesn't flash to a skeleton on every sort/filter/paginate.
    placeholderData: (prev) => prev,
  });
}

export function useTrade(id: string | undefined) {
  return useQuery({
    queryKey: ['trades', 'detail', id ?? null],
    queryFn: () => getTradeById(id as string),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIMES.closedTrades,
  });
}

export function useTradePositions(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['trades', 'positions', id ?? null],
    queryFn: () => getTradePositions(id as string),
    enabled: Boolean(id) && (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIMES.closedTrades,
  });
}

/**
 * Phase 2c — P&L decomposition for a single trade. Returns null when
 * the backend reports no intent (open trade, or legacy row).
 */
export function useTradeAttribution(id: string | undefined) {
  return useQuery({
    queryKey: ['trades', 'attribution', id ?? null],
    queryFn: () => getTradeAttribution(id as string),
    enabled: Boolean(id),
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

export function useDailyPnl(from: string, to: string, strategyCode?: string) {
  // Enabled only when we have a well-formed window — empty strings would hit
  // the backend with `?from=&to=` and trigger a 400.
  const enabled = Boolean(from) && Boolean(to);
  return useQuery({
    queryKey: ['pnl', 'daily', from, to, strategyCode ?? null],
    queryFn: () => getDailyPnl(from, to, strategyCode),
    enabled,
    staleTime: QUERY_STALE_TIMES.pnlSummary,
  });
}

export function usePnlByStrategy(from?: string, to?: string) {
  return useQuery({
    queryKey: ['pnl', 'by-strategy', from ?? null, to ?? null],
    queryFn: () => getPnlByStrategy(from, to),
    staleTime: QUERY_STALE_TIMES.pnlSummary,
  });
}
