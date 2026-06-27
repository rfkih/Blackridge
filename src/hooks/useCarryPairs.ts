'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeCarryPair,
  executeCarryDeploy,
  getCarryBalance,
  getCarryConfig,
  getCarryPairs,
  getOpenableCarry,
  openCarryPair,
  planCarryDeploy,
  saveCarryConfig,
} from '@/lib/api/carry';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { OpenCarryPairRequest, SaveCarryConfigRequest } from '@/types/trading';

/**
 * The authenticated user's carry book. Live-ish (mark + MTM recomputed server-side
 * per fetch) so it uses the open-positions stale time and keeps the previous page
 * while refetching to avoid table flicker.
 */
export function useCarryPairs() {
  return useQuery({
    queryKey: ['carry', 'pairs'],
    queryFn: getCarryPairs,
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: 30_000, // keep the live mark / MTM fresh while the tab is open
    placeholderData: (prev) => prev,
  });
}

/** Consolidated carry capital (spot+futures split + per-pair legs) for one account.
 *  Disabled until an account is selected. Polls like the book so the split stays live. */
export function useCarryBalance(accountId: string | undefined) {
  return useQuery({
    queryKey: ['carry', 'balance', accountId],
    queryFn: () => getCarryBalance(accountId as string),
    enabled: !!accountId,
    staleTime: QUERY_STALE_TIMES.openPositions,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Openable FCARRY strategies + the server leverage cap, for the "open a pair" dialog. */
export function useOpenableCarry() {
  return useQuery({
    queryKey: ['carry', 'openable'],
    queryFn: getOpenableCarry,
    staleTime: QUERY_STALE_TIMES.openPositions,
  });
}

/** Open a carry pair, then refresh the book + the openable roster (open flag may flip). */
export function useOpenCarryPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: OpenCarryPairRequest) => openCarryPair(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carry', 'pairs'] });
      queryClient.invalidateQueries({ queryKey: ['carry', 'openable'] });
    },
  });
}

/** Close (unwind) a carry pair, then refresh the book + the openable roster. */
export function useCloseCarryPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carryPairId: string) => closeCarryPair(carryPairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carry', 'pairs'] });
      queryClient.invalidateQueries({ queryKey: ['carry', 'openable'] });
    },
  });
}

/** The account's carry activation config (enable + allocation + default leverage). */
export function useCarryConfig(accountId: string | undefined) {
  return useQuery({
    queryKey: ['carry', 'config', accountId ?? null],
    queryFn: () => getCarryConfig(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });
}

/** Save the account's carry activation config, then refresh it. */
export function useSaveCarryConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, req }: { accountId: string; req: SaveCarryConfigRequest }) =>
      saveCarryConfig(accountId, req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['carry', 'config', variables.accountId] });
    },
  });
}

/** Dry-run the carry deploy (on demand) — what filling the allocation would open. No orders. */
export function usePlanCarryDeploy() {
  return useMutation({
    mutationFn: (accountId: string) => planCarryDeploy(accountId),
  });
}

/** Execute the carry deploy, then refresh the book + openable roster + config. */
export function useExecuteCarryDeploy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => executeCarryDeploy(accountId),
    onSuccess: (_data, accountId) => {
      queryClient.invalidateQueries({ queryKey: ['carry', 'pairs'] });
      queryClient.invalidateQueries({ queryKey: ['carry', 'openable'] });
      queryClient.invalidateQueries({ queryKey: ['carry', 'config', accountId] });
    },
  });
}
