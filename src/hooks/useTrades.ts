'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeTrade,
  getOpenTrades,
  getTradeAnomalies,
  getTradeAttribution,
  getTradeById,
  getTradesPage,
  getTradeStats,
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
  const wsConnected = useWsStore((s) => s.connected);
  return useQuery({
    queryKey: ['trades', 'open', accountId ?? null],
    queryFn: () => getOpenTrades(accountId),
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: wsConnected ? false : OPEN_TRADES_REST_POLL_MS,
    refetchIntervalInBackground: false,
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
      filters.accountStrategyId ?? null,
      filters.page ?? 0,
      filters.size ?? 20,
    ],
    queryFn: () => getTradesPage(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,

    placeholderData: (prev) => prev,
  });
}

/**
 * Aggregate journal stats over the FULL filtered trade set (all pages),
 * computed server-side. Scoped to the same filters as the list minus
 * pagination, so the hero strip shows authoritative totals — never per-page
 * client math.
 */
export function useTradeStats(filters: Omit<TradesPageFilters, 'page' | 'size'>) {
  return useQuery({
    queryKey: [
      'trades',
      'stats',
      filters.status ?? 'ALL',
      filters.strategyCode ?? null,
      filters.symbol ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.accountId ?? null,
      filters.accountStrategyId ?? null,
    ],
    queryFn: () => getTradeStats(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
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

/**
 * Manually close every open position on a trade. Used by the "Close trade"
 * button on the trade detail page. Refreshes the detail query and the open
 * trades list so the dashboard repaints once the close lands.
 */
export function useCloseTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => closeTrade(tradeId),
    onSuccess: (trade) => {
      queryClient.setQueryData(['trades', 'detail', trade.id], trade);
      queryClient.invalidateQueries({ queryKey: ['trades', 'open'] });
      queryClient.invalidateQueries({ queryKey: ['trades', 'list'] });
    },
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

export function useDailyPnl(from: string, to: string, strategyCode?: string, symbol?: string) {
  const enabled = Boolean(from) && Boolean(to);
  return useQuery({
    queryKey: ['pnl', 'daily', from, to, strategyCode ?? null, symbol ?? null],
    queryFn: () => getDailyPnl(from, to, strategyCode, symbol),
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

/**
 * Stuck-trade anomaly feed for the admin /research dashboard. 30 s poll —
 * matches the rest of the ops panels. Healthy state returns []; the panel
 * renders nothing in that case.
 */
export function useTradeAnomalies() {
  return useQuery({
    queryKey: ['trades', 'anomalies'],
    queryFn: getTradeAnomalies,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
