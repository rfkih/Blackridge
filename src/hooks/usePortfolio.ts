'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';

const PORTFOLIO_REFRESH_MS = 30_000;
// Keep staleTime strictly less than the poll interval. If they match, a
// component that mounts in the same tick a background refetch settles sees
// fresh → stale in one render and fires an extra fetch it didn't need.
const PORTFOLIO_STALE_MS = PORTFOLIO_REFRESH_MS - 5_000;

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolioBalance,
    staleTime: PORTFOLIO_STALE_MS,
    refetchInterval: PORTFOLIO_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}
