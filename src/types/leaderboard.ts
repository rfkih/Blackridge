/**
 * Domain shapes for the public "Top Strategies" leaderboard (Trading JVM,
 * `/api/v1/leaderboard`). One ranked row pairs a V102-approved
 * `(symbol, strategyCode)` with its evidence-backtest robustness +
 * profitability metrics and the exact winning parameter map a one-click
 * deploy replays.
 *
 * Wire (`Backend*`) shapes live in `@/lib/api/leaderboard`; these are the
 * coerced domain types the UI renders against.
 */

export interface LeaderboardEntry {
  /** 1-based rank after the Conviction-score sort. */
  rank: number;
  symbol: string;
  strategyCode: string;
  interval: string;
  /** Annualized compounded return at 90% sizing — the evidence CAGR. Display only. */
  cagrPct: number;
  /** Carried for display + as the score tie-break; not part of the score. */
  maxDrawdownPct: number | null;
  /** Probabilistic Sharpe, P(true Sharpe > 0) in [0,1]. */
  psr: number | null;
  /** Deflated Sharpe — selection-bias-corrected. The rank's EdgeLB spine (V134). */
  deflatedSharpe: number | null;
  profitFactor: number | null;
  /** Sortino ratio (display). */
  sortino: number | null;
  /** Calmar = annualized return / |maxDD| (display + tie-break). */
  calmar: number | null;
  trades: number;
  /** Realized closed trades pooled across live deployments (0 until P1). */
  nLive: number | null;
  /** Latest walk-forward verdict for the (code, symbol, interval), or null. */
  walkForwardVerdict: string | null;
  /** Latest live drift verdict from forecast_reconciliation (null until P1). */
  driftStatus: string | null;
  /** Capacity tier; "UNKNOWN" until the capacity sweep lands (P2). */
  capacityTier: string | null;
  /** Conviction score in [0,1] — EdgeLB × Robustness × Live × Capacity. Sole ranking key. */
  score: number;
  /** ISO timestamp this snapshot row was last recomputed (server clock). For "as of". */
  computedAt: string | null;
  /** Max correlation of this strategy's daily P&L vs the caller's live book (null if N/A). */
  corrToBook: number | null;
  /** True when corrToBook ≥ 0.80 — a near-substitute for something already deployed. */
  nearSubstitute: boolean;
  /** Winning parameter map the deploy button replays. May be empty. */
  bestParams: Record<string, unknown>;
}

/** Full leaderboard page: ranked entries + the survivorship denominator. */
export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  /** Active (non-revoked) approvals — the eligible population. */
  approvedCount: number;
  /** Revoked approvals — the part of the denominator the board doesn't show. */
  revokedCount: number;
}

/** Request body for POST /api/v1/leaderboard/deploy. Interval, direction, and
 *  params are server-derived from the approval's evidence backtest — only the
 *  target account + sizing are supplied by the client. */
export interface DeployStrategyPayload {
  accountId: string;
  symbol: string;
  strategyCode: string;
  capitalAllocationPct: number;
  /** Conflict resolution for the one-preset-per-tuple invariant. Only one
   *  preset per (account, strategy, symbol, interval) may run LIVE at a time.
   *  - omitted / `true` → land LIVE, deactivating any existing active sibling.
   *  - `false` → land STOPPED so an existing active sibling keeps running.
   *  Surfaced by the deploy dialog's conflict prompt: "replace" sends true,
   *  "keep existing" sends false. */
  activate?: boolean;
}
