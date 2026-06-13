import { describe, it, expect } from 'vitest';

import {
  computeTradeRisk,
  aggregateTradeRisk,
  SINGLE_TRADE_RISK_WARN_PCT,
  AGGREGATE_RISK_WARN_PCT,
  type TradeRisk,
} from './risk';
import type { LivePosition } from '@/types/trading';

function position(overrides: Partial<LivePosition> = {}): LivePosition {
  return {
    tradeId: 't1',
    accountId: 'a1',
    accountStrategyId: 'as1',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    quantity: 2,
    entryPrice: 100,
    markPrice: 110,
    unrealizedPnl: 20,
    unrealizedPnlPct: 10,
    openedAt: 0,
    stopLossPrice: 90,
    ...overrides,
  };
}

describe('computeTradeRisk', () => {
  it('stop-based LONG: notional from mark, risk = |mark - stop| * qty, pct of cash', () => {
    // mark 110, stop 90, qty 2 → notional 220, risk |110-90|*2 = 40
    const r = computeTradeRisk(position(), 110, 1000);
    expect(r.notional).toBe(220);
    expect(r.dollarAtRisk).toBe(40);
    expect(r.pctAtRisk).toBeCloseTo(4, 6); // 40 / 1000 * 100
    expect(r.isSignalExit).toBe(false);
  });

  it('stop-based SHORT: absolute distance both sides (stop sits above price)', () => {
    // short: stop 120 above mark 110, qty 2 → risk |110-120|*2 = 20
    const r = computeTradeRisk(position({ direction: 'SHORT', stopLossPrice: 120 }), 110, 1000);
    expect(r.notional).toBe(220);
    expect(r.dollarAtRisk).toBe(20);
    expect(r.pctAtRisk).toBeCloseTo(2, 6);
    expect(r.isSignalExit).toBe(false);
  });

  it('signal-exit (null stop): dollarAtRisk and pctAtRisk both null, notional still computed', () => {
    const r = computeTradeRisk(position({ stopLossPrice: null }), 110, 1000);
    expect(r.notional).toBe(220);
    expect(r.dollarAtRisk).toBeNull();
    expect(r.pctAtRisk).toBeNull();
    expect(r.isSignalExit).toBe(true);
  });

  it('treats a zero or negative stop as signal-exit (no fabricated stop number)', () => {
    expect(computeTradeRisk(position({ stopLossPrice: 0 }), 110, 1000).isSignalExit).toBe(true);
    expect(computeTradeRisk(position({ stopLossPrice: -5 }), 110, 1000).isSignalExit).toBe(true);
    expect(computeTradeRisk(position({ stopLossPrice: 0 }), 110, 1000).dollarAtRisk).toBeNull();
  });

  it('guards a zero / negative availableUsdt denominator → pctAtRisk null (risk still shown)', () => {
    const zero = computeTradeRisk(position(), 110, 0);
    expect(zero.dollarAtRisk).toBe(40);
    expect(zero.pctAtRisk).toBeNull();
    const neg = computeTradeRisk(position(), 110, -100);
    expect(neg.pctAtRisk).toBeNull();
  });

  it('falls back to entryPrice when markPrice is null', () => {
    // entry 100, stop 90, qty 2 → notional 200, risk |100-90|*2 = 20
    const r = computeTradeRisk(position(), null, 1000);
    expect(r.notional).toBe(200);
    expect(r.dollarAtRisk).toBe(20);
    expect(r.pctAtRisk).toBeCloseTo(2, 6);
  });

  it('falls back to entryPrice when markPrice is non-finite (NaN)', () => {
    const r = computeTradeRisk(position(), Number.NaN, 1000);
    expect(r.notional).toBe(200);
    expect(r.dollarAtRisk).toBe(20);
  });
});

describe('aggregateTradeRisk', () => {
  it('sums notional over all rows and at-risk only over stop-based rows', () => {
    const rows: TradeRisk[] = [
      { notional: 220, dollarAtRisk: 40, pctAtRisk: 4, isSignalExit: false },
      { notional: 100, dollarAtRisk: null, pctAtRisk: null, isSignalExit: true }, // signal exit
      { notional: 300, dollarAtRisk: 30, pctAtRisk: 3, isSignalExit: false },
    ];
    const agg = aggregateTradeRisk(rows, 1000);
    expect(agg.totalNotional).toBe(620);
    expect(agg.totalAtRisk).toBe(70); // 40 + 30, signal-exit row skipped
    expect(agg.pctAtRisk).toBeCloseTo(7, 6); // 70 / 1000 * 100
    expect(agg.n).toBe(3);
  });

  it('empty set with positive cash → 0% at risk (not null)', () => {
    expect(aggregateTradeRisk([], 1000)).toEqual({
      totalNotional: 0,
      totalAtRisk: 0,
      pctAtRisk: 0,
      n: 0,
    });
  });

  it('non-positive cash → null pct regardless of at-risk dollars', () => {
    const rows: TradeRisk[] = [
      { notional: 100, dollarAtRisk: 10, pctAtRisk: null, isSignalExit: false },
    ];
    expect(aggregateTradeRisk(rows, 0).pctAtRisk).toBeNull();
    expect(aggregateTradeRisk(rows, -50).pctAtRisk).toBeNull();
    // dollars still summed even when pct can't be expressed
    expect(aggregateTradeRisk(rows, 0).totalAtRisk).toBe(10);
  });
});

describe('warn thresholds', () => {
  it('are the named over-exposure constants', () => {
    expect(SINGLE_TRADE_RISK_WARN_PCT).toBe(10);
    expect(AGGREGATE_RISK_WARN_PCT).toBe(25);
  });
});
