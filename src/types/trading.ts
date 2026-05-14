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
  // Null until the WS pushes a mark — never silently fall back to entryPrice,
  // which would mask "no live data" as "no movement".
  markPrice: number | null;
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
  /** V60 — mean per-trade return rate (pnl / notional × 100). Null when no
   *  closed trades in the window. Sizing-independent: shows the edge
   *  per trade regardless of how small a notional was actually placed. */
  avgTradeReturnPct?: number | null;
  /** V60 — compounded return assuming every trade had been sized at 90% of
   *  equity, in percent. Null when no closed trades in the window. */
  geometricReturnPctAtAlloc90?: number | null;
}

/**
 * Phase 2c — realized P&L decomposed into the three orthogonal legs.
 * Returned by `GET /api/v1/trades/:id/attribution`. Null when the trade is
 * still open or predates Phase 2c (no intent captured at decision time).
 * Sum of {@code signalAlpha + executionDrift + sizingResidual} equals
 * {@code realizedPnl}.
 */
export interface TradeAttribution {
  realizedPnl: number;
  signalAlpha: number;
  executionDrift: number;
  sizingResidual: number;
  entrySlippagePct: number | null;
  sizeRatio: number | null;
}
