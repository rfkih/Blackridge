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
  /** 1-based rank after the composite-score sort. */
  rank: number;
  symbol: string;
  strategyCode: string;
  interval: string;
  /** Annualized compounded return at 90% sizing — the evidence CAGR. */
  cagrPct: number;
  /** Carried for display + as the score tie-break; not part of the score. */
  maxDrawdownPct: number | null;
  /** Probabilistic Sharpe, P(true Sharpe > 0) in [0,1]. */
  psr: number | null;
  profitFactor: number | null;
  trades: number;
  /** Latest walk-forward verdict for the (code, symbol, interval), or null. */
  walkForwardVerdict: string | null;
  /** Composite risk-adjusted score (0–100-ish). Sole ranking key. */
  score: number;
  /** Winning parameter map the deploy button replays. May be empty. */
  bestParams: Record<string, unknown>;
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
