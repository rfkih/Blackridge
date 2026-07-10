'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSweep,
  evaluateHoldout,
  getBacktestAnalysis,
  getSweep,
  getTprParams,
  listSweeps,
  searchResearchLog,
  searchSweeps,
} from '@/lib/api/research';
import type { ResearchLogQuery, SweepsQuery } from '@/types/research';
import { generateIdempotencyKey } from '@/lib/idempotency';
import { getLsrDefaults } from '@/lib/api/lsr-params';
import { getVcbDefaults } from '@/lib/api/vcb-params';
import { useAuthStore } from '@/store/authStore';
import type { SweepSpec } from '@/types/research';

const LOG_KEY = ['research', 'log'] as const;

/** Analysis for a specific run. Cached with long staleTime — analysis doesn't
 *  mutate unless the run re-runs. */
export function useBacktestAnalysis(runId: string | undefined, recompute = false) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['research', 'analysis', runId, recompute],
    queryFn: () => getBacktestAnalysis(runId as string, recompute),
    enabled: Boolean(runId) && Boolean(userId),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Filterable + paginated research log. Returns a Page envelope so the panel
 * can render Prev/Next + total counts. Query key includes every filter so
 * each filter combination forms its own cache entry. `placeholderData` keeps
 * the previous page visible during refetch to avoid flicker.
 */
export function useSearchResearchLog(q: ResearchLogQuery) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [
      ...LOG_KEY,
      'search',
      q.strategyCode ?? '',
      q.asset ?? '',
      q.interval ?? '',
      q.search ?? '',
      q.sort ?? '',
      q.page ?? 0,
      q.size ?? 25,
    ],
    queryFn: () => searchResearchLog(q),
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

const SWEEP_LIST_KEY = ['research', 'sweeps'] as const;

export function useCreateSweep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (spec: SweepSpec) => createSweep(spec, generateIdempotencyKey('sweep')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SWEEP_LIST_KEY });
    },
  });
}

/**
 * One-shot holdout evaluation. On success, invalidate the sweep detail
 * query so the page picks up holdoutBacktestRunId immediately.
 */
export function useEvaluateHoldout(sweepId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paramSet: Record<string, number | string | boolean>) => {
      if (!sweepId) throw new Error('sweepId required');
      return evaluateHoldout(sweepId, paramSet);
    },
    onSuccess: () => {
      if (sweepId) {
        // Must match useSweep's key ('sweeps', plural) — COMPLETED sweeps stop
        // polling, so a missed invalidation here never self-heals.
        queryClient.invalidateQueries({ queryKey: ['research', 'sweeps', sweepId] });
      }
    },
  });
}

export function useListSweeps() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: SWEEP_LIST_KEY,
    queryFn: listSweeps,
    enabled: Boolean(userId),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

/**
 * Filterable + paginated sweep list. Status accepts CSV ("RUNNING,PENDING").
 * Sort is Spring's "field,direction" string. Returns a Page envelope so the
 * panel can render Prev/Next + total counts. Polls more aggressively than
 * the recent-promotions feed because in-flight sweep counters move every
 * combo (~seconds).
 */
export function useSearchSweeps(q: SweepsQuery) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [
      ...SWEEP_LIST_KEY,
      'search',
      q.status ?? '',
      q.sort ?? '',
      q.page ?? 0,
      q.size ?? 25,
    ],
    queryFn: () => searchSweeps(q),
    enabled: Boolean(userId),
    staleTime: 5_000,
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Strategy-agnostic defaults loader. Returns the canonical defaults for the
 * given strategy code as a plain {key: number} map suitable for deriving
 * sweep ranges. TPR is fetched via the live params endpoint (TPR is a
 * singleton so its "current" params double as its baseline); VCB/LSR have
 * dedicated /defaults endpoints. Booleans / non-numeric values are filtered
 * out so the UI only offers tunable keys.
 */
function pickNumericFields(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as { [key: string]: unknown })) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

export function useStrategyDefaults(strategyCode: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['strategy-defaults', strategyCode],
    queryFn: async (): Promise<Record<string, number>> => {
      switch ((strategyCode ?? '').toUpperCase()) {
        case 'TPR':
          return pickNumericFields(await getTprParams());
        case 'VCB':
          return pickNumericFields(await getVcbDefaults());
        case 'LSR':
          return pickNumericFields(await getLsrDefaults());
        default:
          return {};
      }
    },
    enabled: Boolean(strategyCode) && Boolean(userId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Polls a sweep aggressively while it's running so the leaderboard updates
 * as each combo completes. Slows to a crawl once the sweep is COMPLETED /
 * FAILED to avoid hammering the endpoint.
 */
export function useSweep(sweepId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['research', 'sweeps', sweepId],
    queryFn: () => getSweep(sweepId as string),
    enabled: Boolean(sweepId) && Boolean(userId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // 2.5s — the response carries the FULL per-combo results array, so a
      // 1s cadence on a 256-combo sweep was needlessly heavy on the JVM.
      if (status === 'RUNNING' || status === 'PENDING') return 2_500;
      return false;
    },
    staleTime: 2_500,
  });
}
