'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateStrategyParam,
  createStrategyParam,
  deactivateStrategyParam,
  deleteStrategyParam,
  listStrategyParams,
  updateStrategyParam,
} from '@/lib/api/strategy-params';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type {
  StrategyParamCreateRequest,
  StrategyParamUpdateRequest,
} from '@/types/strategy';

const presetsKey = (accountStrategyId: string | undefined) =>
  ['strategy-params', accountStrategyId ?? null] as const;

/**
 * Lists non-deleted saved presets for one account_strategy. Hidden behind a
 * deliberately additive UI — the existing live edit forms keep targeting
 * `/api/v1/{lsr,vcb,vbo}-params/:id` and are not touched by this hook.
 */
export function useStrategyParamPresets(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: presetsKey(accountStrategyId),
    queryFn: () => listStrategyParams(accountStrategyId as string),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(accountStrategyId),
  });
}

/**
 * Common invalidation: any mutation that flips the active preset also drifts
 * the legacy params caches (`['lsr-params', id]` etc.) since those reflect the
 * active row's contents.
 */
function useInvalidatePresets(accountStrategyId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: presetsKey(accountStrategyId) });
    if (accountStrategyId) {
      qc.invalidateQueries({ queryKey: ['lsr-params', accountStrategyId] });
      qc.invalidateQueries({ queryKey: ['vcb-params', accountStrategyId] });
      qc.invalidateQueries({ queryKey: ['vbo-params', accountStrategyId] });
    }
  };
}

export function useCreateStrategyParam(accountStrategyId: string | undefined) {
  const invalidate = useInvalidatePresets(accountStrategyId);
  return useMutation({
    mutationFn: (request: StrategyParamCreateRequest) => createStrategyParam(request),
    onSuccess: invalidate,
  });
}

export function useUpdateStrategyParam(accountStrategyId: string | undefined) {
  const invalidate = useInvalidatePresets(accountStrategyId);
  return useMutation({
    mutationFn: ({ paramId, request }: { paramId: string; request: StrategyParamUpdateRequest }) =>
      updateStrategyParam(paramId, request),
    onSuccess: invalidate,
  });
}

export function useActivateStrategyParam(accountStrategyId: string | undefined) {
  const invalidate = useInvalidatePresets(accountStrategyId);
  return useMutation({
    mutationFn: (paramId: string) => activateStrategyParam(paramId),
    onSuccess: invalidate,
  });
}

export function useDeactivateStrategyParam(accountStrategyId: string | undefined) {
  const invalidate = useInvalidatePresets(accountStrategyId);
  return useMutation({
    mutationFn: (paramId: string) => deactivateStrategyParam(paramId),
    onSuccess: invalidate,
  });
}

export function useDeleteStrategyParam(accountStrategyId: string | undefined) {
  const invalidate = useInvalidatePresets(accountStrategyId);
  return useMutation({
    mutationFn: (paramId: string) => deleteStrategyParam(paramId),
    onSuccess: invalidate,
  });
}
