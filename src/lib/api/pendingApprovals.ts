import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import type {
  ApproveRequest,
  DismissRequest,
  GateCheck,
  PendingApproval,
  PendingApprovalStatus,
  Replication,
  ReplicateRequest,
  ReplicateResponseDto,
} from '@/types/pendingApproval';

/**
 * Jackson emits BigDecimal-origin numbers as number-OR-string, so the curator's
 * evidence/gate-check numerics can arrive as strings. The consumers call
 * `.toFixed()` and do numeric comparisons on them, which throws / silently
 * mis-compares on a string. Re-coerce every numeric leaf at the boundary, like
 * every other JVM client module does.
 */
function coerceGateCheck(g: GateCheck): GateCheck {
  return {
    threshold: toNum(g.threshold),
    actual: toNum(g.actual),
    passed: g.passed,
    gap: toNum(g.gap),
  };
}

function coerceReplication(r: Replication): Replication {
  const m = r.metricsSummary;
  return {
    ...r,
    metricsSummary: m
      ? {
          ag90: toNumOrNull(m.ag90) ?? undefined,
          n_trades: toNumOrNull(m.n_trades) ?? undefined,
          psr: toNumOrNull(m.psr) ?? undefined,
          profit_factor: toNumOrNull(m.profit_factor) ?? undefined,
        }
      : null,
  };
}

function coercePendingApproval(a: PendingApproval): PendingApproval {
  return {
    ...a,
    gateCheck: {
      cagr: coerceGateCheck(a.gateCheck.cagr),
      capital: a.gateCheck.capital ? coerceGateCheck(a.gateCheck.capital) : undefined,
      window: coerceGateCheck(a.gateCheck.window),
      trades: coerceGateCheck(a.gateCheck.trades),
    },
    evidenceSummary: {
      ...a.evidenceSummary,
      ag90: toNum(a.evidenceSummary.ag90),
      dsr: toNum(a.evidenceSummary.dsr),
      n_trades: toNum(a.evidenceSummary.n_trades),
      pf_lo: toNum(a.evidenceSummary.pf_lo),
    },
    replications: (a.replications ?? []).map(coerceReplication),
  };
}

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
  return (data ?? []).map(coercePendingApproval);
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
