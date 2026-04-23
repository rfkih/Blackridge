'use client';

import { useEffect, useMemo } from 'react';
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
import { subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';
import type { BacktestRun, BacktestRunPayload } from '@/types/backtest';

const ACTIVE_STATUSES = new Set<BacktestRun['status']>(['PENDING', 'RUNNING']);
const POLL_MS = 5_000;
/** Faster poll on the single-run detail page — users watch a progress bar
 *  there, so an extra request every second is a fair trade. */
const DETAIL_POLL_MS = 1_000;

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
    // Override the "immutable once complete" stale time while the run is
    // still progressing — TanStack treats the key as fresh otherwise and
    // wouldn't refetch on the interval below.
    staleTime: QUERY_STALE_TIMES.backtestResults,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run) return false;
      return ACTIVE_STATUSES.has(run.status) ? DETAIL_POLL_MS : false;
    },
    refetchIntervalInBackground: false,
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

interface ProgressFrame {
  backtestRunId?: string;
  status?: string;
  progressPercent?: number;
  timestamp?: number;
}

/**
 * Subscribes to the STOMP topic {@code /topic/backtest/{runId}} whenever:
 *   (a) the run id is valid, and
 *   (b) the STOMP client is connected (the backend enforces ownership on
 *       subscribe via WebSocketAuthInterceptor).
 *
 * Each frame is merged into the cached {@code BacktestRun} so the UI updates
 * in realtime without waiting for the REST poll tick. Polling remains as a
 * safety net — if the WS drops or is misconfigured, the progress bar still
 * advances every second.
 */
export function useBacktestProgressStream(runId: string | undefined): void {
  const queryClient = useQueryClient();
  const connected = useWsStore((s) => s.connected);

  useEffect(() => {
    if (!isValidId(runId)) return;
    if (!connected) return;

    const unsubscribe = subscribeToTopic(`/topic/backtest/${runId}`, (body) => {
      let frame: ProgressFrame;
      try {
        frame = JSON.parse(body) as ProgressFrame;
      } catch {
        return;
      }
      if (frame.backtestRunId && frame.backtestRunId !== runId) return;

      queryClient.setQueryData<BacktestRun | undefined>(
        ['backtest-run', runId],
        (prev) => {
          if (!prev) return prev;
          const next: BacktestRun = { ...prev };
          if (typeof frame.progressPercent === 'number') {
            next.progressPercent = Math.max(
              0,
              Math.min(100, Math.round(frame.progressPercent)),
            );
          }
          if (frame.status) {
            next.status = frame.status;
          }
          return next;
        },
      );

      // Terminal frames: refetch the full run detail so metrics / trade
      // history land in the cache without waiting for the poll interval.
      if (frame.status === 'COMPLETED' || frame.status === 'FAILED') {
        void queryClient.invalidateQueries({ queryKey: ['backtest-run', runId] });
      }
    });

    return unsubscribe;
  }, [runId, connected, queryClient]);
}
