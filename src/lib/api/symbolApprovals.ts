import { apiClient } from './client';
import type {
  AttachEvidenceRequest,
  CreateSymbolApprovalRequest,
  PublicSymbolApproval,
  RevokeApprovalRequest,
  SymbolApproval,
  SymbolApprovalThreshold,
  UpdateApprovalThresholdRequest,
} from '@/types/symbolApproval';

/**
 * Symbol-strategy approval surface on the Trading JVM (V102).
 *
 * <p>Replaces the deprecated `SUPPORTED_STRATEGIES_BY_SYMBOL` frontend
 * constant: the public picker reads {@link listPublicApprovals}; admin
 * CRUD is gated by `@PreAuthorize("hasRole('ADMIN')")` server-side.
 *
 * <p>422 responses to {@link createApproval} / {@link attachEvidence}
 * carry a structured `{error, failedChecks}` body — diverges from the
 * `ResponseDto` envelope so the dialog can render per-threshold deltas.
 * Callers catch the axios error and read `error.response?.data`.
 */
const PUBLIC = '/api/v1/symbol-approvals';
const ADMIN = '/api/v1/admin/symbol-approvals';

export async function listPublicApprovals(): Promise<PublicSymbolApproval[]> {
  const { data } = await apiClient.get<PublicSymbolApproval[]>(PUBLIC);
  return data;
}

export async function listAdminApprovals(includeRevoked = false): Promise<SymbolApproval[]> {
  const { data } = await apiClient.get<SymbolApproval[]>(ADMIN, {
    params: { includeRevoked },
  });
  return data;
}

export async function createApproval(
  request: CreateSymbolApprovalRequest,
): Promise<SymbolApproval> {
  const { data } = await apiClient.post<SymbolApproval>(ADMIN, request);
  return data;
}

export async function attachEvidence(
  id: string,
  request: AttachEvidenceRequest,
): Promise<SymbolApproval> {
  const { data } = await apiClient.patch<SymbolApproval>(
    `${ADMIN}/${id}/attach-evidence`,
    request,
  );
  return data;
}

export async function revokeApproval(
  id: string,
  request: RevokeApprovalRequest,
): Promise<SymbolApproval> {
  const { data } = await apiClient.post<SymbolApproval>(`${ADMIN}/${id}/revoke`, request);
  return data;
}

export async function listThresholds(): Promise<SymbolApprovalThreshold[]> {
  const { data } = await apiClient.get<SymbolApprovalThreshold[]>(`${ADMIN}/thresholds`);
  return data;
}

export async function upsertThreshold(
  symbol: string,
  request: UpdateApprovalThresholdRequest,
): Promise<SymbolApprovalThreshold> {
  const { data } = await apiClient.put<SymbolApprovalThreshold>(
    `${ADMIN}/thresholds/${encodeURIComponent(symbol)}`,
    request,
  );
  return data;
}
