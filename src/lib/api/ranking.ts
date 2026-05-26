import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { StrategyRankingResponse } from '@/types/ranking';

const ORCH = '/api/v1/research-orch';

async function fetchStrategyRanking(minDays: number, limit: number): Promise<StrategyRankingResponse> {
  const { data } = await apiClient.get<StrategyRankingResponse>(`${ORCH}/strategy-ranking`, {
    params: { min_days: minDays, limit },
  });
  return data;
}

export function useStrategyRanking(minDays = 365, limit = 50) {
  return useQuery({
    queryKey: ['strategy-ranking', minDays, limit] as const,
    queryFn: () => fetchStrategyRanking(minDays, limit),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
