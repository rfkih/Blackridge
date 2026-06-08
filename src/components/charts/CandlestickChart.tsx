'use client';

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { TV } from '@/lib/charts/chartTheme';
import {
  useChartIndicatorSeries,
  type IndicatorSeriesState,
} from '@/lib/charts/useChartIndicatorSeries';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';
import type { ChartIndicators, IndicatorData, CandleData } from '@/types/market';

const EMPTY_FEATURES: IndicatorData[] = [];

export interface CandlestickChartProps {
  candles: CandleData[];
  features?: IndicatorData[];
  showIndicators?: ChartIndicators;
  height?: number;
  onCandleClick?: (time: number) => void;
}

/**
 * Reusable TV Lightweight wrapper. Keeps the chart lifecycle (mount + resize +
 * tear-down) self-contained so the parent only has to hand over data and
 * toggle flags. Indicator overlays/oscillators are rendered by the shared
 * {@link useChartIndicatorSeries} renderer (overlays on the main pane,
 * oscillators in in-chart sub-panes via `chart.addPane()`), so this component
 * gains every indicator the shared layer supports for free.
 */
export function CandlestickChart({
  candles,
  features,
  showIndicators,
  height = 440,
  onCandleClick,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const tvRef = useRef<{
    LineSeries: unknown;
    HistogramSeries: unknown;
    LineStyle: { Dashed: number; Solid: number };
  } | null>(null);
  const indicatorStateRef = useRef<IndicatorSeriesState>({});

  const [ready, setReady] = useState(false);

  const onClickRef = useRef(onCandleClick);
  onClickRef.current = onCandleClick;

  // Tracks the latest candles so the async chart-init effect can seed them
  // immediately after the TV library loads, without needing another render.
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  useChartIndicatorSeries(
    chartRef,
    tvRef,
    indicatorStateRef,
    ready,
    showIndicators ?? DEFAULT_INDICATORS,
    features ?? EMPTY_FEATURES,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const tv = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;
      tvRef.current = tv;

      const chart = tv.createChart(containerRef.current, {
        height,
        layout: {
          background: { type: tv.ColorType.Solid, color: TV.BG },
          textColor: TV.TEXT,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: TV.GRID },
          horzLines: { color: TV.GRID },
        },
        crosshair: { mode: tv.CrosshairMode.Normal },
        rightPriceScale: { borderColor: TV.BORDER },
        timeScale: { borderColor: TV.BORDER, timeVisible: true, secondsVisible: false },
      });
      chartRef.current = chart;

      const cs = chart.addSeries(tv.CandlestickSeries, {
        upColor: TV.PROFIT,
        downColor: TV.LOSS,
        borderUpColor: TV.PROFIT,
        borderDownColor: TV.LOSS,
        wickUpColor: TV.PROFIT,
        wickDownColor: TV.LOSS,
      });
      candleSeriesRef.current = cs;

      // Seed candles that arrived before the TV library finished loading.
      const initialCandles = candlesRef.current;
      if (initialCandles.length > 0) {
        const seen = new Set<number>();
        const valid = initialCandles
          .filter((c) => Number.isFinite(c.time))
          .sort((a, b) => a.time - b.time)
          .filter((c) => {
            if (seen.has(c.time)) return false;
            seen.add(c.time);
            return true;
          });
        if (valid.length > 0) {
          cs.setData(
            valid.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            })),
          );
          chart.timeScale().fitContent();
        }
      }

      const clickHandler = (param: MouseEventParams<Time>) => {
        if (!param.time) return;
        const cb = onClickRef.current;
        if (cb) cb(param.time as number);
      };
      chart.subscribeClick(clickHandler);
      unsubs.push(() => {
        try {
          chart.unsubscribeClick(clickHandler);
        } catch {
          /* chart already disposed */
        }
      });

      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      ro.observe(containerRef.current);
      unsubs.push(() => ro.disconnect());

      // Signal readiness only after the candle series exists so the shared
      // indicator renderer never races the chart/candle init.
      setReady(true);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      unsubs.forEach((fn) => fn());

      chartRef.current?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      tvRef.current = null;
      indicatorStateRef.current = {};
    };
  }, [height]);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    const seen = new Set<number>();
    const valid = candles
      .filter((c) => Number.isFinite(c.time))
      .sort((a, b) => a.time - b.time)
      .filter((c) => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      });
    if (!valid.length) return;
    candleSeriesRef.current.setData(
      valid.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="w-full">
      <div ref={containerRef} style={{ height }} aria-hidden="true" />
    </div>
  );
}
