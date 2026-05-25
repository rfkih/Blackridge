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
 */
export function usePendingApprovals(params: ListPendingApprovalsParams = {}) {
  // Normalize the params object so the queryKey is stable across renders
  // even if the caller passes a fresh literal each time.
  const normalized: ListPendingApprovalsParams = {
    status: params.status ?? 'PENDING',
    symbol: params.symbol ?? undefined,
  };
  return useQuery({
    queryKey: listKey(normalized),
    queryFn: () => listPendingApprovals(normalized),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  // Approve also writes a V102 row -- bust that cache too so the
  // SymbolApprovalsSection on the same page picks up the new approval
  // without a manual refresh.
  queryClient.invalidateQueries({ queryKey: ['symbol-approvals'] });
}

export function useReplicatePendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ReplicateRequest }) =>
      replicatePendingApproval(id, request),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useApprovePendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ApproveRequest }) =>
      approvePendingApproval(id, request),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDismissPendingApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: DismissRequest }) =>
      dismissPendingApproval(id, request),
    onSuccess: () => invalidateAll(queryClient),
  });
}

// Re-export the PendingApprovalStatus type so consumers don't need to
// import from two places when picking a status filter.
export type { PendingApprovalStatus };
