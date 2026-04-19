import type { StrategyCode } from '@/lib/constants';
import type { EpochMs, UUID } from './api';

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';
export type PositionType = 'SINGLE' | 'TP1' | 'TP2' | 'RUNNER';
export type PositionExitReason =
  | 'TP_HIT'
  | 'SL_HIT'
  | 'RUNNER_CLOSE'
  | 'MANUAL_CLOSE'
  | 'BACKTEST_END';

export interface TradePosition {
  id: UUID;
  tradeId: UUID;
  type: PositionType;
  quantity: number;
  entryPrice: number;
  exitTime: EpochMs | null;
  exitPrice: number | null;
  exitReason: PositionExitReason | null;
  feeUsdt: number;
  realizedPnl: number;
}

export interface Trades {
  id: UUID;
  accountId: UUID;
  accountStrategyId: UUID;
  strategyCode: StrategyCode | string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entryTime: EpochMs;
  entryPrice: number;
  exitTime: EpochMs | null;
  exitAvgPrice: number | null;
  stopLossPrice: number;
  tp1Price: number | null;
  tp2Price: number | null;
  quantity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  feeUsdt: number;
  // Populated by backend for OPEN trades only
  markPrice?: number | null;
  unrealizedPnlPct?: number | null;
  positions: TradePosition[];
}

export interface LivePosition {
  tradeId: UUID;
  accountId: UUID;
  accountStrategyId: UUID;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  openedAt: EpochMs;
}

export interface PnlUpdate {
  tradeId: UUID;
  accountId: UUID;
  markPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  ts: EpochMs;
}

export interface PnlSummary {
  period: 'today' | 'week' | 'month';
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  tradeCount: number;
  winRate: number;
  openCount?: number;
}
