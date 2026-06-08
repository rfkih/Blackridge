import { describe, it, expect } from 'vitest';
import { reconcileIndicatorSeries, type IndicatorSeriesState } from '../useChartIndicatorSeries';
import { DEFAULT_INDICATORS } from '../indicatorConfig';
import type { IndicatorData } from '@/types/market';

function fakeTv() {
  const removed: string[] = [];
  const created: string[] = [];
  const paneCount = { n: 1 };
  const chart = {
    addSeries: (_type: unknown, _opts: unknown, paneIndex?: number) => {
      const id = `s${created.length}@${paneIndex ?? 0}`;
      created.push(id);
      return { setData: () => {}, _id: id } as never;
    },
    removeSeries: (s: { _id: string }) => removed.push(s._id),
    addPane: () => ({ paneIndex: () => paneCount.n++ }),
    panes: () => Array.from({ length: paneCount.n }, (_v, i) => ({ paneIndex: () => i })),
  };
  const tv = { LineSeries: 'Line', HistogramSeries: 'Hist', LineStyle: { Dashed: 2, Solid: 0 } };
  return { chart, tv, created, removed };
}

const FEATURES: IndicatorData[] = [
  { time: 1, ema20: 10, ema50: 11, ema200: 12, bbUpper: 13, bbMiddle: 12, bbLower: 11,
    kcUpper: 14, kcMiddle: 12, kcLower: 10, rsi: 55, macd: 1, macdSignal: 0.5,
    macdHistogram: 0.5, atr: 2, adx: 25 },
];

describe('reconcileIndicatorSeries', () => {
  it('creates overlay series on the main pane when toggled on', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: true }, FEATURES);
    expect(created.some((id) => id.endsWith('@0'))).toBe(true);
    expect(state.ema20).toBeTruthy();
  });
  it('removes a series when toggled off', () => {
    const { chart, tv, removed } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: true }, FEATURES);
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: false }, FEATURES);
    expect(removed.length).toBeGreaterThan(0);
    expect(state.ema20).toBeUndefined();
  });
  it('puts oscillators on a non-zero pane', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, rsi: true }, FEATURES);
    expect(created.some((id) => !id.endsWith('@0'))).toBe(true);
  });
});
