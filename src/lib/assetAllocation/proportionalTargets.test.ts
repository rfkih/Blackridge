import { describe, it, expect } from 'vitest';

import { buildProportionalTargets } from './proportionalTargets';
import type { PortfolioAsset } from '@/types/portfolio';

function asset(a: string, usdtValue: number): PortfolioAsset {
  return { asset: a, free: 0, locked: 0, usdtValue };
}

const sum = (items: { targetPct: number }[]) => items.reduce((s, i) => s + i.targetPct, 0);
const pct = (items: { asset: string; targetPct: number }[], a: string) =>
  items.find((i) => i.asset === a)?.targetPct;

describe('buildProportionalTargets', () => {
  it('holds USDT at the chosen pct and splits the remainder by value share', () => {
    const items = buildProportionalTargets(50, [asset('BTC', 300), asset('ETH', 100)]);
    expect(pct(items, 'USDT')).toBe(50);
    expect(pct(items, 'BTC')).toBe(37.5); // 50 * 300/400
    expect(pct(items, 'ETH')).toBe(12.5); // 50 * 100/400
    expect(Math.abs(sum(items) - 100)).toBeLessThan(0.011);
  });

  it('sums to 100 and lands the rounding residual on the largest-weight asset', () => {
    // 3 equal holdings, remainder 50 → 16.67 each = 50.01; residual -0.01 on the largest.
    const items = buildProportionalTargets(50, [
      asset('BTC', 100),
      asset('ETH', 100),
      asset('SOL', 100),
    ]);
    expect(pct(items, 'USDT')).toBe(50);
    expect(Math.abs(sum(items) - 100)).toBeLessThan(0.011);
    // BTC is first among equal-value → carries the residual (16.67 - 0.01).
    expect(pct(items, 'BTC')).toBe(16.66);
    expect(pct(items, 'ETH')).toBe(16.67);
    expect(pct(items, 'SOL')).toBe(16.67);
  });

  it('returns a single USDT:100 row when usdtPct is 100', () => {
    const items = buildProportionalTargets(100, [asset('BTC', 300), asset('ETH', 100)]);
    expect(items).toEqual([{ asset: 'USDT', targetPct: 100, minBandPp: 5 }]);
  });

  it('forces USDT to 100 when no non-USDT is held (cannot split into nothing)', () => {
    const items = buildProportionalTargets(50, [asset('USDT', 80)]);
    expect(items).toEqual([{ asset: 'USDT', targetPct: 100, minBandPp: 5 }]);
  });

  it('gives a single crypto the whole remainder', () => {
    const items = buildProportionalTargets(40, [asset('BTC', 200)]);
    expect(pct(items, 'USDT')).toBe(40);
    expect(pct(items, 'BTC')).toBe(60);
    expect(Math.abs(sum(items) - 100)).toBeLessThan(0.011);
  });

  it('clamps out-of-range usdtPct and ignores zero-value dust', () => {
    const items = buildProportionalTargets(150, [asset('BTC', 100), asset('DUST', 0)]);
    expect(items).toEqual([{ asset: 'USDT', targetPct: 100, minBandPp: 5 }]);
  });
});
