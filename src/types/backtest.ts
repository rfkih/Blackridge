import type { Interval, StrategyCode } from '@/lib/constants';
import type { EpochMs, ISO8601, UUID } from './api';
import type { PositionExitReason, PositionType, TradeDirection } from './trading';

/** Backend's BacktestRun.status values. PENDING is the brief window after
 *  submission and before the async worker picks up the run. */
export type BacktestStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Raw backend response for GET /api/v1/backtest/:id and the list endpoint —
 * matches BacktestRunDetailResponse exactly. Metrics are a nested object
 * (non-null only when status === COMPLETED); paramSnapshot is whatever JSON
 * blob the backtest was submitted with (usually our strategyParamOverrides
 * map, but we accept arbitrary JSON so legacy runs don't break the mapper).
 */
export interface BackendBacktestRunMetrics {
  totalReturn: number | null;
  totalReturnPct: number | null;
  winRate: number | null;
  profitFactor: number | null;
  avgWinUsdt: number | null;
  avgLossUsdt: number | null;
  maxDrawdown: number | null;
  maxDrawdownPct: number | null;
  sharpe: number | null;
  sortino: number | null;
  psr: number | null;
  totalTrades: number | null;
  winningTrades: number | null;
  losingTrades: number | null;
  /** V60 — mean per-trade return rate (pnl / notional × 100). Sizing-
   *  independent companion to totalReturnPct. */
  avgTradeReturnPct?: number | null;
  /** V60 — compounded return assuming 90% of equity sized per trade. */
  geometricReturnPctAtAlloc90?: number | null;
}

/**
 * Wire shape is a union of the new {@code BacktestRunDetailResponse} (from
 * GET /backtest[/:id]) and the legacy flat {@code BacktestRunResponse} that
 * older backend builds and some internal endpoints still emit. Every field
 * is optional so the mapper can pick whichever alias is present.
 */
export interface BackendBacktestRun {
  id?: UUID | null;
  accountStrategyId?: UUID | null;
  strategyAccountStrategyIds?: Record<string, UUID> | null;
  strategyCode?: string | null;
  strategyName?: string | null;
  symbol?: string | null;
  interval?: string | null;
  status?: string | null;
  /** 0–100 while the run is PENDING/RUNNING. */
  progressPercent?: number | null;
  fromDate?: ISO8601 | null;
  toDate?: ISO8601 | null;
  initialCapital?: number | string | null;
  endingBalance?: number | string | null;
  errorMessage?: string | null;
  createdAt?: ISO8601 | null;
  completedAt?: ISO8601 | null;
  paramSnapshot?: unknown;
  /** V104 — full effective per-strategy params (defaults merged with
   *  overrides) captured at submission. Same outer shape as paramSnapshot.
   *  Null on legacy rows submitted before V104. */
  effectiveParamsSnapshot?: unknown;
  /** Reproducibility manifest — git SHA + app version stamped at submit. */
  gitCommitSha?: string | null;
  appVersion?: string | null;
  /** Origin tag — USER (wizard) or RESEARCHER (autonomous orchestrator).
   *  Defaults USER on legacy rows via DB; treat unknown values as USER. */
  triggeredBy?: string | null;
  /** Run-level wizard config the UI restores on "Re-run with these params".
   *  paramSnapshot only carries per-strategy override maps; these fields
   *  carry direction toggles, allocation, multi-tf, and concurrency cap. */
  allowLong?: boolean | null;
  allowShort?: boolean | null;
  maxConcurrentStrategies?: number | null;
  strategyAllocations?: Record<string, number | string> | null;
  /** V57 — per-strategy risk-pct override map. Fractional scale (0 < x ≤ 0.20). */
  strategyRiskPcts?: Record<string, number | string> | null;
  /** V58 — per-strategy direction overrides. Wizard-supplied for research. */
  strategyAllowLong?: Record<string, boolean> | null;
  strategyAllowShort?: Record<string, boolean> | null;
  /** V62 — per-strategy risk-gate overrides. Wizard-supplied; missing on
   *  pre-V62 cached responses, treated as "no overrides". */
  strategyKillSwitchOverrides?: Record<string, boolean> | null;
  strategyRegimeOverrides?: Record<string, boolean> | null;
  strategyCorrelationOverrides?: Record<string, boolean> | null;
  strategyConcurrentCapOverrides?: Record<string, boolean> | null;
  strategyIntervals?: Record<string, string> | null;
  /** Flat funding-rate stub (basis points per 8h). Null on legacy runs. */
  fundingRateBpsPer8h?: number | string | null;
  metrics?: BackendBacktestRunMetrics | null;

  backtestRunId?: UUID | null;
  asset?: string | null;
  startTime?: ISO8601 | null;
  endTime?: ISO8601 | null;
  createdTime?: ISO8601 | null;
  updatedTime?: ISO8601 | null;

  grossProfit?: number | string | null;
  grossLoss?: number | string | null;
  netProfit?: number | string | null;
  winRate?: number | string | null;
  totalTrades?: number | null;
  totalWins?: number | null;
  totalLosses?: number | null;
  maxDrawdownPct?: number | string | null;
  /** V60 — flat legacy alias (BacktestRunResponse) for the two new metrics. */
  avgTradeReturnPct?: number | string | null;
  geometricReturnPctAtAlloc90?: number | string | null;
}

/**
 * Metrics subset exposed by the backend. Fields the backend doesn't compute today
 * (Sharpe, Sortino, avg win/loss, max drawdown absolute) are nullable.
 */
export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  profitFactor: number | null;
  avgWinUsdt: number | null;
  avgLossUsdt: number | null;
  maxDrawdown: number | null;
  maxDrawdownPct: number;
  sharpe: number | null;
  sortino: number | null;
  /** Probabilistic Sharpe Ratio in [0, 1] — null when sample is too small.
   *  Probability the true Sharpe exceeds zero given the observed sample. */
  psr: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  /** V60 — Mean per-trade return rate (pnl / notional × 100). Sizing-
   *  independent edge per trade. Null on legacy runs pre-V60. */
  avgTradeReturnPct: number | null;
  /** V60 — Compounded return assuming every trade had been sized at 90% of
   *  equity, in percent. Order-sensitive; clamps to ruin (-100%) on any
   *  -100%+ step. Null on legacy runs pre-V60. */
  geometricReturnPctAtAlloc90: number | null;
}

