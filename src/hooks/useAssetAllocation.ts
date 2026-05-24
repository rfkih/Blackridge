'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  computeAssetRebalancePlan,
  fetchAssetPolicy,
  fetchAssetTargets,
  updateAssetPolicy,
  upsertAssetTargets,
} from '@/lib/api/assetAllocation';
import type {
  AssetAllocationTarget,
  AssetRebalancePlan,
  AssetRebalancePolicy,
  UpdateAssetPolicyRequest,
  UpsertAssetTargetsRequest,
} from '@/types/assetAllocation';

const QK_TARGETS = (accountId: string | undefined) => ['asset-allocation', 'targets', accountId];
const QK_POLICY  = (accountId: string | undefined) => ['asset-allocation', 'policy', accountId];

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
