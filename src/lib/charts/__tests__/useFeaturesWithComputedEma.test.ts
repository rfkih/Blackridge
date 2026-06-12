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

const mkAt = (closes: number[], t0 = 1) =>
  closes.map((c, i) => ({ time: t0 + i, open: c, high: c, low: c, close: c, volume: 0 }));

describe('mergeComputedEma warmup', () => {
  it('has ema100 at the FIRST window bar when warmup candles are supplied', () => {
    const warmup = mkAt(
      Array.from({ length: 120 }, (_v, i) => 100 + i),
      1,
    ); // times 1..120
    const window = mkAt(
      Array.from({ length: 10 }, (_v, i) => 220 + i),
      121,
    ); // times 121..130
    const out = mergeComputedEma(window, [], warmup);
    const first = out.find((r) => r.time === 121);
    expect(first?.ema100).not.toBeNull(); // covered from the very first window bar
    expect(out.every((r) => r.time >= 121)).toBe(true); // only window rows emitted, no warmup rows
  });
  it('without warmup, the first bars of a short window have null ema100', () => {
    const window = mkAt(
      Array.from({ length: 10 }, (_v, i) => 220 + i),
      121,
    );
    const out = mergeComputedEma(window, []);
    expect(out[0].ema100).toBeNull();
  });
});
