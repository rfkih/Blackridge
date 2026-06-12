'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ChartIndicators, ChartIndicatorKey, IndicatorData } from '@/types/market';
import { INDICATORS, type IndicatorLineSpec } from './indicatorConfig';

type AnySeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;
export type IndicatorSeriesState = Partial<Record<ChartIndicatorKey, AnySeries[]>>;

interface TvLike {
  LineSeries: unknown;
  HistogramSeries: unknown;
  LineStyle: { Dashed: number; Solid: number };
}

const GUIDE_COLOR = '#5B6472';
const HIST_UP = '#34D399';
const HIST_DOWN = '#F87171';

type LinePoint = { time: Time; value: number; color?: string };

function buildData(features: IndicatorData[], spec: IndicatorLineSpec): LinePoint[] {
  return features
    .filter((d) => d[spec.field] != null && Number.isFinite(d.time))
    .map((d) => {
      const value = d[spec.field] as number;
      if (spec.histogram)
        return { time: d.time as Time, value, color: value >= 0 ? HIST_UP : HIST_DOWN };
      return { time: d.time as Time, value };
    });
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
    const isOscillator = def.group === 'oscillator';
    const datas = active[key] ? def.series.map((s) => buildData(features, s)) : [];
    const hasData = datas.some((d) => d.length > 0);

    if (active[key] && hasData) {
      if (!state[key]) {
        let paneIndex = 0;
        if (isOscillator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pane = (chart as any).addPane?.();
          paneIndex = pane?.paneIndex?.() ?? chart.panes().length;
        }
        state[key] = def.series.map((spec) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (chart as any).addSeries(
            spec.histogram ? tv.HistogramSeries : tv.LineSeries,
            {
              color: spec.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: isOscillator,
              ...(spec.dashed ? { lineStyle: tv.LineStyle.Dashed } : {}),
            },
            isOscillator ? paneIndex : 0,
          ),
        );
        // Reference guides (e.g. RSI 70/30, ADX 25) on the first series.
        if (isOscillator && def.guides && state[key]![0]) {
          for (const g of def.guides) {
            state[key]![0].createPriceLine({
              price: g,
              color: GUIDE_COLOR,
              lineWidth: 1,
              lineStyle: tv.LineStyle.Dashed as never,
              axisLabelVisible: true,
              title: String(g),
            });
          }
        }
      }
      state[key]!.forEach((series, i) => series.setData(datas[i] as never));
    } else if (state[key]) {
      // Toggled off, or no data available → remove the series (empty oscillator
      // panes are auto-dropped because addPane() does not preserve empty panes).
      state[key]!.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch {
          /* already gone */
        }
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
  }, [
    ready,
    features,
    active.ema20,
    active.ema50,
    active.ema100,
    active.ema200,
    active.bollingerBands,
    active.keltnerChannel,
    active.rsi,
    active.macd,
    active.atr,
    active.adx,
  ]);
}
