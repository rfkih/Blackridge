import type { ISO8601, UUID } from './api';

// Backend response shapes — mirror src/main/java/.../dto/portfolio/*.java.

export interface AssetAllocationTarget {
  id: UUID | null;
  accountId: UUID;
  asset: string;
  targetPct: number;
  minBandPp: number;
  updatedTime: ISO8601 | null;
}

export interface AssetRebalancePolicy {
  id: UUID | null;
  accountId: UUID;
  calendarMinDays: number;
  slippageBpsAssumed: number;
  feeBpsAssumed: number;
  usdtReserveFloorPct: number;
  /** Phase 4 — sum of |leg notional| must be ≤ this for /execute to proceed. */
  maxPerExecuteUsdt: number;
  requireManualApproval: boolean;
  enabled: boolean;
  /** False when this is a defaults-only DTO (no row yet in asset_rebalance_policy). */
  persisted: boolean;
  updatedTime: ISO8601 | null;
}

export interface AssetDriftItem {
  asset: string;
  currentUsdtValue: number;
  currentPct: number;
  targetPct: number;
  minBandPp: number;
  driftPp: number;
  withinBand: boolean;
}

export interface AssetTradeLeg {
  action: 'BUY' | 'SELL';
  asset: string;
  quoteAsset: string;
  estQuoteQtyUsdt: number;
  estBaseQty: number | null;
  referencePrice: number | null;
  reason: string;
}

export type AssetRebalancePlanStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SKIP_WITHIN_BAND'
  | 'SKIP_CALENDAR_FLOOR'
  | 'SKIP_DISABLED'
  | 'SKIP_NO_TARGETS'
  | 'SKIP_USDT_FLOOR_INFEASIBLE';

export interface AssetRebalancePlan {
  rebalanceId: UUID | null;
  accountId: UUID;
  method: string;
  status: AssetRebalancePlanStatus;
  portfolioValueUsdt: number | null;
  estimatedCostUsdt: number | null;
  estimatedBenefitUsdt: number | null;
  skipReason: string | null;
  driftItems: AssetDriftItem[];
  tradePlan: AssetTradeLeg[];
  generatedAt: ISO8601;
  lastRebalanceAt: ISO8601 | null;
}

// Request shapes (frontend → backend).

export interface AssetTargetItemInput {
  asset: string;
  targetPct: number;
  /** Optional; backend defaults to 5pp when omitted. */
  minBandPp?: number;
}

export interface UpsertAssetTargetsRequest {
  accountId: UUID;
  items: AssetTargetItemInput[];
}

export interface UpdateAssetPolicyRequest {
  accountId: UUID;
  calendarMinDays?: number;
  slippageBpsAssumed?: number;
  feeBpsAssumed?: number;
  usdtReserveFloorPct?: number;
  maxPerExecuteUsdt?: number;
  requireManualApproval?: boolean;
  enabled?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 4 — execution

/** Per-leg result inside an execution_summary JSONB. */
export interface ExecutionLeg {
  asset: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  clientOrderId: string;
  succeeded: boolean;
  binanceStatus: string | null;
  binanceOrderId: number | null;
  requestedBaseQty: number;
  filledBaseQty: number | null;
  filledQuoteUsdt: number | null;
  averagePrice: number | null;
  errorMessage: string | null;
}

export interface ExecutionSummary {
  totalLegs: number;
  succeeded: number;
  failed: number;
  actualNotionalUsdt: number;
  legs: ExecutionLeg[];
}

/** View shape from GET /rebalance/{id} and POST /rebalance/{id}/execute. */
export interface AssetRebalanceHistoryView {
  id: UUID;
  accountId: UUID;
  method: string;
  status: AssetRebalancePlanStatus;
  triggeredBy: string;
  estimatedCostUsdt: number | null;
  estimatedBenefitUsdt: number | null;
  proposedAt: ISO8601;
  executedAt: ISO8601 | null;
  completedAt: ISO8601 | null;
  failedReason: string | null;
  driftSnapshot: AssetDriftItem[] | unknown;
  tradePlan: AssetTradeLeg[] | unknown;
  executionSummary: ExecutionSummary | null;
}
