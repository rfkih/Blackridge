'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  getAccountStrategies,
  getAccountStrategyById,
  createAccountStrategy,
  deleteAccountStrategy,
  activateAccountStrategy,
  type CreateAccountStrategyPayload,
} from '@/lib/api/strategies';
import {
  getLsrParams,
  getLsrDefaults,
  patchLsrParams,
  putLsrParams,
  deleteLsrParams,
} from '@/lib/api/lsr-params';
import {
  getVcbParams,
  getVcbDefaults,
  patchVcbParams,
  putVcbParams,
  deleteVcbParams,
} from '@/lib/api/vcb-params';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import type { LsrParams, VcbParams } from '@/types/strategy';

export function useStrategies() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['strategies', userId ?? null],
    queryFn: () => getAccountStrategies(userId),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(userId),
  });
}

export const useAccountStrategies = useStrategies;

export function useAccountStrategy(id: string | undefined) {
  return useQuery({
    queryKey: ['strategy', id],
    queryFn: () => getAccountStrategyById(id as string),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(id),
  });
}

export function useLsrDefaults() {
  return useQuery({
    queryKey: ['lsr-params', 'defaults'],
    queryFn: getLsrDefaults,
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

export function useVcbDefaults() {
  return useQuery({
    queryKey: ['vcb-params', 'defaults'],
    queryFn: getVcbDefaults,
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

export function useLsrParams(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['lsr-params', accountStrategyId],
    queryFn: () => getLsrParams(accountStrategyId as string),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(accountStrategyId),
  });
}

export function useVcbParams(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['vcb-params', accountStrategyId],
    queryFn: () => getVcbParams(accountStrategyId as string),
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(accountStrategyId),
  });
}

export function useSaveLsrParams(
  accountStrategyId: string | undefined,
): UseMutationResult<LsrParams, Error, Partial<LsrParams>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LsrParams>) => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return patchLsrParams(accountStrategyId, patch);
    },
    onSuccess: (params) => {
      queryClient.setQueryData(['lsr-params', accountStrategyId], params);
      queryClient.invalidateQueries({ queryKey: ['lsr-params', accountStrategyId] });
    },
  });
}

export function useReplaceLsrParams(accountStrategyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (full: LsrParams) => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return putLsrParams(accountStrategyId, full);
    },
    onSuccess: (params) => {
      queryClient.setQueryData(['lsr-params', accountStrategyId], params);
      queryClient.invalidateQueries({ queryKey: ['lsr-params', accountStrategyId] });
    },
  });
}

export function useSaveVcbParams(
  accountStrategyId: string | undefined,
): UseMutationResult<VcbParams, Error, Partial<VcbParams>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<VcbParams>) => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return patchVcbParams(accountStrategyId, patch);
    },
    onSuccess: (params) => {
      queryClient.setQueryData(['vcb-params', accountStrategyId], params);
      queryClient.invalidateQueries({ queryKey: ['vcb-params', accountStrategyId] });
    },
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAccountStrategyPayload) => createAccountStrategy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountStrategyId: string) => deleteAccountStrategy(accountStrategyId),
    onSuccess: (_, accountStrategyId) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.removeQueries({ queryKey: ['strategy', accountStrategyId] });
    },
  });
}

/**
 * Flip a preset to the active one for its (account, strategy, symbol, interval).
 * The backend atomically deactivates any sibling that's currently enabled.
 * Refetches the full strategies list so group headers rerender correctly.
 */
export function useActivateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountStrategyId: string) => activateAccountStrategy(accountStrategyId),
    onSuccess: (strategy) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.setQueryData(['strategy', strategy.id], strategy);
    },
  });
}

/**
 * Wipes all LSR overrides on an account-strategy row. Backend responds
 * with the row cleared — on success we invalidate the per-strategy query
 * so the form re-fetches a clean `effectiveParams` that collapses to
 * pure defaults.
 */
export function useResetLsrParams(accountStrategyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return deleteLsrParams(accountStrategyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lsr-params', accountStrategyId] });
    },
  });
}

/** Wipes all VCB overrides on an account-strategy row. See `useResetLsrParams`. */
export function useResetVcbParams(accountStrategyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return deleteVcbParams(accountStrategyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vcb-params', accountStrategyId] });
    },
  });
}

export function useReplaceVcbParams(accountStrategyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (full: VcbParams) => {
      if (!accountStrategyId) throw new Error('accountStrategyId is required');
      return putVcbParams(accountStrategyId, full);
    },
    onSuccess: (params) => {
      queryClient.setQueryData(['vcb-params', accountStrategyId], params);
      queryClient.invalidateQueries({ queryKey: ['vcb-params', accountStrategyId] });
    },
  });
}
