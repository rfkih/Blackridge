import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { EquityPoint, CandleData } from '@/types/market';

const fetchCandles = vi.fn();
vi.mock('@/lib/api/market', () => ({
  fetchCandles: (...a: unknown[]) => fetchCandles(...a),
}));

import { useBtcBuyHold } from './useBtcBuyHold';

const DAY = 86_400_000;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function eq(time: number, equity: number, drawdown = 0): EquityPoint {
  return { time, equity, drawdown };
}
function candle(timeSec: number, close: number): CandleData {
  return { time: timeSec, open: close, high: close, low: close, close, volume: 0 };
}

describe('useBtcBuyHold', () => {
  beforeEach(() => fetchCandles.mockReset());

  it('returns null series and does not fetch when there is no equity history', () => {
    const { result } = renderHook(() => useBtcBuyHold([], '30D'), { wrapper });
    expect(result.current.strategyDrawdown).toBeNull();
    expect(result.current.buyHoldDrawdown).toBeNull();
    expect(result.current.btcStack).toBeNull();
    expect(fetchCandles).not.toHaveBeenCalled();
  });

  it('builds strategy + buy-hold drawdown and a BTC-stack series from equity + BTC closes', async () => {
    fetchCandles.mockResolvedValue([
      // TV seconds; price doubles over the window
      candle((1 * DAY) / 1000, 50_000),
      candle((2 * DAY) / 1000, 100_000),
    ]);

    const points: EquityPoint[] = [eq(1 * DAY, 100), eq(2 * DAY, 100)];
    const { result } = renderHook(() => useBtcBuyHold(points, '30D'), { wrapper });

    await waitFor(() => expect(result.current.buyHoldDrawdown).not.toBeNull());

    expect(fetchCandles).toHaveBeenCalledWith('BTCUSDT', '1d', expect.any(Number));

    // strategy flat → 0 drawdown throughout
    expect(result.current.strategyDrawdown).toHaveLength(2);
    expect(result.current.strategyDrawdown!.every((p) => p.drawdownPct === 0)).toBe(true);

    // buy-hold rose (price doubled) → still 0 drawdown (monotonic up)
    expect(result.current.buyHoldDrawdown).toHaveLength(2);

    // BTC stack: flat USD equity while price doubled → stack halves to 0.5×
    expect(result.current.btcStack).toHaveLength(2);
    expect(result.current.btcStack![1].stackMultiple).toBeCloseTo(0.5, 4);
  });

  it('exposes a one-line verdict comparing the strategy drawdown to buy-hold', async () => {
    fetchCandles.mockResolvedValue([
      candle((1 * DAY) / 1000, 100_000),
      candle((2 * DAY) / 1000, 50_000), // BTC halves → -50% buy-hold drawdown
    ]);
    // strategy only draws down 10%
    const points: EquityPoint[] = [eq(1 * DAY, 100, 0), eq(2 * DAY, 90, -10)];
    const { result } = renderHook(() => useBtcBuyHold(points, '30D'), { wrapper });

    await waitFor(() => expect(result.current.verdict).not.toBeNull());
    // cut roughly 80% of buy-hold's drawdown (10 vs 50)
    expect(result.current.verdict?.ddCutPct).toBeCloseTo(80, 0);
  });
});
