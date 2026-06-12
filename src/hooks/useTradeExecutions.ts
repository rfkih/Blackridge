'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getExecutions,
  getExecutionSummary,
  type ExecutionFilters,
} from '@/lib/api/tradeExecutions';
import { QUERY_STALE_TIMES } from '@/lib/constants';

export function useExecutionsList(filters: ExecutionFilters) {
  return useQuery({
    queryKey: [
      'executions',
      'list',
      filters.status ?? 'FAILED',
      filters.symbol ?? null,
      filters.strategyName ?? null,
      filters.executionType ?? null,
      filters.failureCategory ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.accountId ?? null,
      filters.page ?? 0,
      filters.size ?? 20,
    ],
    queryFn: () => getExecutions(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
    // Carry data across page/filter flips but not account switches —
    // queryKey[8] is accountId (see key above).
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[8] === (filters.accountId ?? null) ? prev : undefined,
  });
}

export function useExecutionSummary(
  filters: Omit<ExecutionFilters, 'status' | 'failureCategory' | 'page' | 'size'>,
) {
  return useQuery({
    queryKey: [
      'executions',
      'summary',
      filters.symbol ?? null,
      filters.strategyName ?? null,
      filters.executionType ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.accountId ?? null,
    ],
    queryFn: () => getExecutionSummary(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
    // Same account guard as useExecutionsList — queryKey[6] is accountId.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[6] === (filters.accountId ?? null) ? prev : undefined,
  });
}
