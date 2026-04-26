import type { UUID } from './api';

/** One row of a feature-bucket breakdown. */
export interface BucketRow {
  low: number;
  high: number;
  count: number;
  wins: number;
  /** 0..1 */
  winRate: number;
  totalPnl: number;
}

export interface Headline {
  tradeCount: number;
  wins: number;
  losses: number;
  /** 0..1 */
  winRate: number;
  /** null when there are no losses — render "∞". */
  profitFactor: number | null;
  avgR: number;
  avgWin: number;
  avgLoss: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  peakEquity: number;
  maxDrawdown: number;
  maxConsecutiveLosses: number;
  initialCapital: number;
}

export interface MfeCapture {
  winnerCaptureAvg: number | null;
  winnerCaptureMin: number | null;
  winnerCaptureMax: number | null;
  winnerMfeAvg: number | null;
  loserMaeAvg: number | null;
  loserMaeMedian: number | null;
}

export interface TradeSnapshot {
  tradeId: UUID;
  entryTime: string | null;
  side: 'LONG' | 'SHORT' | string;
  pnl: number;
  r: number | null;
  entryAdx: number | null;
  entryRsi: number | null;
  entryClv: number | null;
  entryRvol: number | null;
  biasAdx: number | null;
  mfeR: number | null;
  maeR: number | null;
  exitReason: string | null;
}

export interface AnalysisReport {
  backtestRunId: UUID;
  strategyCode: string;
  strategyVersion: string | null;
  asset: string;
  interval: string;
  tradeCount: number;
  headline: Headline;
  /** Keyed by bucket code: "entry_adx" | "bias_adx" | "entry_rsi" | "entry_clv" | "entry_rvol". */
  buckets: Record<string, BucketRow[]>;
  mfeCapture: MfeCapture | null;
  bestTrades: TradeSnapshot[];
  worstTrades: TradeSnapshot[];
}

/**
 * Mirror of {@code TrendPullbackStrategyService.Params}. All BigDecimal on the
 * wire; rendered as number in JS. Any change here needs to flip the Java side
 * too (same field names).
 */
export interface TprParams {
  ema50SlopeMin: number;
  biasAdxMin: number;
  biasAdxMax: number;
  adxEntryMin: number;
  adxEntryMax: number;
  diSpreadMin: number;
  pullbackTouchAtr: number;
  longRsiMin: number;
  longRsiMax: number;
  shortRsiMin: number;
  shortRsiMax: number;
  bodyRatioMin: number;
  clvMin: number;
  clvMax: number;
  rvolMin: number;
  stopAtrBuffer: number;
  maxEntryRiskPct: number;
  tp1R: number;
  breakEvenR: number;
  runnerBreakEvenR: number;
  runnerPhase2R: number;
  runnerPhase3R: number;
  runnerAtrPhase2: number;
  runnerAtrPhase3: number;
  runnerLockPhase2R: number;
  runnerLockPhase3R: number;
  minSignalScore: number;
}

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

export interface SweepSpec {
  strategyCode: string;
  accountStrategyId: string;
  asset: string;
  interval: string;
  fromDate: string; // ISO LocalDateTime
  toDate: string;
  initialCapital: number;
  label?: string;
  /** Flat-grid mode — key → list of explicit candidate values. Used when
   *  {@link #rounds} is 1 / absent. */
  paramGrid?: Record<string, Array<number | string | boolean>>;
  /** Research mode — key → { min, max, step }. Required when rounds > 1. */
  paramRanges?: Record<string, ParamRange>;
  /** Number of iterative-refinement rounds. 1 = flat sweep. */
  rounds?: number;
  /** Fraction of each round's results kept as elites (default 0.25). */
  elitePct?: number;
  rankMetric?: 'avgR' | 'profitFactor' | 'netPnl' | 'winRate';
  /** Pinned parameter overrides — held constant across every combo. Use for
   *  keys you want to move off the default but don't want to spend a sweep
   *  dimension on. Must not overlap with paramRanges/paramGrid; backend
   *  rejects collisions at submit time. */
  fixedParams?: Record<string, number>;
  /** Evaluation mode. NONE = legacy single-window. TRAIN_OOS = one held-out
   *  tail. WALK_FORWARD_K = K rolling folds; mean OOS Sharpe across folds is
   *  the ranking metric, stddev surfaces regime sensitivity. */
  splitMode?: 'NONE' | 'TRAIN_OOS' | 'WALK_FORWARD_K';
  /** Number of walk-forward folds when splitMode = WALK_FORWARD_K. Default 4. */
  walkForwardWindows?: number;
  /** % of the window reserved for OOS when splitMode = TRAIN_OOS. Default 30. */
  oosFractionPct?: number;
  /** % of the full window reserved as locked holdout — never touched during
   *  sweep optimization. After sweep completes, evaluate winner on holdout
   *  via POST /sweeps/:id/evaluate-holdout for the unbiased estimate.
   *  Default null = disabled (legacy). Requires splitMode === 'TRAIN_OOS'. */
  holdoutFractionPct?: number;
}

