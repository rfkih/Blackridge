'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccountStrategies } from '@/lib/api/strategies';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';

export function useStrategies() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['strategies', userId ?? null],
    queryFn: () => getAccountStrategies(userId),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(userId),
  });
}
