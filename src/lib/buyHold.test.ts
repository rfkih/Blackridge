import { describe, it, expect } from 'vitest';

import { buyHoldSeries, maxDrawdownPct, totalReturnPct, compareToBuyHold } from './buyHold';

describe('buyHoldSeries', () => {
  it('normalizes to initialCapital at the first candle', () => {
    const candles = [
      { ts: 1, close: 100 },
      { ts: 2, close: 150 },
      { ts: 3, close: 50 },
    ];
    const series = buyHoldSeries(candles, 1000);
    expect(series).toEqual([
      { ts: 1, value: 1000 },
      { ts: 2, value: 1500 },
      { ts: 3, value: 500 },
    ]);
  });

  it('returns an empty array for empty candles', () => {
    expect(buyHoldSeries([], 1000)).toEqual([]);
  });

  it('handles a single candle (flat at initialCapital)', () => {
    expect(buyHoldSeries([{ ts: 5, close: 42 }], 2000)).toEqual([{ ts: 5, value: 2000 }]);
  });

  it('is zero-close-safe: returns [] when the first close is zero', () => {
    const candles = [
      { ts: 1, close: 0 },
      { ts: 2, close: 100 },
    ];
    expect(buyHoldSeries(candles, 1000)).toEqual([]);
  });

  it('is zero-close-safe: returns [] when the first close is non-finite', () => {
    const candles = [
      { ts: 1, close: NaN },
      { ts: 2, close: 100 },
    ];
    expect(buyHoldSeries(candles, 1000)).toEqual([]);
  });

  it('preserves provided timestamp units (unit-agnostic)', () => {
    const candles = [
      { ts: 1_700_000_000_000, close: 200 },
      { ts: 1_700_000_900_000, close: 220 },
    ];
    const series = buyHoldSeries(candles, 500);
    expect(series[0]).toEqual({ ts: 1_700_000_000_000, value: 500 });
    expect(series[1].value).toBeCloseTo(550, 6);
  });
});

describe('maxDrawdownPct', () => {
  it('computes peak-to-trough max drawdown as a non-positive percent', () => {
    // peak 150, trough 75 → -50%
    const series = [{ value: 100 }, { value: 150 }, { value: 75 }, { value: 120 }];
    expect(maxDrawdownPct(series)).toBeCloseTo(-50, 6);
  });

  it('returns 0 for a monotonically rising series', () => {
    const series = [{ value: 100 }, { value: 110 }, { value: 130 }];
    expect(maxDrawdownPct(series)).toBe(0);
  });

  it('returns 0 for empty or single-point series', () => {
    expect(maxDrawdownPct([])).toBe(0);
    expect(maxDrawdownPct([{ value: 100 }])).toBe(0);
  });

  it('tracks the running peak (drawdown measured from the highest prior peak)', () => {
    // peak 200 then down to 100 → -50%, even though a later 150 recovers partly
    const series = [{ value: 100 }, { value: 200 }, { value: 100 }, { value: 150 }];
    expect(maxDrawdownPct(series)).toBeCloseTo(-50, 6);
  });
});

describe('totalReturnPct', () => {
  it('computes percent change from first to last', () => {
    expect(totalReturnPct(1000, 1500)).toBeCloseTo(50, 6);
    expect(totalReturnPct(1000, 750)).toBeCloseTo(-25, 6);
  });

  it('returns 0 when first is zero (safe division)', () => {
    expect(totalReturnPct(0, 1000)).toBe(0);
  });
});

describe('compareToBuyHold', () => {
  it('computes upside captured and drawdown cut for a winning strategy', () => {
    // strategy +40% vs buy-hold +83% → captured ~48%; dd -26% vs -49% → cut ~47%
    const c = compareToBuyHold(40, -26, 83, -49);
    expect(c.upsideCapturedPct).toBeCloseTo((40 / 83) * 100, 6);
    expect(c.ddCutPct).toBeCloseTo((1 - 26 / 49) * 100, 6);
  });

  it('returns null upsideCapturedPct when buy-hold return is <= 0', () => {
    const c = compareToBuyHold(10, -5, -30, -60);
    expect(c.upsideCapturedPct).toBeNull();
    // dd cut still computable
    expect(c.ddCutPct).toBeCloseTo((1 - 5 / 60) * 100, 6);
  });

  it('returns null ddCutPct when buy-hold drawdown is zero (safe division)', () => {
    const c = compareToBuyHold(40, -10, 80, 0);
    expect(c.ddCutPct).toBeNull();
    expect(c.upsideCapturedPct).toBeCloseTo(50, 6);
  });

  it('handles drawdowns passed as positive magnitudes too', () => {
    // sign-agnostic on the drawdown inputs
    const c = compareToBuyHold(40, 26, 83, 49);
    expect(c.ddCutPct).toBeCloseTo((1 - 26 / 49) * 100, 6);
  });
});