export interface SweepResult {
  round?: number | null;
  paramSet: Record<string, number | string | boolean>;
  backtestRunId: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  /** Wall-clock ms from RUNNING → COMPLETED/FAILED. Null until the combo
   *  finishes; the leaderboard uses completed entries' values to estimate
   *  in-flight progress for any RUNNING row. */
  elapsedMs?: number | null;
  /** Most recent BacktestRun.progress_percent (0..100) seen by the sweep
   *  thread. Mirrors what the per-run page shows; null until the first poll
   *  of the underlying backtest. */
  progressPercent?: number | null;
  tradeCount?: number | null;
  winRate?: number | null;
  profitFactor?: number | null;
  avgR?: number | null;
  netPnl?: number | null;
  maxDrawdown?: number | null;
  maxConsecutiveLosses?: number | null;
  /** Annualized Sharpe (× √252). Same units as the backtest result page.
   *  In TRAIN_OOS mode this mirrors {@link oosSharpeRatio} so the leaderboard
   *  ranks by OOS automatically without changing existing sort plumbing. */
  sharpeRatio?: number | null;
  /** Probabilistic Sharpe Ratio in [0, 1] — null when sample is too small.
   *  Mirrors {@link oosPsr} in TRAIN_OOS mode. */
  psr?: number | null;

  /** Train-leg metrics — only populated when SweepSpec.splitMode === 'TRAIN_OOS'. */
  trainBacktestRunId?: string | null;
  trainTradeCount?: number | null;
  trainSharpeRatio?: number | null;
  trainPsr?: number | null;
  trainNetPnl?: number | null;

  /** OOS-leg metrics — only populated in TRAIN_OOS mode. The Sharpe here is
   *  what should drive any "is this strategy good" judgment. */
  oosBacktestRunId?: string | null;
  oosTradeCount?: number | null;
  oosSharpeRatio?: number | null;
  oosPsr?: number | null;
  oosNetPnl?: number | null;

  /** K-fold walk-forward — per-fold breakdown. Each entry covers one rolling
   *  train+OOS pair. Empty/undefined when splitMode != WALK_FORWARD_K. */
  windowResults?: Array<{
    foldIndex: number;
    trainFromDate: string;
    trainToDate: string;
    oosFromDate: string;
    oosToDate: string;
    trainBacktestRunId?: string | null;
    oosBacktestRunId?: string | null;
    trainSharpeRatio?: number | null;
    oosSharpeRatio?: number | null;
    oosPsr?: number | null;
    oosNetPnl?: number | null;
    oosTradeCount?: number | null;
    status: 'COMPLETED' | 'FAILED';
  }>;
  /** Mean OOS Sharpe across folds — the headline ranking metric in K-fold
   *  mode. Mirrored to {@link sharpeRatio} so existing sort plumbing works. */
  meanOosSharpe?: number | null;
  /** Stddev of per-fold OOS Sharpes. Low relative to mean = robust;
   *  high = regime-sensitive. */
  stddevOosSharpe?: number | null;

  errorMessage?: string | null;
}

export interface SweepState {
  sweepId: string;
  userId: string | null;
  spec: SweepSpec;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string | null;
  completedAt: string | null;
  totalCombos: number;
  finishedCombos: number;
  currentRound?: number | null;
  totalRounds?: number | null;
  results: SweepResult[];
  /** Cohort-level expected-max-Sharpe under N null trials. Combos exceeding
   *  this threshold are evidence beyond multiple-comparison luck. Null when
   *  fewer than two combos have completed. Annualized for display. */
  dsrThresholdSharpe?: number | null;
  /** Stddev of the cohort's annualized Sharpes — diagnostic for the
   *  threshold calculation. */
  dsrCohortStddev?: number | null;
  /** When holdout was reserved at submit time, the dates of the locked
   *  slice. Surface them so users can see what they're about to evaluate. */
  holdoutFromDate?: string | null;
  holdoutToDate?: string | null;
  /** ID of the one-shot holdout evaluation backtest, set after the user
   *  triggers POST /sweeps/:id/evaluate-holdout. Null until then. */
  holdoutBacktestRunId?: string | null;
}

/** Flattened row emitted by `/api/v1/research/log`. */
export interface ResearchLogRow {
  runId: UUID;
  strategyCode: string;
  strategyVersion: string | null;
  asset: string;
  interval: string;
  createdAt: string | null;
  tradeCount: number;
  winRate: number;
  profitFactor: number | null;
  avgR: number;
  netPnl: number;
  maxDrawdown: number;
  maxConsecutiveLosses: number;
}
