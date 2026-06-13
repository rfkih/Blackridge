import type { LivePosition } from '@/types/trading';

/**
 * Per-trade "% of account at risk" above which the figure is shown amber to
 * flag over-exposure on a single live position.
 */
export const SINGLE_TRADE_RISK_WARN_PCT = 10;

/**
 * Aggregate "% of account at risk across all open trades" above which the
 * portfolio-level figure is shown amber.
 */
export const AGGREGATE_RISK_WARN_PCT = 25;

export interface TradeRisk {
  /** Capital deployed = quantity × current price (mark, or entry as fallback). */
  notional: number;
  /**
   * Stop-loss dollar exposure = |price − stop| × quantity. Null for
   * signal-exit trades (no fixed stop) — we never fabricate a stop-risk
   * number for those.
   */
  dollarAtRisk: number | null;
  /**
   * dollarAtRisk as a percent of available account cash. Null when there is no
   * stop-based risk to express, or the denominator is non-positive.
   */
  pctAtRisk: number | null;
  /**
   * True when the trade has no usable protective stop (VRP / EMA_BAND style
   * signal exits, or a row whose stop hasn't been surfaced). These show
   * notional only, labelled "signal exit".
   */
  isSignalExit: boolean;
}

/**
 * Risk decomposition for one LIVE open position.
 *
 * - `price` = markPrice when known, else entryPrice (the WS mark can lag a
 *   freshly-opened row by a frame or two).
 * - A non-positive / null stop ⇒ signal-exit ⇒ no dollar-at-risk.
 * - Long and short are symmetric: |price − stop| handles both sides, since a
 *   long's stop sits below price and a short's above.
 */
export function computeTradeRisk(
  position: LivePosition,
  markPrice: number | null,
  availableUsdt: number,
): TradeRisk {
  const price = markPrice != null && Number.isFinite(markPrice) ? markPrice : position.entryPrice;
  const notional = position.quantity * price;

  const stop = position.stopLossPrice;
  const isSignalExit = stop == null || !Number.isFinite(stop) || stop <= 0;

  const dollarAtRisk = isSignalExit ? null : Math.abs(price - stop) * position.quantity;
  const pctAtRisk =
    dollarAtRisk != null && availableUsdt > 0 ? (dollarAtRisk / availableUsdt) * 100 : null;

  return { notional, dollarAtRisk, pctAtRisk, isSignalExit };
}

export interface AggregateRisk {
  /** Sum of notional across every row. */
  totalNotional: number;
  /** Sum of dollarAtRisk across rows that HAVE a stop (signal-exit rows skipped). */
  totalAtRisk: number;
  /** totalAtRisk as a percent of available account cash; null when cash ≤ 0. */
  pctAtRisk: number | null;
  /** Row count (all open trades, including signal-exit ones). */
  n: number;
}

/**
 * Roll up a set of per-trade risk decompositions. `totalAtRisk` deliberately
 * sums only the non-null `dollarAtRisk` values so signal-exit trades don't
 * inflate (or zero-dilute) the stop-loss exposure figure. `availableUsdt` is
 * the shared denominator for the aggregate percent.
 */
export function aggregateTradeRisk(rows: TradeRisk[], availableUsdt: number): AggregateRisk {
  let totalNotional = 0;
  let totalAtRisk = 0;
  for (const r of rows) {
    totalNotional += r.notional;
    if (r.dollarAtRisk != null) totalAtRisk += r.dollarAtRisk;
  }
  const pctAtRisk = availableUsdt > 0 ? (totalAtRisk / availableUsdt) * 100 : null;
  return { totalNotional, totalAtRisk, pctAtRisk, n: rows.length };
}
