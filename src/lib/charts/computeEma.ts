import type { CandleData } from '@/types/market';

/**
 * Standard EMA of candle closes. Seeded with the SMA of the first `period`
 * closes (Wilder/standard convention), then EMA_t = close·k + EMA_(t-1)·(1−k),
 * k = 2/(period+1). Returns one point per candle with index ≥ period−1 (no
 * value emitted during warmup). Times are passed through (TV seconds).
 * Candles are assumed ascending, finite-time, de-duplicated by the caller.
 */
export function computeEma(
  candles: CandleData[],
  period: number,
): Array<{ time: number; value: number }> {
  if (period <= 0 || candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: Array<{ time: number; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let ema = sum / period;
  out.push({ time: candles[period - 1].time, value: ema });
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: ema });
  }
  return out;
}
