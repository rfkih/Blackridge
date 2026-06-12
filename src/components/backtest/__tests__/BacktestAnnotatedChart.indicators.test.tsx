import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BacktestAnnotatedChart } from '../BacktestAnnotatedChart';
import type { CandleData, IndicatorData } from '@/types/market';

vi.mock('lightweight-charts', () => {
  const series = {
    setData: vi.fn(),
    setMarkers: vi.fn(),
    createPriceLine: vi.fn(),
    removePriceLine: vi.fn(),
    priceToCoordinate: vi.fn(() => 0),
  };
  const chart = {
    addSeries: vi.fn(() => series),
    removeSeries: vi.fn(),
    addPane: vi.fn(() => ({ paneIndex: () => 1 })),
    panes: vi.fn(() => [{ paneIndex: () => 0 }, { paneIndex: () => 1 }]),
    timeScale: () => ({
      fitContent: vi.fn(),
      setVisibleRange: vi.fn(),
      timeToCoordinate: vi.fn(() => 0),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    }),
    subscribeClick: vi.fn(),
    unsubscribeClick: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  };
  return {
    createChart: () => chart,
    createSeriesMarkers: () => series,
    CandlestickSeries: 'C',
    LineSeries: 'L',
    HistogramSeries: 'H',
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Normal: 0 },
    LineStyle: { Dashed: 2, Solid: 0 },
  };
});

const candles: CandleData[] = [{ time: 1, open: 1, high: 2, low: 1, close: 1.5, volume: 10 }];

describe('BacktestAnnotatedChart indicators', () => {
  it('renders without features (regression: no indicators)', () => {
    const { container } = render(
      <BacktestAnnotatedChart
        candles={candles}
        trades={[]}
        selectedTradeId={null}
        onTradeSelect={() => {}}
      />,
    );
    expect(container).toBeTruthy();
  });

  it('accepts features + showIndicators without throwing', () => {
    const features: IndicatorData[] = [
      {
        time: 1,
        ema20: 1.4,
        ema50: null,
        ema100: null,
        ema200: null,
        bbUpper: null,
        bbMiddle: null,
        bbLower: null,
        kcUpper: null,
        kcMiddle: null,
        kcLower: null,
        rsi: 55,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr: null,
        adx: null,
      },
    ];
    const { container } = render(
      <BacktestAnnotatedChart
        candles={candles}
        trades={[]}
        selectedTradeId={null}
        onTradeSelect={() => {}}
        features={features}
        showIndicators={{
          ema20: true,
          ema50: false,
          ema100: false,
          ema200: false,
          bollingerBands: false,
          keltnerChannel: false,
          rsi: true,
          macd: false,
          atr: false,
          adx: false,
        }}
      />,
    );
    expect(container).toBeTruthy();
  });
});
