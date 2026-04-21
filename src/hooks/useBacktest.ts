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
} from '@/lib/api/backtest';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { BacktestRun, BacktestRunPayload } from '@/types/backtest';

const ACTIVE_STATUSES = new Set<BacktestRun['status']>(['RUNNING']);
const POLL_MS = 5_000;

/**
 * List of backtest runs. Polls every 5s while any run is still PENDING / RUNNING
 * so the status column updates itself without the user reloading.
 */
export function useBacktestRuns() {
  return useQuery({
    queryKey: ['backtest-runs'],
    queryFn: listBacktestRuns,
    staleTime: 2_000,
    refetchInterval: (query) => {
      const runs = query.state.data;
      if (!runs) return false;
      const hasActive = runs.some((r) => ACTIVE_STATUSES.has(r.status));
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

/** Convenience: does the current list contain any still-running run? */
export function useHasActiveBacktest(): boolean {
  const { data } = useBacktestRuns();
  return useMemo(() => (data ?? []).some((r) => ACTIVE_STATUSES.has(r.status)), [data]);
}
