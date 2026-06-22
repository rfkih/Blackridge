'use client';

import { useQuery } from '@tanstack/react-query';
import { getCarryPairs } from '@/lib/api/carry';
import { QUERY_STALE_TIMES } from '@/lib/constants';

/**
 * The authenticated user's carry book. Live-ish (mark + MTM recomputed server-side
 * per fetch) so it uses the open-positions stale time and keeps the previous page
 * while refetching to avoid table flicker.
 */
export function useCarryPairs() {
  return useQuery({
    queryKey: ['carry', 'pairs'],
    queryFn: getCarryPairs,
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: 30_000, // keep the live mark / MTM fresh while the tab is open
    placeholderData: (prev) => prev,
  });
}
