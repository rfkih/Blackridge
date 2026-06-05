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
  /** When this representative run was created (ISO, server clock); the most-recent
   *  non-null-DSR run in its cell. Lets the UI show "as of" + flag stale rows. */
  runCreatedAt: string | null;
  walkForwardVerdict: string | null;
  /** Winning parameter map for this run. Display only (no deploy on this tab). */
  bestParams: Record<string, unknown>;
  /** Strategy kind — "TRADING" (default) or "HEDGING". Null on legacy rows. */
  strategyKind?: 'TRADING' | 'HEDGING' | string | null;
}

/**
 * Backtest leaderboard page — ranked rows plus the survivorship denominator.
 * `qualifyingCells` is the total number of (symbol × interval × strategy) cells
 * that pass the floors (≥100 trades, ≥2y data window, non-null DSR); `shown` is
 * how many are in `entries`. The UI surfaces "top {shown} of {qualifyingCells}"
 * so a rank-1 row can't pose as best-of-everything when it's best-of-two.
 */
export interface BacktestLeaderboardPage {
  entries: BacktestLeaderboardEntry[];
  qualifyingCells: number;
  shown: number;
  /** HEDGING candidates — a SEPARATE Calmar-ranked list, exempt from the
   *  trade-count floor. Kept apart from `entries` so the two incomparable
   *  yardsticks (deflated Sharpe vs Calmar) are never interleaved. */
  hedgingEntries: BacktestLeaderboardEntry[];
  hedgingQualifyingCells: number;
  hedgingShown: number;
}
