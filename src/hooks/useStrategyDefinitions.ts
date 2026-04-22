'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStrategyDefinition,
  deprecateStrategyDefinition,
  listStrategyDefinitions,
  updateStrategyDefinition,
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
