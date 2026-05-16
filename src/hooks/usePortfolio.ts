'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';
import { useActiveAccount } from '@/hooks/useAccounts';

const PORTFOLIO_REFRESH_MS = 30_000;

const PORTFOLIO_STALE_MS = PORTFOLIO_REFRESH_MS - 5_000;

export function usePortfolio() {
  const { scopedAccountId, isLoading: accountsLoading } = useActiveAccount();

  return useQuery({
    queryKey: ['portfolio', scopedAccountId ?? 'all'],
    queryFn: () => getPortfolioBalance(scopedAccountId),
    staleTime: PORTFOLIO_STALE_MS,
    refetchInterval: PORTFOLIO_REFRESH_MS,
    refetchIntervalInBackground: false,

    enabled: !accountsLoading,
  });
}
