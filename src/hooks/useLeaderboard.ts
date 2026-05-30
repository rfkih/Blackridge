'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deployStrategy, getTopStrategies } from '@/lib/api/leaderboard';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useWsStore } from '@/store/wsStore';
import type { DeployStrategyPayload } from '@/types/leaderboard';

const LEADERBOARD_KEY = ['leaderboard', 'top-strategies'] as const;

/** Poll every 30 s when the WebSocket push is unavailable. */
const LEADERBOARD_POLL_INTERVAL_MS = 30_000;

/**
 * Ranked top-strategies query. Keyed by `limit` so the page's 5/10/25 picker
 * caches each size independently. Shares the 60s strategy-params staleTime —
 * the leaderboard reads the same approval evidence and shouldn't drift faster.
 *
 * When the WebSocket is connected, useLeaderboardStream drives invalidation on
 * every approval event and polling is disabled. When the WebSocket is down,
 * falls back to a 30-second poll so the board doesn't go stale indefinitely.
 */
export function useTopStrategies(limit = 10) {
  const wsConnected = useWsStore((s) => s.connected);
  return useQuery({
    queryKey: [...LEADERBOARD_KEY, limit] as const,
    queryFn: () => getTopStrategies(limit),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    refetchInterval: wsConnected ? false : LEADERBOARD_POLL_INTERVAL_MS,
  });
}

/**
 * One-click deploy mutation. On success the new LIVE preset must show up on
 * the user's `/strategies` page, so we invalidate that query. The caller owns
 * the success toast + deep-link (it needs the returned row's id).
 */
export function useDeployStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeployStrategyPayload) => deployStrategy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}
