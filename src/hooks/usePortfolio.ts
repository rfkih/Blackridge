'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';

const PORTFOLIO_REFRESH_MS = 30_000;

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolioBalance,
    // staleTime matches the refresh cadence so a background refetch kicks in
    // whenever the 30s poll fires instead of returning a cached snapshot.
    staleTime: PORTFOLIO_REFRESH_MS,
    refetchInterval: PORTFOLIO_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}
