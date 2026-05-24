/**
 * Types for the portfolio-rebalance admin surface (V109, Phase A).
 *
 * <p>Mirrors the orchestrator's response shapes — see
 * {@code blackheart-research-orchestrator/src/orchestrator/api/specialists.py}
 * routes {@code GET /portfolio/weights} and
 * {@code POST /portfolio/rebalance}. Reaching the orchestrator goes through
 * the trading JVM proxy at {@code /api/v1/research-orch/portfolio/...}.
 */

export type PortfolioOptimizer = 'HRP' | 'EQUAL_WEIGHT' | 'MEAN_VARIANCE';

export type PortfolioWeightSource = 'EQUAL_WEIGHT' | 'HRP' | 'MEAN_VARIANCE' | 'MANUAL';

export interface PortfolioGuardrails {
  min_weight: number;
  max_weight: number;
  /**
   * JVM-enforced minimum entry notional in USDT (mirrors
   * {@code TradeConstant.MIN_USDT_NOTIONAL}). Optional for backwards
   * compatibility with the pre-Phase-A.5 response shape -- new
   * orchestrator builds always populate it.
   */
  min_notional_usd?: number;
  /**
   * Safety multiplier on top of {@code min_notional_usd}. Together
   * they define the effective floor the rebalance guard refuses
   * weights below.
   */
  min_notional_safety_factor?: number;
  effective_floor_usd?: number;
}

/**
 * One entry per strategy whose projected post-rebalance entry size
 * would fall below the JVM executor's {@code MIN_USDT_NOTIONAL} floor.
 * Apply refuses with HTTP 422 when this list is non-empty; Preview
 * surfaces it as a warning panel so the operator sees the risk before
 * clicking Apply.
 */
export interface MinNotionalViolation {
  strategy_code: string;
  symbol: string;
  weight: number;
  capital_allocation_pct: number;
  /**
   * Live Kelly multiplier used in the guard math for this row
   * (Phase A.6, 2026-05-22). 1.0 when Kelly is disabled or the
   * orchestrator fell back to the no-op assumption — the executor's
   * {@code applyKellySizing} uses the same 1.0 in that case so the
   * math stays consistent.
   */
  kelly_multiplier?: number;
  projected_entry_usd: number;
  floor_usd: number;
  shortfall_usd?: number;
  /** Set to {@code "non_positive_equity"} when equity is 0 or missing. */
  reason?: string;
}

export interface PortfolioWeightRow {
  account_strategy_id: string;
  account_id: string;
  strategy_code: string;
  symbol: string;
  interval_name: string;
  enabled: boolean;
  simulated: boolean;
  portfolio_weight: number;
  weight_source: PortfolioWeightSource;
  weight_updated_at: string | null;
}

export interface PortfolioWeightsResponse {
  items: PortfolioWeightRow[];
  guardrails: PortfolioGuardrails;
  fetched_at: string;
}

export interface RebalanceRequest {
  /**
   * Multi-tenancy boundary (added 2026-05-20) -- each user owns their
   * AccountStrategy rows, so a rebalance is always per-account. The
   * orchestrator REJECTS requests without it.
   */
  account_id: string;
  /**
   * Current FREE USDT balance for {@code account_id} (NOT total
   * marketable equity). Required since Phase A.5 (2026-05-22) -- the
   * min-notional guard refuses weights that would produce sub-floor
   * entries.
   *
   * <p>MUST be {@code PortfolioBalance.availableUsdt}, not
   * {@code totalUsdt}: the JVM executor sizes LONG entries against
   * the per-asset free balance, so the guard math has to use the
   * same number. Passing total here would overstate the executor's
   * sizing surface by the locked-USDT fraction.
   */
  available_usdt: number;
  optimizer: PortfolioOptimizer;
  strategy_codes?: string[];
  min_overlap_days?: number;
  mu_by_code?: Record<string, number>;
  risk_aversion?: number;
  dry_run: boolean;
}

