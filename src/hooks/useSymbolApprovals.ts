'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attachEvidence,
  createApproval,
  listAdminApprovals,
  listPublicApprovals,
  revokeApproval,
} from '@/lib/api/symbolApprovals';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type {
  AttachEvidenceRequest,
  CreateSymbolApprovalRequest,
  RevokeApprovalRequest,
} from '@/types/symbolApproval';

const PUBLIC_KEY = ['symbol-approvals', 'public'] as const;
const ADMIN_KEY = ['symbol-approvals', 'admin'] as const;

/**
 * Public picker hook — drives the `/strategies` New Strategy dialog and any
 * other gate asking "is this (symbol, code) pair approved?". Same 60s
 * staleTime as the strategy-definitions cache so the two don't drift.
 */
export function useSymbolApprovals() {
  return useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: listPublicApprovals,
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

/**
 * Admin list with audit fields + staleness flag. Keyed by `includeRevoked`
 * so the "show revoked" toggle caches independently.
 */
export function useAdminSymbolApprovals(includeRevoked = false) {
  return useQuery({
    queryKey: [...ADMIN_KEY, { includeRevoked }] as const,
    queryFn: () => listAdminApprovals(includeRevoked),
    staleTime: QUERY_STALE_TIMES.strategyParams,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['symbol-approvals'] });
}

export function useCreateSymbolApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSymbolApprovalRequest) => createApproval(payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useAttachEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AttachEvidenceRequest }) =>
      attachEvidence(id, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRevokeSymbolApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RevokeApprovalRequest }) =>
      revokeApproval(id, payload),
    onSuccess: () => invalidateAll(queryClient),
  });
}
