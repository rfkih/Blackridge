'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  computeAssetRebalancePlan,
  executeRebalance,
  fetchAssetPolicy,
  fetchAssetTargets,
  fetchRebalanceById,
  updateAssetPolicy,
  upsertAssetTargets,
} from '@/lib/api/assetAllocation';
import type {
  AssetAllocationTarget,
  AssetRebalanceHistoryView,
  AssetRebalancePlan,
  AssetRebalancePolicy,
  UpdateAssetPolicyRequest,
  UpsertAssetTargetsRequest,
} from '@/types/assetAllocation';

const QK_TARGETS = (accountId: string | undefined) => ['asset-allocation', 'targets', accountId];
const QK_POLICY = (accountId: string | undefined) => ['asset-allocation', 'policy', accountId];

export function useAssetTargets(accountId: string | undefined) {
  return useQuery<AssetAllocationTarget[]>({
    queryKey: QK_TARGETS(accountId),
    queryFn: () => fetchAssetTargets(accountId!),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });
}

export function useUpsertAssetTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertAssetTargetsRequest) => upsertAssetTargets(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: QK_TARGETS(variables.accountId) });
    },
  });
}

export function useAssetPolicy(accountId: string | undefined) {
  return useQuery<AssetRebalancePolicy>({
    queryKey: QK_POLICY(accountId),
    queryFn: () => fetchAssetPolicy(accountId!),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });
}

export function useUpdateAssetPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAssetPolicyRequest) => updateAssetPolicy(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: QK_POLICY(variables.accountId) });
    },
  });
}

/**
 * Plan generation is on-demand only — there's no `useQuery` polling. The user
 * clicks "Generate plan" and gets one shot. `persist=false` returns the dry-run
 * shape; `persist=true` also writes an audit row.
 */
export function useComputeAssetRebalancePlan() {
  return useMutation<AssetRebalancePlan, Error, { accountId: string; persist: boolean }>({
    mutationFn: ({ accountId, persist }) => computeAssetRebalancePlan(accountId, persist),
  });
}

/**
 * Phase 4 — submit a PROPOSED plan for execution. The backend's executor is
 * synchronous (waits for every Binance leg to return before responding), so
 * this mutation resolves with the final terminal-state view.
 */
export function useExecuteRebalance() {
  return useMutation<AssetRebalanceHistoryView, Error, { rebalanceId: string }>({
    mutationFn: ({ rebalanceId }) => executeRebalance(rebalanceId),
  });
}

/**
 * Polls a rebalance row by id. Enabled only when a rebalanceId is set and
 * the current status is non-terminal (EXECUTING). Used as a belt-and-braces
 * fallback if the executor request times out client-side.
 */
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'SKIP_WITHIN_BAND',
  'SKIP_CALENDAR_FLOOR',
  'SKIP_DISABLED',
  'SKIP_NO_TARGETS',
  'SKIP_USDT_FLOOR_INFEASIBLE',
]);

export function useRebalancePoll(
  rebalanceId: string | undefined,
  currentStatus: string | undefined,
) {
  const isTerminal = currentStatus ? TERMINAL_STATUSES.has(currentStatus) : false;
  return useQuery<AssetRebalanceHistoryView>({
    queryKey: ['asset-allocation', 'rebalance', rebalanceId],
    queryFn: () => fetchRebalanceById(rebalanceId!),
    enabled: Boolean(rebalanceId) && !isTerminal,
    refetchInterval: !isTerminal ? 2_000 : false,
  });
}
