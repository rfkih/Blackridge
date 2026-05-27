'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateBacktestStrategy,
  createBacktestRun,
  getBacktestCandles,
  getBacktestEquityPoints,
  getBacktestRun,
  getBacktestTrades,
  listBacktestRuns,
  type ActivateStrategyPayload,
  type BacktestListFilters,
} from '@/lib/api/backtest';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';
import type { BacktestRun, BacktestRunPayload } from '@/types/backtest';

const ACTIVE_STATUSES = new Set<BacktestRun['status']>(['PENDING', 'RUNNING']);
const POLL_MS = 5_000;
/** Detail-page poll cadence. Adaptive: when STOMP is connected we get live
 *  progress frames pushed to the cache by `useBacktestProgressStream`, so the
 *  REST poll is just a safety net and can run slowly. When the socket is down
 *  the poll becomes the *only* progress source, so we tighten it back up. */
const DETAIL_POLL_FAST_MS = 1_000;
const DETAIL_POLL_SLOW_MS = 10_000;

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
      filters.triggeredBy ?? null,
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
  const queryClient = useQueryClient();
  const wsConnected = useWsStore((s) => s.connected);
  const query = useQuery({
    queryKey: ['backtest-run', id],
    queryFn: () => getBacktestRun(id as string),
    enabled: isValidId(id),

    staleTime: QUERY_STALE_TIMES.backtestResults,
    refetchInterval: (q) => {
      const run = q.state.data;
      if (!run) return false;
      if (!ACTIVE_STATUSES.has(run.status)) return false;

      return wsConnected ? DETAIL_POLL_SLOW_MS : DETAIL_POLL_FAST_MS;
    },
    refetchIntervalInBackground: false,
  });

  const prevStatusRef = useRef<BacktestRun['status'] | null>(null);
  const currentStatus = query.data?.status;
  useEffect(() => {
    if (!isValidId(id) || !currentStatus) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = currentStatus;
    if (prev && ACTIVE_STATUSES.has(prev) && !ACTIVE_STATUSES.has(currentStatus)) {
      queryClient.invalidateQueries({ queryKey: ['backtest-run', id, 'trades'] });
      queryClient.invalidateQueries({ queryKey: ['backtest-run', id, 'equity-points'] });
      queryClient.invalidateQueries({ queryKey: ['backtest-run', id, 'candles'] });
    }
  }, [id, currentStatus, queryClient]);

  return query;
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

export function useActivateBacktestStrategy(runId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActivateStrategyPayload) => {
      if (!runId) throw new Error('runId is required');
      return activateBacktestStrategy(runId, payload);
    },
    onSuccess: (strategy) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy', strategy.id] });
    },
  });
}

/**
 * Returns the count + loading state of the caller's PENDING or RUNNING
 * backtests, plus the id of the first active run for a "View run →" link.
 *
 * `isLoading` is true while either query is still in its initial fetch —
 * callers should disable the submit button during this window to prevent a
 * race where count is 0 before the data arrives, the user clicks, gets a
 * 429, and then the warning bar appears a beat later (double-message bug).
 */
export function useActiveBacktestCount(): {
  count: number;
  isLoading: boolean;
  firstActiveId: string | null;
} {
  const pendingQ = useBacktestRuns({ status: 'PENDING', size: 1, triggeredBy: 'USER' });
  const runningQ = useBacktestRuns({ status: 'RUNNING', size: 1, triggeredBy: 'USER' });
  return {
    count: (pendingQ.data?.total ?? 0) + (runningQ.data?.total ?? 0),
    isLoading: pendingQ.isLoading || runningQ.isLoading,

    firstActiveId:
      runningQ.data?.content[0]?.id ?? pendingQ.data?.content[0]?.id ?? null,
  };
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
      } catch (err) {
        console.warn('[useBacktest] malformed progress frame dropped:', err);
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

      if (frame.status === 'COMPLETED' || frame.status === 'FAILED') {
        void queryClient.invalidateQueries({ queryKey: ['backtest-run', runId] });
      }
    });

    return unsubscribe;
  }, [runId, connected, queryClient]);
}

export function useTopRunsForStrategy(
  strategyCode: string,
  symbol: string,
  interval: string,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: ['top-runs', strategyCode, symbol, interval],
    queryFn: () =>
      listBacktestRuns({
        status: 'COMPLETED',
        strategyCode,
        symbol,
        interval,
        size: 50,
        sortBy: 'createdAt',
        sortDir: 'DESC',
      }),
    enabled: enabled && Boolean(strategyCode) && Boolean(symbol) && Boolean(interval),
    staleTime: 60_000,
  });

  const topRuns = useMemo(() => {
    if (!query.data) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 2);
    const cutoffStr = cutoff.toISOString();
    return query.data.content
      .filter((r) => {
        if (!r.metrics) return false;
        if ((r.metrics.profitFactor ?? 0) <= 1.0) return false;
        return r.fromDate <= cutoffStr;
      })
      .sort((a, b) => {
        const ag90A =
          a.metrics?.geometricReturnPctAtAlloc90 ?? a.metrics?.totalReturnPct ?? -Infinity;
        const ag90B =
          b.metrics?.geometricReturnPctAtAlloc90 ?? b.metrics?.totalReturnPct ?? -Infinity;
        return ag90B - ag90A;
      })
      .slice(0, 5);
  }, [query.data]);

  return { topRuns, isLoading: query.isLoading, isError: query.isError };
}
