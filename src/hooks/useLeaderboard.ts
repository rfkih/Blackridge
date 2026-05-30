'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deployStrategy, getTopStrategies } from '@/lib/api/leaderboard';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { DeployStrategyPayload } from '@/types/leaderboard';

const LEADERBOARD_KEY = ['leaderboard', 'top-strategies'] as const;

/**
 * Ranked top-strategies query. Keyed by `limit` so the page's 5/10/25 picker
 * caches each size independently. Shares the 60s strategy-params staleTime —
 * the leaderboard reads the same approval evidence and shouldn't drift faster.
 */
export function useTopStrategies(limit = 10) {
  return useQuery({
    queryKey: [...LEADERBOARD_KEY, limit] as const,
    queryFn: () => getTopStrategies(limit),
    staleTime: QUERY_STALE_TIMES.strategyParams,
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
