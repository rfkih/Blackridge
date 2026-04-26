'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';
import { useActiveAccount } from '@/hooks/useAccounts';

const PORTFOLIO_REFRESH_MS = 30_000;
// Keep staleTime strictly less than the poll interval. If they match, a
// component that mounts in the same tick a background refetch settles sees
// fresh → stale in one render and fires an extra fetch it didn't need.
const PORTFOLIO_STALE_MS = PORTFOLIO_REFRESH_MS - 5_000;

export function usePortfolio() {
  // Follow the sidebar account switcher: a concrete id scopes the balance to
  // one account, `undefined` (the "All accounts" selection) lets the backend
  // aggregate across every account the user owns.
  const { scopedAccountId, isLoading: accountsLoading } = useActiveAccount();

  return useQuery({
    queryKey: ['portfolio', scopedAccountId ?? 'all'],
    queryFn: () => getPortfolioBalance(scopedAccountId),
    staleTime: PORTFOLIO_STALE_MS,
    refetchInterval: PORTFOLIO_REFRESH_MS,
    refetchIntervalInBackground: false,
    // Don't fire while the account list is still loading — otherwise we'd
    // briefly request the aggregate, then re-request the scoped view a tick
    // later when the persisted selection hydrates.
    enabled: !accountsLoading,
  });
}
