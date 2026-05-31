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
 * Slow background poll kept ON even when the WebSocket is connected. The WS only
 * pushes on approval lifecycle events; ranking-affecting changes the board reads
 * from the materialized snapshot — nightly recompute, walk-forward / live-drift
 * updates (V134) — emit no WS frame. Without a background poll a healthy socket
 * could leave the board stale indefinitely. 2 min is cheap belt-and-suspenders.
 */
const LEADERBOARD_BACKGROUND_POLL_MS = 120_000;

/**
 * Ranked top-strategies query. Keyed by `limit` so the page's 5/10/25 picker
 * caches each size independently. Shares the 60s strategy-params staleTime —
 * the leaderboard reads the same approval evidence and shouldn't drift faster.
 *
 * useLeaderboardStream still drives instant invalidation on approval events when
 * the WebSocket is up; the poll is the freshness floor for everything the WS
 * can't see — fast (30 s) when the socket is down, slow (2 min) when it's up.
 */
export function useTopStrategies(limit = 10, accountId?: string) {
  const wsConnected = useWsStore((s) => s.connected);
  return useQuery({
    // accountId is part of the key — corr-to-book is account-specific.
    queryKey: [...LEADERBOARD_KEY, limit, accountId ?? null] as const,
    queryFn: () => getTopStrategies(limit, accountId),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    refetchInterval: wsConnected ? LEADERBOARD_BACKGROUND_POLL_MS : LEADERBOARD_POLL_INTERVAL_MS,
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
