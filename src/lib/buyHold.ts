/**
 * Pure, reusable buy-and-hold comparison math.
 *
 * Used by the backtest "Strategy vs Buy-Hold" overlay and intended for reuse by
 * the live hedging dashboard. Everything here is unit-agnostic on `ts` (the
 * caller decides seconds vs ms) and free of React / charting concerns.
 *
 * Buy-hold = `initialCapital × (close_t / close_0)` — i.e. take the whole
 * initial capital, buy the asset at the first candle's close, and mark it to
 * market at each subsequent close.
 */

export interface ClosePoint {
  ts: number;
  close: number;
}

export interface BuyHoldPoint {
  ts: number;
  value: number;
}

/**
 * Normalize a candle close series into a buy-hold equity series anchored to
 * `initialCapital` at the first candle. Empty / zero-or-non-finite first-close
 * safe (returns `[]` rather than producing Infinity/NaN). Candles whose close
 * is non-finite produce a non-finite value for that point only — callers that
 * need a clean series should pre-filter, but the first-close guard protects the
 * normalization base.
 */
export function buyHoldSeries(candles: ClosePoint[], initialCapital: number): BuyHoldPoint[] {
  if (!candles.length) return [];
  const close0 = candles[0].close;
  if (!Number.isFinite(close0) || close0 <= 0) return [];
  return candles.map((c) => ({
    ts: c.ts,
    value: initialCapital * (c.close / close0),
  }));
}

/**
 * Peak-to-trough maximum drawdown of an equity series, as a non-positive
 * percent (e.g. -50 for a halving). Returns 0 for empty / single-point /
 * monotonically rising series. Drawdown is always measured from the highest
 * prior running peak.
 */
export function maxDrawdownPct(series: { value: number }[]): number {
  if (series.length < 2) return 0;
  let peak = series[0].value;
  let maxDd = 0;
  for (let i = 1; i < series.length; i++) {
    const v = series[i].value;
    if (v > peak) {
      peak = v;
      continue;
    }
    if (peak > 0) {
      const dd = (v / peak - 1) * 100;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/** Percent change from `first` to `last`. Safe division: 0 when first is 0. */
export function totalReturnPct(first: number, last: number): number {
  if (!Number.isFinite(first) || first === 0) return 0;
  return (last / first - 1) * 100;
}

export interface BuyHoldComparison {
  /**
   * Fraction of the buy-hold upside the strategy captured, in percent
   * (strategyReturn / buyHoldReturn × 100). `null` when buy-hold return ≤ 0 —
   * "% of upside captured" is meaningless when there was no upside to capture.
   */
  upsideCapturedPct: number | null;
  /**
   * How much the strategy cut the max drawdown vs buy-hold, in percent
   * (1 − |strategyDd| / |buyHoldDd|) × 100. A positive number means the
   * strategy had a shallower drawdown. `null` when buy-hold drawdown is 0
   * (safe division).
   */
  ddCutPct: number | null;
}

/**
 * Compare a strategy to buy-hold on upside captured and drawdown cut. Drawdown
 * inputs are sign-agnostic (magnitudes are used). Both outputs use safe
 * division and return `null` rather than a nonsense ratio when the denominator
 * is non-positive / zero.
 */
export function compareToBuyHold(
  strategyReturnPct: number,
  strategyMaxDdPct: number,
  buyHoldReturnPct: number,
  buyHoldMaxDdPct: number,
): BuyHoldComparison {
  const upsideCapturedPct =
    buyHoldReturnPct > 0 ? (strategyReturnPct / buyHoldReturnPct) * 100 : null;

  const bhDd = Math.abs(buyHoldMaxDdPct);
  const stratDd = Math.abs(strategyMaxDdPct);
  const ddCutPct = bhDd === 0 ? null : (1 - stratDd / bhDd) * 100;

  return { upsideCapturedPct, ddCutPct };
}
