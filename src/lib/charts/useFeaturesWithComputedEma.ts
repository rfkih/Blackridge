import { useMemo } from 'react';
import type { CandleData, IndicatorData } from '@/types/market';
import { computeEma } from './computeEma';

/**
 * Pure merge: returns `features` augmented with a frontend-computed `ema100`,
 * keyed in by time. Endpoint indicators are preserved; works even when
 * `features` is empty (e.g. only the ema100 toggle is on) by synthesizing rows
 * from the candles. Exported so it can be unit-tested without React.
 */
export function mergeComputedEma(
  candles: CandleData[],
  features: IndicatorData[],
  warmupCandles: CandleData[] = [],
): IndicatorData[] {
  if (!candles.length) return features;
  // Combine warmup + display for EMA seeding; dedupe by time, ascending.
  const byTime = new Map<number, CandleData>();
  for (const c of warmupCandles) byTime.set(c.time, c);
  for (const c of candles) byTime.set(c.time, c); // display wins on overlap
  const combined = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  const ema100 = computeEma(combined, 100);
  // Output rows are built over union(features, DISPLAY candles) so warmup times
  // never appear; when no EMA can be computed, emaByTime is simply empty and the
  // synthesized rows carry ema100: null (still need rows for the short window).
  const emaByTime = new Map(ema100.map((p) => [p.time, p.value]));
  const featByTime = new Map(features.map((f) => [f.time, f]));

  const times = new Set<number>();
  for (const f of features) times.add(f.time);
  for (const c of candles) times.add(c.time);

  const EMPTY: Omit<IndicatorData, 'time'> = {
    ema20: null,
    ema50: null,
    ema100: null,
    ema200: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    kcUpper: null,
    kcMiddle: null,
    kcLower: null,
    rsi: null,
    macd: null,
    macdSignal: null,
    macdHistogram: null,
    atr: null,
    adx: null,
  };

  return Array.from(times)
    .sort((a, b) => a - b)
    .map((t) => {
      const base = featByTime.get(t);
      return {
        ...EMPTY,
        ...(base ?? {}),
        time: t,
        ema100: emaByTime.get(t) ?? base?.ema100 ?? null,
      };
    });
}

/**
 * Returns `features` augmented with a frontend-computed `ema100` (and is the
 * single place to add other client-computed MAs later). Endpoint indicators are
 * preserved; ema100 is keyed in by time. Works even when `features` is empty
 * (e.g. only the ema100 toggle is on) by synthesizing rows from the candles.
 */
export function useFeaturesWithComputedEma(
  candles: CandleData[],
  features: IndicatorData[],
  warmupCandles: CandleData[] = [],
): IndicatorData[] {
  return useMemo(
    () => mergeComputedEma(candles, features, warmupCandles),
    [candles, features, warmupCandles],
  );
}
