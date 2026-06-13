import { describe, it, expect } from 'vitest';
import { liveTradeToBacktestTrade } from './liveTradeToBacktestTrade';
import type { Trades, TradePosition } from '@/types/trading';

function mkPosition(p: Partial<TradePosition> = {}): TradePosition {
  return {
    id: 'p1',
    tradeId: 't1',
    type: 'SINGLE',
    quantity: 1,
    entryPrice: 100,
    exitTime: null,
    exitPrice: null,
    exitReason: null,
    feeUsdt: 0.1,
    realizedPnl: 0,
    ...p,
  };
}

function mkTrade(t: Partial<Trades> = {}): Trades {
  return {
    id: 't1',
    accountId: 'a1',
    accountStrategyId: 'as1',
    strategyCode: 'DCB',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    status: 'CLOSED',
    entryTime: 1_000_000,
    entryPrice: 100,
    exitTime: 2_000_000,
    exitAvgPrice: 110,
    stopLossPrice: 90,
    tp1Price: 120,
    tp2Price: null,
    quantity: 2,
    realizedPnl: 20,
    unrealizedPnl: 0,
    feeUsdt: 0.5,
    positions: [],
    ...t,
  };
}

describe('liveTradeToBacktestTrade', () => {
  it('maps the core fields and renames exitAvgPrice → exitPrice', () => {
    const bt = liveTradeToBacktestTrade(mkTrade(), '1h');
    expect(bt.id).toBe('t1');
    expect(bt.backtestRunId).toBe('');
    expect(bt.strategyCode).toBe('DCB');
    expect(bt.strategyName).toBe('DCB');
    expect(bt.interval).toBe('1h');
    expect(bt.direction).toBe('LONG');
    expect(bt.entryTime).toBe(1_000_000);
    expect(bt.exitTime).toBe(2_000_000);
    expect(bt.exitPrice).toBe(110);
    expect(bt.tp1Price).toBe(120);
    expect(bt.tp2Price).toBeNull();
    expect(bt.quantity).toBe(2);
    expect(bt.realizedPnl).toBe(20);
  });

  it('derives a positive R-multiple for a LONG winner (move 10 / risk 10)', () => {
    const bt = liveTradeToBacktestTrade(mkTrade(), '1h');
    expect(bt.rMultiple).toBeCloseTo(1, 6);
  });

  it('derives R-multiple for a SHORT using the inverted move', () => {
    // entry 100, stop 110 (risk 10), exit 90 → favourable move 10 → +1R
    const bt = liveTradeToBacktestTrade(
      mkTrade({ direction: 'SHORT', stopLossPrice: 110, exitAvgPrice: 90 }),
      '1h',
    );
    expect(bt.rMultiple).toBeCloseTo(1, 6);
  });

  it('collapses a non-positive stop to null and yields NaN R (signal exit)', () => {
    const bt = liveTradeToBacktestTrade(mkTrade({ stopLossPrice: 0 }), '1h');
    expect(bt.stopLossPrice).toBeNull();
    expect(Number.isNaN(bt.rMultiple)).toBe(true);
  });

  it('yields NaN R for an open trade (no exit price)', () => {
    const bt = liveTradeToBacktestTrade(
      mkTrade({ status: 'OPEN', exitTime: null, exitAvgPrice: null }),
      '1h',
    );
    expect(bt.exitTime).toBeNull();
    expect(bt.exitPrice).toBeNull();
    expect(Number.isNaN(bt.rMultiple)).toBe(true);
  });

  it('maps position legs, dropping live-only entryPrice/feeUsdt', () => {
    const bt = liveTradeToBacktestTrade(
      mkTrade({
        positions: [
          mkPosition({
            id: 'leg1',
            type: 'SINGLE',
            exitTime: 2_000_000,
            exitPrice: 110,
            exitReason: 'TP_HIT',
            realizedPnl: 20,
          }),
        ],
      }),
      '4h',
    );
    expect(bt.positions).toHaveLength(1);
    expect(bt.positions[0]).toEqual({
      id: 'leg1',
      type: 'SINGLE',
      quantity: 1,
      exitTime: 2_000_000,
      exitPrice: 110,
      exitReason: 'TP_HIT',
      realizedPnl: 20,
    });
  });

  it('falls back strategyCode/strategyName to null when blank', () => {
    const bt = liveTradeToBacktestTrade(mkTrade({ strategyCode: '' }), '1h');
    expect(bt.strategyCode).toBeNull();
    expect(bt.strategyName).toBeNull();
  });
});
