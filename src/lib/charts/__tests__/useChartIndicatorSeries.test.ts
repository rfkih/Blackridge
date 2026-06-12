import { describe, it, expect } from 'vitest';
import { reconcileIndicatorSeries, type IndicatorSeriesState } from '../useChartIndicatorSeries';
import { DEFAULT_INDICATORS } from '../indicatorConfig';
import type { IndicatorData } from '@/types/market';

function fakeTv() {
  const removed: string[] = [];
  const created: string[] = [];
  const priceLines: number[] = [];
  const paneCount = { n: 1 };
  const chart = {
    addSeries: (_type: unknown, _opts: unknown, paneIndex?: number) => {
      const id = `s${created.length}@${paneIndex ?? 0}`;
      created.push(id);
      return {
        setData: () => {},
        createPriceLine: (o: { price: number }) => priceLines.push(o.price),
        _id: id,
      } as never;
    },
    removeSeries: (s: { _id: string }) => removed.push(s._id),
    addPane: () => ({ paneIndex: () => paneCount.n++ }),
    panes: () => Array.from({ length: paneCount.n }, (_v, i) => ({ paneIndex: () => i })),
  };
  const tv = { LineSeries: 'Line', HistogramSeries: 'Hist', LineStyle: { Dashed: 2, Solid: 0 } };
  return { chart, tv, created, removed, priceLines };
}

const FEATURES: IndicatorData[] = [
  {
    time: 1,
    ema20: 10,
    ema50: 11,
    ema100: 11.5,
    ema200: 12,
    bbUpper: 13,
    bbMiddle: 12,
    bbLower: 11,
    kcUpper: 14,
    kcMiddle: 12,
    kcLower: 10,
    rsi: 55,
    macd: 1,
    macdSignal: 0.5,
    macdHistogram: 0.5,
    atr: 2,
    adx: 25,
  },
];

describe('reconcileIndicatorSeries', () => {
  it('creates overlay series on the main pane when toggled on', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, ema20: true },
      FEATURES,
    );
    expect(created.some((id) => id.endsWith('@0'))).toBe(true);
    expect(state.ema20).toBeTruthy();
  });
  it('removes a series when toggled off', () => {
    const { chart, tv, removed } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, ema20: true },
      FEATURES,
    );
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, ema20: false },
      FEATURES,
    );
    expect(removed.length).toBeGreaterThan(0);
    expect(state.ema20).toBeUndefined();
  });
  it('puts oscillators on a non-zero pane', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, rsi: true },
      FEATURES,
    );
    expect(created.some((id) => !id.endsWith('@0'))).toBe(true);
  });
  it('does NOT create a series/pane when the indicator data is all null (empty-data guard)', () => {
    const { chart, tv, created } = fakeTv();
    const EMPTY: IndicatorData[] = [
      {
        time: 1,
        ema20: null,
        ema50: null,
        ema100: null,
        ema200: null,
        bbUpper: null,
        bbMiddle: null,
        bbLower: null,
        kcUpper: null,
        kcMiddle: null,
        kcLower: null,
        rsi: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr: null,
        adx: null,
      },
    ];
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, adx: true },
      EMPTY,
    );
    expect(created.length).toBe(0);
    expect(state.adx).toBeUndefined();
  });
  it('draws RSI 70/30 guide lines', () => {
    const { chart, tv, priceLines } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, rsi: true },
      FEATURES,
    );
    expect(priceLines).toEqual([70, 30]);
  });
  it('removes a series when its data disappears on a later reconcile', () => {
    const { chart, tv, removed } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, rsi: true },
      FEATURES,
    );
    const nullRsi = FEATURES.map((f) => ({ ...f, rsi: null }));
    reconcileIndicatorSeries(
      chart as never,
      tv as never,
      state,
      { ...DEFAULT_INDICATORS, rsi: true },
      nullRsi,
    );
    expect(removed.length).toBeGreaterThan(0);
    expect(state.rsi).toBeUndefined();
  });
});
