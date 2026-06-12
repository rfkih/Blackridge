'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStrategyDefinition,
  deprecateStrategyDefinition,
  listStrategyDefinitions,
  searchStrategyDefinitions,
  updateStrategyDefinition,
  type StrategyDefinitionsQuery,
} from '@/lib/api/strategy-definitions';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type {
  CreateStrategyDefinitionPayload,
  UpdateStrategyDefinitionPayload,
} from '@/types/strategyDefinition';

const QUERY_KEY = ['strategy-definitions'] as const;

export function useStrategyDefinitions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: listStrategyDefinitions,
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

/**
 * Filterable + paginated strategy definitions. Returns the Page envelope so
 * the /research promotion-candidates panel can render Prev/Next + sortable
 * column headers. Query key includes every filter so each filter combination
 * caches independently.
 */
export function useSearchStrategyDefinitions(q: StrategyDefinitionsQuery) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'search', q.query ?? '', q.sort ?? '', q.page ?? 0, q.size ?? 25],
    queryFn: () => searchStrategyDefinitions(q),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useCreateStrategyDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStrategyDefinitionPayload) => createStrategyDefinition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateStrategyDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStrategyDefinitionPayload }) =>
      updateStrategyDefinition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeprecateStrategyDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deprecateStrategyDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
