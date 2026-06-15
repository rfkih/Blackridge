'use client';

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { useChartTheme } from '@/lib/charts/useChartTheme';
import {
  useChartIndicatorSeries,
  type IndicatorSeriesState,
} from '@/lib/charts/useChartIndicatorSeries';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';
import { useFeaturesWithComputedEma } from '@/lib/charts/useFeaturesWithComputedEma';
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
 *
 * Theming: chart chrome colors come from {@link useChartTheme} (resolved from
 * the live CSS vars), not the frozen-dark TV constant. The build effect reads
 * the latest colors via `themeRef` (so it never bakes in the SSR dark fallback
 * if the theme resolves mid-async-import), and a separate effect re-applies on
 * theme flip without rebuilding the chart.
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
    ColorType: { Solid: unknown };
  } | null>(null);
  const indicatorStateRef = useRef<IndicatorSeriesState>({});

  const [ready, setReady] = useState(false);

  // Theme-aware chart colors; themeRef tracks the latest so the async build
  // effect reads the resolved theme (not the dark fallback) at creation time.
  const { TV } = useChartTheme();
  const themeRef = useRef(TV);
  themeRef.current = TV;

  const onClickRef = useRef(onCandleClick);
  onClickRef.current = onCandleClick;

  // Tracks the latest candles so the async chart-init effect can seed them
  // immediately after the TV library loads, without needing another render.
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const augmentedFeatures = useFeaturesWithComputedEma(candles, features ?? EMPTY_FEATURES);

  useChartIndicatorSeries(
    chartRef,
    tvRef,
    indicatorStateRef,
    ready,
    showIndicators ?? DEFAULT_INDICATORS,
    augmentedFeatures,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const tv = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;
      tvRef.current = tv;

      // Read the latest resolved theme at build time (post async import).
      const c = themeRef.current;
      const chart = tv.createChart(containerRef.current, {
        height,
        layout: {
          background: { type: tv.ColorType.Solid, color: c.BG },
          textColor: c.TEXT,
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: c.GRID },
          horzLines: { color: c.GRID },
        },
        crosshair: { mode: tv.CrosshairMode.Normal },
        rightPriceScale: { borderColor: c.BORDER },
        timeScale: { borderColor: c.BORDER, timeVisible: true, secondsVisible: false },
      });
      chartRef.current = chart;

      const cs = chart.addSeries(tv.CandlestickSeries, {
        upColor: c.PROFIT,
        downColor: c.LOSS,
        borderUpColor: c.PROFIT,
        borderDownColor: c.LOSS,
        wickUpColor: c.PROFIT,
        wickDownColor: c.LOSS,
      });
      candleSeriesRef.current = cs;

      // Seed candles that arrived before the TV library finished loading.
      const initialCandles = candlesRef.current;
      if (initialCandles.length > 0) {
        const seen = new Set<number>();
        const valid = initialCandles
          .filter((cd) => Number.isFinite(cd.time))
          .sort((a, b) => a.time - b.time)
          .filter((cd) => {
            if (seen.has(cd.time)) return false;
            seen.add(cd.time);
            return true;
          });
        if (valid.length > 0) {
          cs.setData(
            valid.map((cd) => ({
              time: cd.time as Time,
              open: cd.open,
              high: cd.high,
              low: cd.low,
              close: cd.close,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Re-apply chrome + candle colors when the theme flips, without rebuilding.
  useEffect(() => {
    const chart = chartRef.current;
    const tv = tvRef.current;
    if (!chart || !tv) return;
    chart.applyOptions({
      layout: { background: { type: tv.ColorType.Solid as never, color: TV.BG }, textColor: TV.TEXT },
      grid: { vertLines: { color: TV.GRID }, horzLines: { color: TV.GRID } },
      rightPriceScale: { borderColor: TV.BORDER },
      timeScale: { borderColor: TV.BORDER },
    });
    candleSeriesRef.current?.applyOptions({
      upColor: TV.PROFIT,
      downColor: TV.LOSS,
      borderUpColor: TV.PROFIT,
      borderDownColor: TV.LOSS,
      wickUpColor: TV.PROFIT,
      wickDownColor: TV.LOSS,
    });
  }, [TV]);

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
