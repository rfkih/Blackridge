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
