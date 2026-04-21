import type { Interval, StrategyCode } from '@/lib/constants';
import type { EpochMs, ISO8601, UUID } from './api';
import type { PositionExitReason, PositionType, TradeDirection } from './trading';

/** Backend's BacktestRun.status values (see BacktestService.STATUS_*). */
export type BacktestStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

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
  totalTrades: number | null;
  winningTrades: number | null;
  losingTrades: number | null;
}

/**
 * Wire shape is a union of the new {@code BacktestRunDetailResponse} (from
 * GET /backtest[/:id]) and the legacy flat {@code BacktestRunResponse} that
 * older backend builds and some internal endpoints still emit. Every field
 * is optional so the mapper can pick whichever alias is present.
 */
export interface BackendBacktestRun {
  // New shape (BacktestRunDetailResponse)
  id?: UUID | null;
  accountStrategyId?: UUID | null;
  strategyAccountStrategyIds?: Record<string, UUID> | null;
  strategyCode?: string | null;
  strategyName?: string | null;
  symbol?: string | null;
  interval?: string | null;
  status?: string | null;
  fromDate?: ISO8601 | null;
  toDate?: ISO8601 | null;
  initialCapital?: number | string | null;
  endingBalance?: number | string | null;
  errorMessage?: string | null;
  createdAt?: ISO8601 | null;
  completedAt?: ISO8601 | null;
  paramSnapshot?: unknown;
  metrics?: BackendBacktestRunMetrics | null;

  // Legacy aliases (BacktestRunResponse) — same run, different field names.
  backtestRunId?: UUID | null;
  asset?: string | null;
  startTime?: ISO8601 | null;
  endTime?: ISO8601 | null;
  createdTime?: ISO8601 | null;
  updatedTime?: ISO8601 | null;
  // Legacy metrics were flat on the run, not nested; kept as optional so the
  // mapper can synthesise a BacktestMetrics when the new `metrics` is absent.
  grossProfit?: number | string | null;
  grossLoss?: number | string | null;
  netProfit?: number | string | null;
  winRate?: number | string | null;
  totalTrades?: number | null;
  totalWins?: number | null;
  totalLosses?: number | null;
  maxDrawdownPct?: number | string | null;
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
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
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
  /** JSONB param snapshot captured at submission — drives "Re-run with params". */
  paramSnapshot: Record<string, Record<string, unknown>> | null;
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
  /** Per-strategy diff-vs-defaults from the wizard Step 2. */
  strategyParamOverrides: Record<string, Record<string, unknown>>;
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
}

export interface BacktestParamPreset {
  id: string;
  name: string;
  strategyCode: StrategyCode | string;
  overrides: Record<string, unknown>;
  createdAt: ISO8601;
}
