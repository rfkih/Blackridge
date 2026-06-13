import type { ChartInterval } from '@/types/market';

/**
 * Pick the finest chart interval that keeps a time window under ~400 candles,
 * over the live-trades interval set `['15m','1h','4h','1d']`.
 *
 * Live trades carry no interval of their own (unlike a backtest run), so the
 * trade-history chart seeds its interval from the trade window's span
 * (entry→exit, or entry→now for an open trade). A multi-week 1d-strategy trade
 * (DCB / EMA_BAND / VRP) lands on `1d`; an intraday trade on `15m`/`1h`. The
 * user can always override via the interval tabs.
 *
 * Boundaries (≈400-candle ceiling per step):
 *   ≤ 4 days  → 15m   (4d  / 15m ≈ 384 bars)
 *   ≤ 16 days → 1h    (16d / 1h  ≈ 384 bars)
 *   ≤ 66 days → 4h    (66d / 4h  ≈ 396 bars)
 *   else      → 1d
 */
export function defaultIntervalForSpan(spanMs: number): ChartInterval {
  const days = spanMs / 86_400_000;
  if (!Number.isFinite(days) || days <= 4) return '15m';
  if (days <= 16) return '1h';
  if (days <= 66) return '4h';
  return '1d';
}
