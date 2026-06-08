import { describe, it, expect } from 'vitest';
import { mergeComputedEma } from '../useFeaturesWithComputedEma';

const mk = (closes: number[]) =>
  closes.map((c, i) => ({ time: i + 1, open: c, high: c, low: c, close: c, volume: 0 }));

describe('mergeComputedEma', () => {
  it('adds ema100 by time and preserves endpoint fields', () => {
    const candles = mk(Array.from({ length: 100 }, (_v, i) => 100 + i));
    const out = mergeComputedEma(candles, []);
    // last point has a computed ema100
    expect(out[out.length - 1].ema100).not.toBeNull();
    // a point before warmup (index < 99) has null ema100
    expect(out[0].ema100).toBeNull();
  });
});
