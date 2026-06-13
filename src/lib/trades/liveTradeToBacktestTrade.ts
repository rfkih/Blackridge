import type { BacktestTrade, BacktestTradePosition } from '@/types/backtest';
import type { TradeDirection, TradePosition, Trades } from '@/types/trading';

/**
 * Adapt a live {@link Trades} row onto the {@link BacktestTrade} shape that the
 * annotated candlestick chart (`BacktestAnnotatedChart`) and `buildTradeMarkers`
 * consume — so live trades reuse the exact same overlay as backtest results
 * instead of duplicating the charting code.
 *
 * Mapping notes:
 *  - `exitAvgPrice` → `exitPrice` (live trades store the volume-weighted exit).
 *  - `stopLossPrice` 0 → `null`: a non-positive stop means "signal exit / no
 *    fixed stop" (VRP, EMA_BAND), matching `tradeToLivePosition`'s convention.
 *    The chart then skips the SL line instead of drawing one at $0.
 *  - `rMultiple` is derived from entry/stop/exit; `NaN` when there's no fixed
 *    stop or the trade is still open, so `formatRMultiple` renders "—".
 *  - `interval` is the chart's currently-selected interval (live trades carry
 *    none); it only affects the trade-detail card's TF line.
 *  - `backtestRunId` is unused by the chart; set to ''.
 */
export function liveTradeToBacktestTrade(t: Trades, interval: string): BacktestTrade {
  const stopLossPrice = t.stopLossPrice > 0 ? t.stopLossPrice : null;
  const exitPrice = t.exitAvgPrice;
  return {
    id: t.id,
    backtestRunId: '',
    strategyCode: t.strategyCode || null,
    strategyName: t.strategyCode || null,
    interval,
    direction: t.direction,
    entryTime: t.entryTime,
    entryPrice: t.entryPrice,
    exitTime: t.exitTime,
    exitPrice,
    stopLossPrice,
    tp1Price: t.tp1Price,
    tp2Price: t.tp2Price,
    quantity: t.quantity,
    realizedPnl: t.realizedPnl,
    rMultiple: deriveRMultiple(t.direction, t.entryPrice, stopLossPrice, exitPrice),
    positions: t.positions.map(mapPosition),
  };
}

/**
 * Realized R-multiple = favourable move ÷ initial risk distance. Returns `NaN`
 * (rendered as "—") when there is no fixed stop or the trade has not closed, so
 * we never fabricate a "0.00R" for a signal-exit / still-open trade.
 */
function deriveRMultiple(
  direction: TradeDirection,
  entryPrice: number,
  stopLossPrice: number | null,
  exitPrice: number | null,
): number {
  if (stopLossPrice == null || exitPrice == null || !Number.isFinite(entryPrice)) return NaN;
  const risk = Math.abs(entryPrice - stopLossPrice);
  if (risk === 0) return NaN;
  const move = direction === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return move / risk;
}

/** Project a live position leg onto the backtest leg shape (drops the live-only
 *  `entryPrice` / `feeUsdt`, which the chart's marker/outcome logic ignores). */
function mapPosition(p: TradePosition): BacktestTradePosition {
  return {
    id: p.id,
    type: p.type,
    quantity: p.quantity,
    exitTime: p.exitTime,
    exitPrice: p.exitPrice,
    exitReason: p.exitReason,
    realizedPnl: p.realizedPnl,
  };
}
