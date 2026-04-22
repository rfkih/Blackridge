'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBacktestRun,
  getBacktestCandles,
  getBacktestEquityPoints,
  getBacktestRun,
  getBacktestTrades,
  listBacktestRuns,
  type BacktestListFilters,
} from '@/lib/api/backtest';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { BacktestRun, BacktestRunPayload } from '@/types/backtest';

const ACTIVE_STATUSES = new Set<BacktestRun['status']>(['RUNNING']);
const POLL_MS = 5_000;

/**
 * Paginated / filtered / sorted run history. Polls every 5s while any row in
 * the current page is still RUNNING so the status column updates itself
 * without a reload. `placeholderData: prev` keeps the previous page visible
 * while the new one loads so the table doesn't flash to a skeleton on every
 * filter change.
 */
export function useBacktestRuns(filters: BacktestListFilters = {}) {
  return useQuery({
    queryKey: [
      'backtest-runs',
      filters.status ?? null,
      filters.strategyCode ?? null,
      filters.symbol ?? null,
      filters.interval ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.sortBy ?? 'createdAt',
      filters.sortDir ?? 'DESC',
      filters.page ?? 0,
      filters.size ?? 20,
    ],
    queryFn: () => listBacktestRuns(filters),
    staleTime: 2_000,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (!result) return false;
      const hasActive = result.content.some((r) => ACTIVE_STATUSES.has(r.status));
      return hasActive ? POLL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
}

/**
 * Guards against `/backtest/undefined` and similar degenerate route params
 * (a URL segment of the literal string "undefined" passes Boolean() but will
 * 404 on the backend). Any id that isn't a non-empty, non-"undefined" string
 * disables the query so TanStack doesn't spam the backend with bad requests.
 */
function isValidId(id: string | undefined): id is string {
  return typeof id === 'string' && id.length > 0 && id !== 'undefined' && id !== 'null';
}

export function useBacktestRun(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest-run', id],
    queryFn: () => getBacktestRun(id as string),
    enabled: isValidId(id),
    staleTime: QUERY_STALE_TIMES.backtestResults,
  });
}

export function useCreateBacktestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BacktestRunPayload) => createBacktestRun(payload),
    onSuccess: (run) => {
      queryClient.setQueryData(['backtest-run', run.id], run);
      queryClient.invalidateQueries({ queryKey: ['backtest-runs'] });
    },
  });
}

/**
 * Result-page datasets. Backtest runs are immutable once completed, so we cache
 * them forever — the result page will never re-fetch them after the first hit.
 */
export function useBacktestTrades(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest-run', id, 'trades'],
    queryFn: () => getBacktestTrades(id as string),
    enabled: isValidId(id),
    staleTime: QUERY_STALE_TIMES.backtestResults,
  });
}

export function useBacktestCandles(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest-run', id, 'candles'],
    queryFn: () => getBacktestCandles(id as string),
    enabled: isValidId(id),
    staleTime: QUERY_STALE_TIMES.backtestResults,
  });
}

export function useBacktestEquityPoints(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest-run', id, 'equity-points'],
    queryFn: () => getBacktestEquityPoints(id as string),
    enabled: isValidId(id),
    staleTime: QUERY_STALE_TIMES.backtestResults,
  });
}

/**
 * Convenience: does the current list page contain any still-running run?
 * Uses the default (first-page) filter so every caller shares the same
 * cache entry and the poll fires once per app.
 */
export function useHasActiveBacktest(): boolean {
  const { data } = useBacktestRuns();
  return useMemo(() => (data?.content ?? []).some((r) => ACTIVE_STATUSES.has(r.status)), [data]);
}
