/**
 * Wire shapes for the symbol-strategy approval surface (Trading JVM, V102).
 *
 * The public list ({@link PublicSymbolApproval}) replaces the deprecated
 * `SUPPORTED_STRATEGIES_BY_SYMBOL` frontend constant — it drives the
 * /strategies New Strategy dialog and any other gate that asks "is this
 * (symbol, strategyCode) pair approved for live use?".
 *
 * Admin shapes carry evidence + audit fields the picker doesn't need.
 */

export type ApprovalStatus = 'approved' | 'grandfathered' | 'stale' | 'revoked';

/** Slim picker shape returned by GET /api/v1/symbol-approvals. */
export interface PublicSymbolApproval {
  symbol: string;
  strategyCode: string;
}

/** Admin shape returned by GET /api/v1/admin/symbol-approvals. */
export interface SymbolApproval {
  id: string;
  symbol: string;
  strategyCode: string;
  backtestRunId: string | null;
  evidenceCagrPct: number | null;
  evidenceCapitalUsd: number | null;
  evidenceWindowDays: number | null;
  evidenceTrades: number | null;
  notes: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedReason: string | null;
  createdTime: string;
  createdBy: string | null;
  updatedTime: string;
  updatedBy: string | null;
  status: ApprovalStatus;
  stale: boolean;
}

/** Per-symbol threshold row returned by GET /api/v1/admin/symbol-approvals/thresholds. */
export interface SymbolApprovalThreshold {
  symbol: string;
  minCagrPct: number;
  minInitialCapitalUsd: number;
  minWindowDays: number;
  minTrades: number;
  updatedTime: string;
  updatedBy: string | null;
}

/** One failure surfaced by a 422 GATE_FAILED response. */
export interface GateFailedCheck {
  name: 'min_cagr_pct' | 'min_initial_capital_usd' | 'min_window_days' | 'min_trades';
  threshold: number;
  actual: number;
}

/** Structured 422 body — diverges from the project's ResponseDto envelope by
 *  design so dialogs can render per-threshold deltas inline. */
export interface GateFailureBody {
  error: 'GATE_FAILED';
  failedChecks: GateFailedCheck[];
}

// ---- Request bodies ----

export interface CreateSymbolApprovalRequest {
  symbol: string;
  strategyCode: string;
  backtestRunId: string;
  notes?: string;
}

export interface AttachEvidenceRequest {
  backtestRunId: string;
  notes?: string;
}

export interface RevokeApprovalRequest {
  reason: string;
}

export interface UpdateApprovalThresholdRequest {
  minCagrPct: number;
  minInitialCapitalUsd: number;
  minWindowDays: number;
  minTrades: number;
}
