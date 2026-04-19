import type { Interval, StrategyCode } from '@/lib/constants';
import type { EpochMs, ISO8601, UUID } from './api';
import type { PositionExitReason, PositionType, TradeDirection } from './trading';

export type BacktestStatus = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED';

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  profitFactor: number;
  avgWinUsdt: number;
  avgLossUsdt: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
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

export interface BacktestRun {
  id: UUID;
  userId: UUID;
  status: BacktestStatus;
  symbol: string;
  interval: Interval | string;
  fromDate: ISO8601;
  toDate: ISO8601;
  initialCapital: number;
  strategyCode: string;
  strategyAccountStrategyIds: Record<string, UUID>;
  paramSnapshot: Record<string, Record<string, unknown>> | null;
  metrics: BacktestMetrics | null;
  errorMessage: string | null;
  createdAt: ISO8601;
  completedAt: ISO8601 | null;
}

export interface BacktestRunPayload {
  symbol: string;
  interval: string;
  fromDate: ISO8601;
  toDate: ISO8601;
  initialCapital: number;
  strategyCode: string;
  strategyAccountStrategyIds: Record<string, UUID>;
  strategyParamOverrides: Record<string, Record<string, unknown>>;
}

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
