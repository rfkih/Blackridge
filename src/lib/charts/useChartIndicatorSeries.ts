'use client';
import { useEffect, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ChartIndicators, ChartIndicatorKey, IndicatorData } from '@/types/market';
import { INDICATORS } from './indicatorConfig';

type AnySeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;
export type IndicatorSeriesState = Partial<Record<ChartIndicatorKey, AnySeries[]>>;

interface TvLike {
  LineSeries: unknown;
  HistogramSeries: unknown;
  LineStyle: { Dashed: number; Solid: number };
}

const FIELD_MAP: Record<ChartIndicatorKey, Array<{ field: keyof IndicatorData; color: string; dashed?: boolean; histogram?: boolean }>> = {
  ema20: [{ field: 'ema20', color: '#3B82F6' }],
  ema50: [{ field: 'ema50', color: '#F5A623' }],
  ema200: [{ field: 'ema200', color: '#A855F7' }],
  bollingerBands: [
    { field: 'bbUpper', color: '#8892A4', dashed: true },
    { field: 'bbMiddle', color: '#8892A4' },
    { field: 'bbLower', color: '#8892A4', dashed: true },
  ],
  keltnerChannel: [
    { field: 'kcUpper', color: '#22D3EE', dashed: true },
    { field: 'kcLower', color: '#22D3EE', dashed: true },
  ],
  rsi: [{ field: 'rsi', color: '#EC4899' }],
  macd: [
    { field: 'macd', color: '#34D399' },
    { field: 'macdSignal', color: '#F87171' },
    { field: 'macdHistogram', color: '#5B6472', histogram: true },
  ],
  atr: [{ field: 'atr', color: '#FBBF24' }],
  adx: [{ field: 'adx', color: '#60A5FA' }],
};

const GROUP = Object.fromEntries(INDICATORS.map((i) => [i.key, i.group])) as Record<ChartIndicatorKey, 'overlay' | 'oscillator'>;

function lineData(features: IndicatorData[], field: keyof IndicatorData) {
  return features
    .filter((d) => d[field] != null && Number.isFinite(d.time))
    .map((d) => ({ time: d.time as Time, value: d[field] as number }));
}

/** Pure reconciler — add/update/remove indicator series to match `active`. */
export function reconcileIndicatorSeries(
  chart: IChartApi,
  tv: TvLike,
  state: IndicatorSeriesState,
  active: ChartIndicators,
  features: IndicatorData[],
): void {
  for (const def of INDICATORS) {
    const key = def.key;
    const on = active[key];
    if (on) {
      let paneIndex = 0;
      if (GROUP[key] === 'oscillator' && !state[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pane = (chart as any).addPane?.();
        paneIndex = pane?.paneIndex?.() ?? Math.max(1, chart.panes().length - 1);
      }
      const specs = FIELD_MAP[key];
      if (!state[key]) {
        state[key] = specs.map((spec) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (chart as any).addSeries(
            spec.histogram ? tv.HistogramSeries : tv.LineSeries,
            {
              color: spec.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: GROUP[key] === 'oscillator',
              ...(spec.dashed ? { lineStyle: tv.LineStyle.Dashed } : {}),
            },
            GROUP[key] === 'oscillator' ? paneIndex : 0,
          ),
        );
      }
      state[key]!.forEach((series, i) => series.setData(lineData(features, specs[i].field) as never));
    } else if (state[key]) {
      state[key]!.forEach((series) => {
        try { chart.removeSeries(series); } catch { /* already gone */ }
      });
      delete state[key];
    }
  }
}

/** React wrapper: reconciles whenever features or active flags change. */
export function useChartIndicatorSeries(
  chartRef: MutableRefObject<IChartApi | null>,
  tvRef: MutableRefObject<TvLike | null>,
  stateRef: MutableRefObject<IndicatorSeriesState>,
  ready: boolean,
  active: ChartIndicators,
  features: IndicatorData[],
): void {
  useEffect(() => {
    const chart = chartRef.current;
    const tv = tvRef.current;
    if (!ready || !chart || !tv) return;
    reconcileIndicatorSeries(chart, tv, stateRef.current, active, features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, features, active.ema20, active.ema50, active.ema200, active.bollingerBands,
      active.keltnerChannel, active.rsi, active.macd, active.atr, active.adx]);
}