export interface RebalanceDiagnostics {
  n_clamped_low?: number;
  n_clamped_high?: number;
  renorm_factor?: number;
  reason?: string;
  /**
   * Strategies whose projected entry size would fall below the JVM
   * executor's MIN_USDT_NOTIONAL floor with the proposed weights.
   * Apply refuses (HTTP 422) when non-empty; Preview surfaces this
   * as a warning panel so the operator sees the risk before
   * committing.
   */
  below_min_notional?: MinNotionalViolation[];
  /**
   * The available_usdt figure used in the guard math. Echoes the
   * caller-provided value when {@code available_usdt_source} is
   * {@code "caller_provided"}; in Phase A.6 the orchestrator pulls
   * this from the trading JVM and that value wins.
   */
  available_usdt?: number;
  /**
   * Phase A.6 (2026-05-22). {@code "trading_jvm"} when the orchestrator
   * read live available USDT from {@code /api/v1/internal/orch/portfolio};
   * {@code "caller_provided"} when the client was unavailable and the
   * orchestrator fell back to the caller's body value.
   */
  available_usdt_source?: 'trading_jvm' | 'caller_provided';
  /**
   * Caller-provided vs JVM-side drift, expressed as percent. Only
   * present when {@code available_usdt_source === 'trading_jvm'} and
   * the caller provided a non-zero value. >0 means the JVM saw more
   * equity than the caller did; <0 means less. Logged but not
   * blocking — equity moves between Preview and Apply are expected.
   */
  available_usdt_drift_pct?: number;
  /**
   * Echo of the caller-provided figure when the JVM read won. Aids
   * forensics: operator can see exactly how stale their frontend
   * snapshot was.
   */
  available_usdt_caller_provided?: number;
  effective_floor_usd?: number;
  /**
   * Phase A.6. {@code "trading_jvm"} when the guard math used live
   * Kelly multipliers fetched per-row from the JVM;
   * {@code "fallback_kelly=1.0"} when the orchestrator couldn't reach
   * the Kelly endpoint and used 1.0 as the no-op fallback.
   */
  kelly_source?: 'trading_jvm' | 'fallback_kelly=1.0';
  /**
   * Per-row Kelly multipliers used in the guard math (only present
   * when {@code kelly_source === 'trading_jvm'}). Keyed by
   * {@code account_strategy_id}, not strategy_code — multi-symbol
   * books have one Kelly per row, not per code.
   */
  kelly_by_account_strategy_id?: Record<string, number>;
}

/**
 * Shape of the 422 error envelope's {@code details} field for the
 * {@code below_min_notional_floor} error code. The dialog renders this
 * inline (dialog stays open) rather than dismissing with a toast.
 */
export interface MinNotionalApplyErrorDetails {
  violations: MinNotionalViolation[];
  available_usdt: number;
  /** Phase A.6: where the available_usdt number came from. */
  available_usdt_source?: 'trading_jvm' | 'caller_provided';
  effective_floor_usd: number;
  min_notional_usd: number;
  min_notional_safety_factor: number;
  /** Phase A.6: replaces the old {@code kelly_assumption} string. */
  kelly_source?: 'trading_jvm' | 'fallback_kelly=1.0';
  journal_id: string | null;
}

export interface RebalanceSummary {
  n_assets: number;
  max_weight?: number;
  min_weight?: number;
  concentration_hhi?: number;
  n_effective?: number;
}

export interface RebalanceResponse {
  applied: boolean;
  optimizer: PortfolioOptimizer;
  dry_run: boolean;
  codes: string[];
  weights_before: Record<string, number>;
  weights_after: Record<string, number>;
  summary?: RebalanceSummary;
  diagnostics: RebalanceDiagnostics;
  skipped: Record<string, string>;
  n_updated: number;
  journal_id: string | null;
  guardrails?: PortfolioGuardrails;
  computed_at: string;
}
