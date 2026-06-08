import { describe, it, expect } from 'vitest';
import { mapBacktestTrade } from '../backtest';

/**
 * Regression: EMA_BAND-style strategies have no stop loss
 * (initial_stop_loss_price NULL, exit_reason EMABAND_EXIT). The mapper used to
 * coerce a null SL to 0 via Number(null) === 0, which the chart then drew as a
 * false stop-loss price-line at the chart bottom. A null SL must stay null.
 */
describe('mapBacktestTrade — stop loss nullability', () => {
  const base = {
    id: 't1',
    backtestRunId: 'r1',
    direction: 'LONG',
    entryTime: 1_700_000_000_000,
    entryPrice: 100,
    exitTime: 1_700_000_100_000,
    exitPrice: 110,
    tp1Price: null,
    tp2Price: null,
    quantity: 1,
    realizedPnl: 10,
    rMultiple: 1,
    positions: [],
  };

  it('keeps a null stop loss as null (no false 0)', () => {
    const t = { ...base, stopLossPrice: null } as never;
    expect(mapBacktestTrade(t).stopLossPrice).toBeNull();
  });

  it('parses a present stop loss from a wire string', () => {
    const t = { ...base, stopLossPrice: '123.5' } as never;
    expect(mapBacktestTrade(t).stopLossPrice).toBe(123.5);
  });

  it('parses a present stop loss from a number', () => {
    const t = { ...base, stopLossPrice: 95 } as never;
    expect(mapBacktestTrade(t).stopLossPrice).toBe(95);
  });
});
