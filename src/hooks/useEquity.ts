import { useQuery } from '@tanstack/react-query';
import { getEquityPositions, getEquityOrders } from '@/lib/api/equityService';
import type { EquityProfile } from '@/types/equity';

export function useEquityPositions(profile: EquityProfile = 'PAPER') {
  return useQuery({
    queryKey: ['equity', 'positions', profile],
    queryFn: () => getEquityPositions(profile),
    staleTime: 15_000,
    retry: false,
  });
}

export function useEquityOrders(profile: EquityProfile = 'PAPER', asOfDate?: string) {
  return useQuery({
    queryKey: ['equity', 'orders', profile, asOfDate ?? null],
    queryFn: () => getEquityOrders(profile, asOfDate),
    staleTime: 15_000,
    retry: false,
  });
}
