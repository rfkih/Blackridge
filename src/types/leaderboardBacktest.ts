/**
 * Domain shape for the "Backtest" leaderboard tab (Research JVM,
 * `GET /api/v1/leaderboard/backtest`). One row is the BEST backtest run per
 * (symbol, strategy, interval) cell — an explore-only candidate, NOT a
 * deployable approved strategy. Wire numbers arrive as number|string (Jackson
 * BigDecimal) and are coerced in `@/lib/api/leaderboard` before reaching here.
 */
export interface BacktestLeaderboardEntry {
  /** 1-based rank in the backtest candidate list. */
  rank: number;
  symbol: string;
  strategyCode: string;
  interval: string;
  /** Pinned evidence backtest run — feeds the approval request. */
  backtestRunId: string;
  cagrPct: number | null;
  maxDrawdownPct: number | null;
  psr: number | null;
  /** Deflated Sharpe — selection-bias-corrected. */
  deflatedSharpe: number | null;
  /** Number of sweep trials the DSR deflation was computed against. */
  dsrNTrials: number | null;
  profitFactor: number | null;
  sortino: number | null;
  trades: number;
  winRate: number | null;
  /** ISO date strings bounding the backtest window. */
  dataStart: string | null;
  dataEnd: string | null;
  /** Calendar span of the backtest window, in days. */
  spanDays: number;
  walkForwardVerdict: string | null;
  /** Winning parameter map for this run. Display only (no deploy on this tab). */
  bestParams: Record<string, unknown>;
}
