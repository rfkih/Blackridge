'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listThresholds, upsertThreshold } from '@/lib/api/symbolApprovals';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { UpdateApprovalThresholdRequest } from '@/types/symbolApproval';

const QUERY_KEY = ['symbol-approvals', 'thresholds'] as const;

/**
 * Per-symbol approval thresholds. Admin-only on the wire but the hook is
 * harmless to call from non-admin pages — it'll just 403 and stay empty.
 */
export function useApprovalThresholds() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: listThresholds,
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

export function useUpsertApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      symbol,
      payload,
    }: {
      symbol: string;
      payload: UpdateApprovalThresholdRequest;
    }) => upsertThreshold(symbol, payload),
    onSuccess: () => {
      // Threshold changes can flip rows to stale, so invalidate the
      // approval lists too — not just the threshold cache.
      queryClient.invalidateQueries({ queryKey: ['symbol-approvals'] });
    },
  });
}
