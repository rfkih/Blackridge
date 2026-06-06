'use client';

import { useQuery } from '@tanstack/react-query';
import { getEarnPosition, type EarnPosition } from '@/lib/api/earn';

/**
 * Live USDT-in-Earn position for a HEDGING account. Polls every 60s — Earn
 * balances move only on the strategy's flat↔long transitions (slow daily
 * strategy), so a minute cadence is plenty. Disabled until an accountId exists.
 */
export function useEarnPosition(accountId: string | undefined) {
  return useQuery<EarnPosition>({
    queryKey: ['earn-position', accountId],
    queryFn: () => getEarnPosition(accountId),
    enabled: !!accountId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
