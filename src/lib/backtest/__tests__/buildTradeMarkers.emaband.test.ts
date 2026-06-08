import { describe, it, expect } from 'vitest';
import { buildTradeMarkers } from '../buildTradeMarkers';
import type { BacktestTrade, BacktestTradePosition } from '@/types/backtest';
import type { PositionExitReason } from '@/types/trading';

function makeTrade(exitReason: PositionExitReason): BacktestTrade {
  const pos: BacktestTradePosition = {
    id: 'pos-1',
    type: 'SINGLE',
    quantity: 1,
    exitTime: 1_700_000_900_000,
    exitPrice: 105,
    exitReason,
    realizedPnl: 5,
  };
  return {
    id: 'trade-1',
    backtestRunId: 'run-1',
    strategyCode: 'EMA_BAND',
    strategyName: 'EMA Band Hedge',
    interval: '1d',
    direction: 'LONG',
    entryTime: 1_700_000_000_000,
    entryPrice: 100,
    exitTime: 1_700_000_900_000,
    exitPrice: 105,
    stopLossPrice: 90,
    tp1Price: null,
    tp2Price: null,
    quantity: 1,
    realizedPnl: 5,
    rMultiple: 0.5,
    positions: [pos],
  };
}

describe('buildTradeMarkers — EMA_BAND buy/sell', () => {
  it('emits a BUY entry marker and a SELL marker for EMABAND_EXIT (SINGLE)', () => {
    const trade = makeTrade('EMABAND_EXIT');
    const { markers } = buildTradeMarkers([trade]);
    const texts = markers.map((m) => m.text);
    expect(texts).toContain('BUY');
    expect(texts).toContain('SELL');
  });

  it('never silently drops an exit marker for an unmapped reason (fallback)', () => {
    const trade = makeTrade('SOME_NEW_REASON' as unknown as PositionExitReason);
    const { markers } = buildTradeMarkers([trade]);
    // entry BUY + a fallback exit marker => at least 2 markers
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it('reports sizePct best-effort for entry and exit legs', () => {
    const trade = makeTrade('EMABAND_EXIT');
    const { meta } = buildTradeMarkers([trade]);
    const entry = meta.find((m) => m.kind === 'entry');
    const exit = meta.find((m) => m.kind === 'exit');
    expect(entry?.sizePct).toBe(1);
    expect(exit?.sizePct).toBe(1);
  });
});
