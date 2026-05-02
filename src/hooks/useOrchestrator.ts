// TanStack Query hooks for the research orchestrator panels on /research.
// All polling cadences match other research panels (10–30s); the orchestrator
// is loopback-only and cheap to poll, but the underlying tables only mutate
// on tick boundaries (~minutes), so 30s is plenty.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  enqueueSweep,
  getLeaderboard,
  listIterations,
  listJournal,
  listQueue,
  listWalkForwardCandidates,
  runTick,
} from '@/lib/api/orchestrator';
import type {
  EnqueueSweepRequest,
  IterationRow,
  JournalRow,
  LeaderboardRow,
  QueueRow,
  QueueStatus,
} from '@/types/orchestrator';

const ORCH_KEY = ['research', 'orchestrator'] as const;

export function useLeaderboard(limit = 15) {
  return useQuery<LeaderboardRow[]>({
    queryKey: [...ORCH_KEY, 'leaderboard', limit],
    queryFn: () => getLeaderboard({ limit, sort: 'pf' }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useRecentIterations(limit = 20) {
  return useQuery<IterationRow[]>({
    queryKey: [...ORCH_KEY, 'iterations', limit],
    queryFn: () => listIterations({ limit }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useWalkForwardCandidates() {
  return useQuery<QueueRow[]>({
    queryKey: [...ORCH_KEY, 'walk-forward-candidates'],
    queryFn: () => listWalkForwardCandidates(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useQueueList(status?: QueueStatus, limit = 50) {
  return useQuery<QueueRow[]>({
    queryKey: [...ORCH_KEY, 'queue', status ?? 'all', limit],
    queryFn: () => listQueue({ status, limit }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useJournalList(filters?: {
  entryType?: string;
  status?: string;
  strategyCode?: string;
  limit?: number;
}) {
  return useQuery<JournalRow[]>({
    queryKey: [...ORCH_KEY, 'journal', filters ?? {}],
    queryFn: () => listJournal(filters),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Fire one iteration. The mutation can hold open up to ~30 min while the
 * orchestrator runs; the proxy timeout is sized to match. On success we
 * invalidate iterations + queue + leaderboard so the panels reflect the new
 * row immediately instead of waiting for the next 30 s poll.
 */
export function useTick() {
  const qc = useQueryClient();
  return useMutation<IterationRow, Error, void>({
    mutationFn: () => runTick(`tick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ORCH_KEY });
    },
  });
}

export function useEnqueueSweep() {
  const qc = useQueryClient();
  return useMutation<QueueRow, Error, EnqueueSweepRequest>({
    mutationFn: (body) =>
      enqueueSweep(body, `enqueue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ORCH_KEY, 'queue'] });
    },
  });
}
