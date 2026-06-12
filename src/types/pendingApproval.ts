/**
 * Wire shapes for the pending-approval inbox (Trading JVM V114, PR #1).
 *
 * Backend DTOs:
 *   PendingApprovalResponse.java -> PendingApproval
 *   ReplicationResponse.java     -> Replication
 *   CreatePendingApprovalRequest -> not built client-side (curator writes it)
 *   ApprovePendingApprovalRequest, DismissPendingApprovalRequest,
 *   ReplicatePendingApprovalRequest -> mutation request shapes
 *
 * Curator-emitted rows arrive via the orchestrator's Path C contract
 * (PR #2). Admin actions:
 *   - Replicate -> queues a backtest re-run with same effectiveParams
 *   - Approve   -> delegates to V102 ApprovalGateService server-side
 *   - Dismiss   -> records reason, status -> DISMISSED
 *
 * REJECT verdicts NEVER appear here (curator skips inbox write on REJECT;
 * the V114 CHECK constraint also restricts verdict to PROMOTE/HOLD).
 */

export type PendingApprovalStatus = 'PENDING' | 'APPROVED' | 'DISMISSED' | 'SUPERSEDED';
export type PendingApprovalVerdict = 'PROMOTE' | 'HOLD';
export type ReplicationStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Severity literal pinned by the curator prompt (PR #2 Fix E). The frontend
 * renders badges based on this -- only "CONCERN" is currently emitted;
 * future hard-veto sources surface as curator REJECT (no inbox row).
 */
export type ConcernSeverity = 'CONCERN';

export interface Concern {
  source: string; // e.g. "quant-skeptic", "quant-ml-judge"
  severity: ConcernSeverity;
  message: string;
}

/**
 * V102 gate-check shape; mirrors ApprovalGateService output and the
 * curator's Lens C computation. Each entry is one threshold check.
 */
export interface GateCheck {
  threshold: number;
  actual: number;
  passed: boolean;
  /** (threshold - actual) / threshold; 0 if passed, >0 on miss. */
  gap: number;
}

export interface GateCheckBundle {
  cagr: GateCheck;
  /** Optional — V120 removed the capital gate (min_initial_capital_usd set to 0). */
  capital?: GateCheck;
  window: GateCheck;
  trades: GateCheck;
}

/** Headline metrics the reconciler denormalizes onto COMPLETED replications. */
export interface ReplicationMetricsSummary {
  ag90?: number;
  n_trades?: number;
  psr?: number;
  profit_factor?: number;
}

export interface Replication {
  backtestRunId: string;
  requestedAt: string | null; // ISO LocalDateTime; null only for malformed legacy entries
  requestedBy: string | null;
  status: ReplicationStatus;
  metricsSummary: ReplicationMetricsSummary | null;
  error: string | null;
}

/** Evidence summary written by the curator from the cited backtest. */
export interface EvidenceSummary {
  ag90: number;
  dsr: number;
  n_trades: number;
  pf_lo: number;
  wf_stability: string; // "ROBUST" | "MARGINAL" | "FAIL"
}

/**
 * Loose record for the frozen effective_params_snapshot (V104 reproducibility).
 * Key set is strategy-specific; we render generically with parameter-prefix grouping.
 */
export type EffectiveParams = Record<
  string,
  string | number | boolean | null | Record<string, unknown>
>;

export interface PendingApproval {
  id: string;
  symbol: string;
  strategyCode: string;
  interval: string;
  iterationId: string;
  backtestRunId: string;
  verdict: PendingApprovalVerdict;
  concerns: Concern[];
  gateCheck: GateCheckBundle;
  evidenceSummary: EvidenceSummary;
  effectiveParams: EffectiveParams;
  replications: Replication[];
  agentDecisionId: string | null;
  status: PendingApprovalStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedReason: string | null;
  resultingApprovalId: string | null;
  createdTime: string;
  createdBy: string | null;
}

/**
 * Actor identity comes from the JWT server-side and must NOT be in the body —
 * the backend DTOs reject unknown fields (strict Jackson), so sending `actor`
 * 400s. Replicate takes an empty JSON object.
 */
export type ReplicateRequest = Record<string, never>;

export interface ReplicateResponseDto {
  backtestRunId: string;
  replicationIndex: number;
  /** True when an existing QUEUED/RUNNING entry was returned instead of re-queuing. */
  reused: boolean;
}

export interface ApproveRequest {
  citedBacktestRunId?: string; // defaults to original backtestRunId when omitted
}

export interface DismissRequest {
  reason: string; // min length 8 (backend @Size(min=8))
}
