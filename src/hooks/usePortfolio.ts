'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';
import { useActiveAccount } from '@/hooks/useAccounts';

const PORTFOLIO_REFRESH_MS = 30_000;

const PORTFOLIO_STALE_MS = PORTFOLIO_REFRESH_MS - 5_000;

/**
 * Reads the portfolio balance.
 *
 * Without an argument it scopes to the active account context
 * (`useActiveAccount().scopedAccountId`) — the behaviour every existing caller
 * relies on, byte-for-byte. Pass an explicit `accountId` to scope to a specific
 * account regardless of the active selection (used by `useAllocation`, which is
 * account-scoped rather than active-scoped). An explicit id also makes the
 * query independent of active-account resolution, so it isn't gated on
 * `accountsLoading`.
 */
export function usePortfolio(accountId?: string) {
  const { scopedAccountId, isLoading: accountsLoading } = useActiveAccount();

  const effectiveAccountId = accountId ?? scopedAccountId;
  const enabled = accountId !== undefined || !accountsLoading;

  return useQuery({
    queryKey: ['portfolio', effectiveAccountId ?? 'all'],
    queryFn: () => getPortfolioBalance(effectiveAccountId),
    staleTime: PORTFOLIO_STALE_MS,
    refetchInterval: PORTFOLIO_REFRESH_MS,
    refetchIntervalInBackground: false,

    enabled,
  });
}