export interface BacktestEquityPoint {
  ts: EpochMs;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface BacktestTradePosition {
  id: UUID;
  type: PositionType;
  quantity: number;
  exitTime: EpochMs | null;
  exitPrice: number | null;
  exitReason: PositionExitReason | null;
  realizedPnl: number;
}

export interface BacktestTrade {
  id: UUID;
  backtestRunId: UUID;
  /** Strategy code that fired this trade (e.g. "LSR_V2", "VCB"). Null on
   *  legacy runs persisted before the field was populated. */
  strategyCode: string | null;
  /** Display name — falls back to strategyCode when not set. */
  strategyName: string | null;
  /** Interval the strategy actually fired on. May differ across trades
   *  in multi-interval runs (e.g. LSR on 15m, VCB on 1h). */
  interval: string | null;
  direction: TradeDirection;
  entryTime: EpochMs;
  entryPrice: number;
  exitTime: EpochMs | null;
  exitPrice: number | null;
  stopLossPrice: number;
  tp1Price: number | null;
  tp2Price: number | null;
  quantity: number;
  realizedPnl: number;
  rMultiple: number;
  positions: BacktestTradePosition[];
}

/**
 * Frontend-normalized backtest run. Built from {@link BackendBacktestRun} via
 * mapBacktestRun. The mapper preserves nullability from the wire so the UI
 * can distinguish "not computed yet" (RUNNING/FAILED) from 0.
 */
export interface BacktestRun {
  id: UUID;
  accountStrategyId: UUID;
  strategyAccountStrategyIds: Record<string, UUID>;
  /** Comma-separated codes for multi-strategy runs; matches backend strategyCode. */
  strategyCode: string;
  /** Display name — falls back to strategyCode when not set. */
  strategyName: string;
  symbol: string;
  interval: Interval | string;
  status: BacktestStatus | string;
  /** 0–100 while the async worker is iterating candles. 100 on COMPLETED.
   *  Frozen at the last reported value on FAILED. */
  progressPercent: number;
  /** Window the backtest ran over — renamed from legacy startTime/endTime. */
  fromDate: ISO8601;
  toDate: ISO8601;
  initialCapital: number;
  endingBalance: number;
  metrics: BacktestMetrics | null;
  /** Run was submitted at createdAt; completedAt only set when status === COMPLETED. */
  createdAt: ISO8601;
  completedAt: ISO8601 | null;
  /** Non-null only on FAILED runs. */
  errorMessage: string | null;
  /** JSONB param snapshot captured at submission — drives "Re-run with params".
   *  This is the *overrides only* (deltas vs defaults) view. Use
   *  {@link effectiveParamsSnapshot} when you need the full effective tuning. */
  paramSnapshot: Record<string, Record<string, unknown>> | null;
  /** V104 — Full per-strategy effective parameters (defaults merged with
   *  overrides) captured at submission. The activation path writes these
   *  verbatim into the new active preset, so the live runtime resolves to
   *  exactly what the backtest used regardless of any subsequent code-default
   *  drift. Null on rows submitted before V104. */
  effectiveParamsSnapshot: Record<string, Record<string, unknown>> | null;
  /** Reproducibility manifest — together with paramSnapshot, asset, interval,
   *  fromDate, and toDate, these uniquely identify the run for replay. */
  gitCommitSha: string | null;
  appVersion: string | null;
  /** Origin tag — USER for wizard-submitted runs, RESEARCHER for autonomous
   *  research-orchestrator runs. Drives the RESEARCHER badge on the run list
   *  and detail header. */
  triggeredBy: 'USER' | 'RESEARCHER';
  /** Run-level wizard config — used by "Re-run with these params" so the
   *  user gets a faithful reproduction, not just the strategy-param subset.
   *  Null when the legacy run pre-dates the field exposure. */
  allowLong: boolean | null;
  allowShort: boolean | null;
  maxConcurrentStrategies: number | null;
  strategyAllocations: Record<string, number> | null;
  /** V57 — per-strategy risk-pct override map. Fractional scale. */
  strategyRiskPcts: Record<string, number> | null;
  /** V58 — per-strategy direction overrides (research). Null on legacy runs. */
  strategyAllowLong: Record<string, boolean> | null;
  strategyAllowShort: Record<string, boolean> | null;
  /** V62 — per-strategy risk-gate overrides (research). Null on legacy runs. */
  strategyKillSwitchOverrides: Record<string, boolean> | null;
  strategyRegimeOverrides: Record<string, boolean> | null;
  strategyCorrelationOverrides: Record<string, boolean> | null;
  strategyConcurrentCapOverrides: Record<string, boolean> | null;
  strategyIntervals: Record<string, string> | null;
  /** Flat funding-rate stub captured at submit (bps per 8h). Null on
   *  legacy runs that pre-date V22. */
  fundingRateBpsPer8h: number | null;
}

/**
 * Payload matching the backend {@code BacktestRunRequest}. Matches field names
 * on the wire exactly — no aliases, no synthetic dates. The backend is the
 * source of truth for the API contract.
 */
export interface BacktestRunPayload {
  /** Default accountStrategyId. backtest_run.account_strategy_id is NOT NULL. */
  accountStrategyId: UUID;
  strategyAccountStrategyIds: Record<string, UUID>;
  /** Preferred multi-strategy form. Service joins these comma-separated. */
  strategyCodes: string[];
  asset: string;
  interval: string;
  /** ISO-8601 LocalDateTime e.g. "2024-01-01T00:00:00". */
  startTime: ISO8601;
  endTime: ISO8601;
  initialCapital: number;
  /** Optional — backend defaults kick in when omitted. */
  riskPerTradePct?: number;
  feeRate?: number;
  slippageRate?: number;
  /** Trade-sizing inputs. Must be set or the backend sizes every order to zero
   *  (StrategyHelper.resolveRiskPct returns null → sizing bails → zero trades).
   *  See buildBacktestPayload.DEFAULT_SIZING. */
  minNotional?: number;
  minQty?: number;
  qtyStep?: number;
  maxOpenPositions?: number;
  allowLong?: boolean;
  allowShort?: boolean;
  /** Per-strategy diff-vs-defaults from the wizard Step 2. */
  strategyParamOverrides: Record<string, Record<string, unknown>>;
  /** Phase A — cap concurrent open trades across all strategies. Null = no cap.
   *  With the current single-trade backtest engine the effective cap is 1
   *  regardless; values > 1 are forward-compatible for Phase B. */
  maxConcurrentStrategies?: number;
  /** Phase A — per-strategy capital allocation override for this run only.
   *  Key = strategy code, value = allocation % (0–100). Strategies missing
   *  from the map fall back to account_strategy.capital_allocation_pct. */
  strategyAllocations?: Record<string, number>;
  /** V57 — per-strategy risk-pct override for this run only. Fractional
   *  scale (0 < x ≤ 0.20). Setting a value implicitly forces risk-based
   *  sizing on for that strategy in this run. Missing keys fall back to
   *  account_strategy.risk_pct (and the persisted toggle). */
  strategyRiskPcts?: Record<string, number>;
  /** V58 — per-strategy allowLong / allowShort override for this run only.
   *  Lets the operator research a different direction policy without
   *  flipping the live account_strategy. Missing keys fall back to the
   *  bound AS's flag (the V58 default). */
  strategyAllowLong?: Record<string, boolean>;
  strategyAllowShort?: Record<string, boolean>;
  /** V62 — per-strategy risk-gate override maps. Each is keyed by strategy
   *  code → boolean (true = force on, false = force off). Missing key =
   *  use the bound account_strategy's persisted toggle. The four gates
   *  evaluate identically in live and backtest, so the override applies
   *  to whichever path the run targets. */
  strategyKillSwitchOverrides?: Record<string, boolean>;
  strategyRegimeOverrides?: Record<string, boolean>;
  strategyCorrelationOverrides?: Record<string, boolean>;
  strategyConcurrentCapOverrides?: Record<string, boolean>;
  /** Phase B2 — per-strategy interval override for multi-timeframe runs.
   *  Key = strategy code, value = interval string (e.g. "15m"). When set,
   *  each strategy fires on its own timeframe's bar closes. When omitted,
   *  all strategies share the run's primary interval. */
  strategyIntervals?: Record<string, string>;
}

/** Wizard state — the user-facing fields the form collects before we shape a payload. */
export interface BacktestWizardConfig {
  symbol: string;
  interval: Interval | string;
  fromDate: ISO8601;
  toDate: ISO8601;
  initialCapital: number;
  strategyCodes: Array<StrategyCode | string>;
  strategyAccountStrategyIds: Record<string, UUID>;
  /** Phase A — max concurrent open trades across the strategies in this run.
   *  Null/undefined means "use the engine's current limit" (today: 1). */
  maxConcurrentStrategies?: number;
  /** Phase A — per-strategy capital allocation override (% on 0-100 scale). */
  strategyAllocations?: Record<string, number>;
  /** V57 — per-strategy risk-pct override (fractional, e.g. {"LSR": 0.03}). */
  strategyRiskPcts?: Record<string, number>;
  /** V58 — per-strategy direction overrides for research runs. */
  strategyAllowLong?: Record<string, boolean>;
  strategyAllowShort?: Record<string, boolean>;
  /** V62 — per-strategy risk-gate overrides for research runs. Each map is
   *  strategy code → boolean. Missing key = use persisted toggle. */
  strategyKillSwitchOverrides?: Record<string, boolean>;
  strategyRegimeOverrides?: Record<string, boolean>;
  strategyCorrelationOverrides?: Record<string, boolean>;
  strategyConcurrentCapOverrides?: Record<string, boolean>;
  /** Phase B2 — per-strategy interval override (e.g. {"LSR": "15m", "VCB": "1h"}). */
  strategyIntervals?: Record<string, string>;
  /** Phase B2 wizard-only mode. 'multi' auto-fills strategyIntervals
   *  from each strategy's registered interval and suppresses the
   *  "interval mismatch" warning. Not sent to the backend — payload
   *  shape is fully determined by strategyIntervals. */
  evaluationMode?: 'single' | 'multi';
  /** Direction toggles. Default: long-only. Both can be enabled (run
   *  long+short on strategies that support both); both off is rejected
   *  by the form. Wired through to {@link BacktestRunPayload.allowLong}
   *  / {@code allowShort} — backend's `resolveAllowShort` defaults
   *  null → TRUE, so the wizard *must* send the user's choice
   *  explicitly to express "long-only". */
  allowLong: boolean;
  allowShort: boolean;
}

export interface BacktestParamPreset {
  id: string;
  name: string;
  strategyCode: StrategyCode | string;
  overrides: Record<string, unknown>;
  createdAt: ISO8601;
}
