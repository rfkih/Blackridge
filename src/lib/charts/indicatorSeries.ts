// Helper functions for adding/removing TradingView indicator series.
// Only imported by dynamic({ ssr: false }) components — safe to import TV at top level.

import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
} from 'lightweight-charts';
import type { IndicatorData } from '@/types/market';

export type AnySeries = ISeriesApi<SeriesType>;

export interface BbSeries {
  upper: ISeriesApi<'Line'>;
  middle: ISeriesApi<'Line'>;
  lower: ISeriesApi<'Line'>;
}

export interface KcSeries {
  upper: ISeriesApi<'Line'>;
  lower: ISeriesApi<'Line'>;
}

export function safeRemove(chart: IChartApi, series: AnySeries | null): void {
  if (!series) return;
  try {
    chart.removeSeries(series);
  } catch {}
}

export function addEmaLine(
  chart: IChartApi,
  data: IndicatorData[],
  field: 'ema20' | 'ema50' | 'ema200',
  color: string,
): ISeriesApi<'Line'> {
  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  series.setData(
    data
      .filter((d) => d[field] != null)
      .map((d) => ({ time: d.time as Time, value: d[field] as number })),
  );
  return series;
}

export function addBbSeries(
  chart: IChartApi,
  data: IndicatorData[],
  color: string,
): BbSeries {
  const base = {
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
  const upper = chart.addSeries(LineSeries, { ...base, color, lineWidth: 1, lineStyle: 2 });
  const middle = chart.addSeries(LineSeries, { ...base, color, lineWidth: 1, lineStyle: 0 });
  const lower = chart.addSeries(LineSeries, { ...base, color, lineWidth: 1, lineStyle: 2 });

  const filtered = data.filter((d) => d.bbUpper != null);
  upper.setData(filtered.map((d) => ({ time: d.time as Time, value: d.bbUpper! })));
  middle.setData(filtered.map((d) => ({ time: d.time as Time, value: d.bbMiddle! })));
  lower.setData(filtered.map((d) => ({ time: d.time as Time, value: d.bbLower! })));

  return { upper, middle, lower };
}

export function addKcSeries(
  chart: IChartApi,
  data: IndicatorData[],
  color: string,
): KcSeries {
  const opts = {
    color,
    lineWidth: 1 as const,
    lineStyle: 2 as const,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
  const upper = chart.addSeries(LineSeries, opts);
  const lower = chart.addSeries(LineSeries, opts);

  const filtered = data.filter((d) => d.kcUpper != null);
  upper.setData(filtered.map((d) => ({ time: d.time as Time, value: d.kcUpper! })));
  lower.setData(filtered.map((d) => ({ time: d.time as Time, value: d.kcLower! })));

  return { upper, lower };
}
