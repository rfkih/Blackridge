import { describe, it, expect } from 'vitest';
import {
  drawdownSeries,
  btcStackSeries,
  alignClosesToEquity,
  type EquitySample,
} from './btcCompare';
import type { ClosePoint } from '@/lib/buyHold';

describe('drawdownSeries', () => {
  it('returns a 0%-anchored, non-positive drawdown at each peak/trough', () => {
    const out = drawdownSeries([
      { time: 1, value: 100 },
      { time: 2, value: 120 }, // new peak → 0
      { time: 3, value: 90 }, // -25% off the 120 peak
      { time: 4, value: 108 }, // -10% off the 120 peak
    ]);
    expect(out.map((p) => p.time)).toEqual([1, 2, 3, 4]);
    expect(out[0].drawdownPct).toBe(0);
    expect(out[1].drawdownPct).toBe(0);
    expect(out[2].drawdownPct).toBeCloseTo(-25, 6);
    expect(out[3].drawdownPct).toBeCloseTo(-10, 6);
  });

  it('is empty for an empty series', () => {
    expect(drawdownSeries([])).toEqual([]);
  });
});

describe('btcStackSeries', () => {
  const DAY = 86_400_000;

  it('expresses strategy equity in BTC terms normalized to the first bar (1.00 = buy-hold)', () => {
    // strategy flat at 100 USD, BTC price doubles → in BTC terms the stack HALVED
    // relative to start ⇒ stackMultiple 0.5 vs a buy-holder who is flat at 1.00.
    const equity: EquitySample[] = [
      { time: 1 * DAY, equity: 100 },
      { time: 2 * DAY, equity: 100 },
    ];
    const closes: ClosePoint[] = [
      { ts: 1 * DAY, close: 50_000 },
      { ts: 2 * DAY, close: 100_000 },
    ];
    const out = btcStackSeries(equity, closes);
    expect(out[0].stackMultiple).toBeCloseTo(1, 6);
    expect(out[1].stackMultiple).toBeCloseTo(0.5, 6);
  });

  it('shows >1.00 when the strategy grows its BTC stack faster than buy-hold', () => {
    // strategy doubles in USD while price is flat → twice the BTC.
    const out = btcStackSeries(
      [
        { time: 1 * DAY, equity: 100 },
        { time: 2 * DAY, equity: 200 },
      ],
      [
        { ts: 1 * DAY, close: 50_000 },
        { ts: 2 * DAY, close: 50_000 },
      ],
    );
    expect(out[1].stackMultiple).toBeCloseTo(2, 6);
  });

  it('returns [] when inputs are empty or unalignable', () => {
    expect(btcStackSeries([], [])).toEqual([]);
    expect(btcStackSeries([{ time: 1, equity: 100 }], [])).toEqual([]);
  });
});

describe('alignClosesToEquity', () => {
  it('keeps only closes whose day matches an equity sample day', () => {
    const day = 86_400_000;
    const equity: EquitySample[] = [
      { time: 2 * day + 5_000, equity: 100 },
      { time: 4 * day + 9_000, equity: 110 },
    ];
    const closes: ClosePoint[] = [
      { ts: 1 * day, close: 1 },
      { ts: 2 * day, close: 2 },
      { ts: 3 * day, close: 3 },
      { ts: 4 * day, close: 4 },
    ];
    const aligned = alignClosesToEquity(equity, closes);
    // one close per equity sample, mapped onto the equity timestamp
    expect(aligned).toHaveLength(2);
    expect(aligned[0]).toEqual({ ts: equity[0].time, close: 2 });
    expect(aligned[1]).toEqual({ ts: equity[1].time, close: 4 });
  });

  it('drops equity samples with no same-day close', () => {
    const day = 86_400_000;
    const aligned = alignClosesToEquity(
      [{ time: 5 * day, equity: 100 }],
      [{ ts: 1 * day, close: 1 }],
    );
    expect(aligned).toEqual([]);
  });
});
