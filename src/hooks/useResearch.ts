'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSweep,
  evaluateHoldout,
  getBacktestAnalysis,
  getResearchLog,
  getSweep,
  getTprParams,
  listSweeps,
} from '@/lib/api/research';
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

export function useResearchLog(strategyCode?: string, limit = 50) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...LOG_KEY, strategyCode ?? '*', limit],
    queryFn: () => getResearchLog(strategyCode, limit),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}

// ── Sweep hooks ─────────────────────────────────────────────────────────────

const SWEEP_LIST_KEY = ['research', 'sweeps'] as const;

export function useCreateSweep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (spec: SweepSpec) => createSweep(spec),
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
        queryClient.invalidateQueries({ queryKey: ['research', 'sweep', sweepId] });
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
 * Strategy-agnostic defaults loader. Returns the canonical defaults for the
 * given strategy code as a plain {key: number} map suitable for deriving
 * sweep ranges. TPR is fetched via the live params endpoint (TPR is a
 * singleton so its "current" params double as its baseline); VCB/LSR have
 * dedicated /defaults endpoints. Booleans / non-numeric values are filtered
 * out so the UI only offers tunable keys.
 */
export function useStrategyDefaults(strategyCode: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['strategy-defaults', strategyCode],
    queryFn: async (): Promise<Record<string, number>> => {
      let raw: Record<string, unknown> | null = null;
      switch ((strategyCode ?? '').toUpperCase()) {
        case 'TPR':
          raw = (await getTprParams()) as unknown as Record<string, unknown>;
          break;
        case 'VCB':
          raw = (await getVcbDefaults()) as unknown as Record<string, unknown>;
          break;
        case 'LSR':
          raw = (await getLsrDefaults()) as unknown as Record<string, unknown>;
          break;
        default:
          return {};
      }
      if (!raw) return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
        else if (typeof v === 'string') {
          const n = Number(v);
          if (Number.isFinite(n)) out[k] = n;
        }
      }
      return out;
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
      // 1s while running so per-combo progress bars advance smoothly. Backend
      // polls the underlying backtest at 500ms and persists on every change;
      // 1s on the client gives the UI two chances to render each progress
      // step. Drops to off once the sweep is settled.
      if (status === 'RUNNING' || status === 'PENDING') return 1_000;
      return false;
    },
    staleTime: 1_000,
  });
}
