import { describe, it, expect } from 'vitest';
import { computeEma } from '../computeEma';

const mk = (closes: number[]) =>
  closes.map((c, i) => ({ time: i + 1, open: c, high: c, low: c, close: c, volume: 0 }));

describe('computeEma', () => {
  it('returns [] when fewer candles than period', () => {
    expect(computeEma(mk([1, 2, 3]), 5)).toEqual([]);
  });
  it('seeds with SMA then applies the EMA recurrence', () => {
    const out = computeEma(mk([10, 20, 30, 40]), 2); // k = 2/3
    // first point at index period-1 = 1, seed = SMA(10,20)=15
    expect(out[0]).toEqual({ time: 2, value: 15 });
    // next: 30*(2/3) + 15*(1/3) = 25
    expect(out[1].value).toBeCloseTo(25, 6);
    // next: 40*(2/3) + 25*(1/3) = 35
    expect(out[2].value).toBeCloseTo(35, 6);
    expect(out).toHaveLength(3);
  });
});
