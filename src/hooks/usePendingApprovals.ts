'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePendingApproval,
  dismissPendingApproval,
  listPendingApprovals,
  replicatePendingApproval,
  type ListPendingApprovalsParams,
} from '@/lib/api/pendingApprovals';
import type {
  ApproveRequest,
  DismissRequest,
  PendingApprovalStatus,
  ReplicateRequest,
} from '@/types/pendingApproval';

const ROOT_KEY = ['pending-approvals'] as const;

function listKey(params: ListPendingApprovalsParams) {
  return [...ROOT_KEY, 'list', params] as const;
}

/**
 * Inbox list with built-in 30s polling. Cadence matches the backend
 * ReplicationReconciler (15s) x 2 so the UI never lags by more than one
 * cycle. Status filter defaults to PENDING because that's the admin's
 * active queue; pass status='APPROVED'|'DISMISSED'|'SUPERSEDED' to see
 * history (no UI for that in this PR -- backend supports it).
 *
 * Pass `options.pollingPaused = true` to suspend the 30s refetchInterval
 * and window-focus refetch while an admin is mid-interaction in a dialog.
 * This prevents the row being yanked out from under a Dismiss reason or an
 * Approve confirmation when the curator upserts the same row in-place.
 */
export function usePendingApprovals(
  params: ListPendingApprovalsParams = {},
  options: { pollingPaused?: boolean } = {},
) {
  // Normalize the params object so the queryKey is stable across renders
  // even if the caller passes a fresh literal each time.
  const normalized: ListPendingApprovalsParams = {
    status: params.status ?? 'PENDING',
    symbol: params.symbol ?? undefined,
  };
  return useQuery({
    queryKey: listKey(normalized),
    queryFn: () => listPendingApprovals(normalized),
    refetchInterval: options.pollingPaused ? false : 30_000,
    refetchOnWindowFocus: !options.pollingPaused,
  });
}

/** Invalidates only the pending-approvals cache (Replicate, Dismiss). */
function invalidatePending(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ROOT_KEY });
}

/**
 * Invalidates pending-approvals AND symbol-approvals (Approve only).
 * Approve creates a V102 row — bust that cache too so SymbolApprovalsSection
 * on the same page picks up the new approval without a manual refresh.
 */
function invalidatePendingAndSymbol(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  queryClient.invalidateQueries({ queryKey: ['symbol-approvals'] });
}

export function useReplicatePendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ReplicateRequest }) =>
      replicatePendingApproval(id, request),
    onSuccess: () => invalidatePending(queryClient),
  });
}

export function useApprovePendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ApproveRequest }) =>
      approvePendingApproval(id, request),
    onSuccess: () => invalidatePendingAndSymbol(queryClient),
  });
}

export function useDismissPendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: DismissRequest }) =>
      dismissPendingApproval(id, request),
    onSuccess: () => invalidatePending(queryClient),
  });
}

// Re-export the PendingApprovalStatus type so consumers don't need to
// import from two places when picking a status filter.
export type { PendingApprovalStatus };
