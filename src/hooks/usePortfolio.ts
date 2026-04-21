'use client';

import { useQuery } from '@tanstack/react-query';
import { getPortfolioBalance } from '@/lib/api/portfolio';
import { QUERY_STALE_TIMES } from '@/lib/constants';

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolioBalance,
    staleTime: QUERY_STALE_TIMES.portfolio,
  });
}
