import { apiClient } from './client';
import type {
  ApproveRequest,
  DismissRequest,
  PendingApproval,
  PendingApprovalStatus,
  ReplicateRequest,
  ReplicateResponseDto,
} from '@/types/pendingApproval';

/**
 * Pending-approval inbox surface on the Trading JVM (V114).
 *
 * <p>All endpoints are `@PreAuthorize("hasRole('ADMIN')")` server-side and
 * `@Profile("!research")` (i.e. trading JVM only; research JVM rejects).
 *
 * <p>The curator agent writes rows via POST -- this module never POSTs
 * /admin/pending-approvals (curator-only). Admin actions are list,
 * replicate, approve, dismiss.
 *
 * <p>Status transitions are append-only: PENDING -> APPROVED|DISMISSED|
 * SUPERSEDED. The list endpoint accepts `?status=` to filter.
 */
const ADMIN = '/api/v1/admin/pending-approvals';

export interface ListPendingApprovalsParams {
  status?: PendingApprovalStatus;     // defaults to PENDING server-side
  symbol?: string;                    // optional filter
}

/**
 * Backend returns rows sorted by created_time DESC. No pagination -- the
 * partial-unique-index on (symbol, strategy_code) WHERE PENDING means
 * the active set is small (< 20 rows in practice).
 */
export async function listPendingApprovals(
  params: ListPendingApprovalsParams = {},
): Promise<PendingApproval[]> {
  const { data } = await apiClient.get<PendingApproval[]>(ADMIN, { params });
  return data;
}

/**
 * Queue a backtest replica with the row's frozen effectiveParams. Returns
 * `reused=true` if an existing QUEUED/RUNNING entry was returned instead
 * of submitting a new one.
 */
export async function replicatePendingApproval(
  id: string,
  request: ReplicateRequest,
): Promise<ReplicateResponseDto> {
  const { data } = await apiClient.post<ReplicateResponseDto>(
    `${ADMIN}/${id}/replicate`,
    request,
  );
  return data;
}

/**
 * Approve -> delegates to V102 SymbolStrategyApprovalService.create() with
 * the cited backtest run. The gate is re-run server-side. On 422 the body
 * carries the same {error, failedChecks} shape V102 uses; callers can read
 * `axios error.response?.data` for inline rendering.
 *
 * Omitting `citedBacktestRunId` defaults to the row's original
 * `backtestRunId`. Pass a replication's backtestRunId to cite a replicated
 * run instead -- backend validates it must equal original OR be in
 * `replications[]`.
 */
export async function approvePendingApproval(
  id: string,
  request: ApproveRequest,
): Promise<PendingApproval> {
  const { data } = await apiClient.post<PendingApproval>(
    `${ADMIN}/${id}/approve`,
    request,
  );
  return data;
}

export async function dismissPendingApproval(
  id: string,
  request: DismissRequest,
): Promise<PendingApproval> {
  const { data } = await apiClient.post<PendingApproval>(
    `${ADMIN}/${id}/dismiss`,
    request,
  );
  return data;
}
