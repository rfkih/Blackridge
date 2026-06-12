import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Trades, TradePosition } from '@/types/trading';

import { useRebalances } from './useRebalances';

// --- mock the underlying trades-list read ---
const useTradesList = vi.fn();

vi.mock('./useTrades', () => ({
  useTradesList: (...args: unknown[]) => useTradesList(...args),
}));

const ACCOUNT_ID = 'acct-1';

function mkPosition(overrides: Partial<TradePosition> = {}): TradePosition {
  return {
    id: 'pos-1',
    tradeId: 'tr-1',
    type: 'SINGLE',
    quantity: 0.1,
    entryPrice: 60_000,
    exitTime: 1_700_000_500_000,
    exitPrice: 65_000,
    exitReason: 'RUNNER_CLOSE',
    feeUsdt: 1,
    realizedPnl: 500,
    ...overrides,
  };
}

function mkTrade(overrides: Partial<Trades> = {}): Trades {
  return {
    id: 'tr-1',
    accountId: ACCOUNT_ID,
    accountStrategyId: 'as-1',
    strategyCode: 'ENSEMBLE_TREND',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    status: 'CLOSED',
    entryTime: 1_700_000_000_000,
    entryPrice: 60_000,
    exitTime: 1_700_000_500_000,
    exitAvgPrice: 65_000,
    stopLossPrice: 0,
    tp1Price: null,
    tp2Price: null,
    quantity: 0.1,
    realizedPnl: 500,
    unrealizedPnl: 0,
    feeUsdt: 1,
    markPrice: null,
    unrealizedPnlPct: null,
    positions: [mkPosition()],
    ...overrides,
  };
}

describe('useRebalances', () => {
  beforeEach(() => {
    useTradesList.mockReset();
  });

  it('forwards the account id as a CLOSED-trades filter to the trades hook', () => {
    useTradesList.mockReturnValue({ data: { content: [] }, isLoading: false, isError: false });
    renderHook(() => useRebalances(ACCOUNT_ID));
    expect(useTradesList).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, status: 'CLOSED' }),
    );
  });

  it('maps a closed trade into a rebalance event with realized delta and reason', () => {
    useTradesList.mockReturnValue({
      data: { content: [mkTrade()] },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRebalances(ACCOUNT_ID));
    expect(result.current.data).toHaveLength(1);
    const ev = result.current.data[0];
    expect(ev.id).toBe('tr-1');
    expect(ev.time).toBe(1_700_000_500_000);
    expect(ev.realizedDelta).toBe(500);
    // de-risk: a profitable BTC close trims the BTC leg back toward cash;
    // reason derives from the leg's exit reason, humanized (RUNNER_CLOSE → "runner close")
    expect(ev.reason).toMatch(/de-risk|trim|runner close/i);
    // the app does not expose the weight before/after each rebalance — null, not faked
    expect(ev.fromWeightPct).toBeNull();
    expect(ev.toWeightPct).toBeNull();
  });

  it('orders events newest-first by time', () => {
    useTradesList.mockReturnValue({
      data: {
        content: [mkTrade({ id: 'old', exitTime: 1_000 }), mkTrade({ id: 'new', exitTime: 9_000 })],
      },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRebalances(ACCOUNT_ID));
    expect(result.current.data.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('falls back to entryTime when a closed trade has no exitTime', () => {
    useTradesList.mockReturnValue({
      data: {
        content: [mkTrade({ exitTime: null, entryTime: 4_242 })],
      },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRebalances(ACCOUNT_ID));
    expect(result.current.data[0].time).toBe(4_242);
  });

  it('returns an empty array (never undefined) when there are no trades', () => {
    useTradesList.mockReturnValue({
      data: { content: [] },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useRebalances(ACCOUNT_ID));
    expect(result.current.data).toEqual([]);
  });

  it('passes through loading and error states', () => {
    useTradesList.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    expect(renderHook(() => useRebalances(ACCOUNT_ID)).result.current.isLoading).toBe(true);

    useTradesList.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const errd = renderHook(() => useRebalances(ACCOUNT_ID)).result.current;
    expect(errd.isError).toBe(true);
    expect(errd.data).toEqual([]);
  });
});
