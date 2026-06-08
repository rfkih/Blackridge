import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { BacktestEquityPoint, BacktestRun } from '@/types/backtest';
import type { CandleData } from '@/types/market';
import type { BtcStackPoint } from '@/lib/hedging/btcCompare';

const DAY = 86_400_000;

// --- backtest data hooks (the page's data sources) -------------------------
const useBacktestRun = vi.fn();
const useBacktestCandles = vi.fn();
const useBacktestEquityPoints = vi.fn();
const useBacktestTrades = vi.fn();
vi.mock('@/hooks/useBacktest', () => ({
  useBacktestRun: () => useBacktestRun(),
  useBacktestCandles: () => useBacktestCandles(),
  useBacktestEquityPoints: () => useBacktestEquityPoints(),
  useBacktestTrades: () => useBacktestTrades(),
  useBacktestProgressStream: () => undefined,
  useCancelBacktestRun: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useStrategies', () => ({
  useAccountStrategies: () => ({ data: [] }),
}));

// Chart-indicator hooks: stubbed like the other data hooks so the page test
// stays focused on the BTC-stack feed and doesn't need a QueryClientProvider.
vi.mock('@/hooks/useChartIndicators', () => ({
  useChartIndicators: () => ({
    indicators: {
      ema20: false,
      ema50: false,
      ema200: false,
      bollingerBands: false,
      keltnerChannel: false,
      rsi: false,
      macd: false,
      atr: false,
      adx: false,
    },
    toggle: vi.fn(),
    anyActive: false,
  }),
}));
vi.mock('@/hooks/useBacktestIndicators', () => ({
  useBacktestIndicators: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock('@/hooks/useEmaWarmupCandles', () => ({
  useEmaWarmupCandles: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('@/store/backtestParamStore', () => ({
  useBacktestParamStore: (sel: (s: { hydrateFromRun: () => void }) => unknown) =>
    sel({ hydrateFromRun: vi.fn() }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: any) => {
    const R = require('react');
    return R.createElement('a', rest, children);
  },
}));

// next/dynamic chart panels need a browser canvas jsdom lacks → stub them out.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

// Heavier sibling panels render nothing — we only care about the BTC-stack feed.
vi.mock('@/components/backtest/BacktestMetricsGrid', () => ({ BacktestMetricsGrid: () => null }));
vi.mock('@/components/backtest/BacktestMonthlyReturns', () => ({ BacktestMonthlyReturns: () => null }));
vi.mock('@/components/backtest/BacktestTradeTable', () => ({ BacktestTradeTable: () => null }));
vi.mock('@/components/backtest/FundingRatePanel', () => ({ FundingRatePanel: () => null }));
vi.mock('@/components/backtest/BacktestProgressBar', () => ({ BacktestProgressBar: () => null }));
vi.mock('@/components/research/AnalysisCard', () => ({ AnalysisCard: () => null }));
vi.mock('@/components/hedging/DrawdownVsBuyHoldPanel', () => ({
  DrawdownVsBuyHoldPanel: () => null,
}));

// Capture the series the page computes and feeds into the BTC-stack panel.
const stackSeriesSpy = vi.fn<(series: BtcStackPoint[] | null) => void>();
vi.mock('@/components/hedging/BtcStackPanel', () => ({
  BtcStackPanel: ({ series }: { series: BtcStackPoint[] | null }) => {
    stackSeriesSpy(series);
    return null;
  },
}));

import BacktestResultPage from './page';

function eqPoint(ts: number, equity: number): BacktestEquityPoint {
  return { ts, equity, drawdown: 0, drawdownPct: 0, assetValue: 0, cashBalance: equity };
}
function candle(timeSec: number, close: number): CandleData {
  return { time: timeSec, open: close, high: close, low: close, close, volume: 0 };
}

const RUN: Partial<BacktestRun> = {
  id: 'run-123456789',
  status: 'COMPLETED',
  symbol: 'BTCUSDT',
  interval: '1d',
  initialCapital: 100,
  strategyCode: 'LSR',
};

function mkQuery<T>(data: T, extra: Record<string, unknown> = {}) {
  return { data, isLoading: false, isError: false, refetch: vi.fn(), ...extra };
}

describe('BacktestResultPage — BTC-stack panel', () => {
  beforeEach(() => {
    stackSeriesSpy.mockReset();
    useBacktestRun.mockReturnValue(mkQuery(RUN));
    useBacktestTrades.mockReturnValue(mkQuery([]));
  });

  it('computes a BTC-stack series from equity + candles and passes it to the panel', () => {
    // Flat USD equity while BTC price doubles → stack halves to 0.5× by day 2.
    useBacktestEquityPoints.mockReturnValue(
      mkQuery([eqPoint(1 * DAY, 100), eqPoint(2 * DAY, 100)]),
    );
    useBacktestCandles.mockReturnValue(
      mkQuery([candle((1 * DAY) / 1000, 50_000), candle((2 * DAY) / 1000, 100_000)]),
    );

    render(<BacktestResultPage params={{ id: 'run-123456789' }} />);

    expect(stackSeriesSpy).toHaveBeenCalled();
    const series = stackSeriesSpy.mock.calls.at(-1)![0];
    expect(series).not.toBeNull();
    expect(series).toHaveLength(2);
    expect(series![0].stackMultiple).toBeCloseTo(1, 4);
    expect(series![1].stackMultiple).toBeCloseTo(0.5, 4);
  });

  it('passes null to the panel while equity/candles are still loading', () => {
    useBacktestEquityPoints.mockReturnValue(mkQuery(undefined, { isLoading: true }));
    useBacktestCandles.mockReturnValue(mkQuery(undefined, { isLoading: true }));

    render(<BacktestResultPage params={{ id: 'run-123456789' }} />);

    expect(stackSeriesSpy).toHaveBeenCalledWith(null);
  });
});
