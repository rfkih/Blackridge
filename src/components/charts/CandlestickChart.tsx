'use client';

// TradingView Lightweight Charts is canvas-based and not SSR-safe, so this
// component is always loaded via dynamic({ ssr: false }) at its call site.

import { useEffect, useRef } from 'react';
import type {
  IChartApi,
  ISeriesApi,
  LineStyle,
  LogicalRange,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { TV } from '@/lib/charts/chartTheme';
import type { IndicatorData, CandleData } from '@/types/market';

export interface CandlestickChartIndicators {
  ema20?: boolean;
  ema50?: boolean;
  bollingerBands?: boolean;
  keltnerChannel?: boolean;
  rsi?: boolean;
}

export interface CandlestickChartProps {
  candles: CandleData[];
  features?: IndicatorData[];
  showIndicators?: CandlestickChartIndicators;
  height?: number;
  /** RSI subchart height. Defaults to 100px; only rendered when rsi=true. */
  rsiHeight?: number;
  onCandleClick?: (time: number) => void;
}

/**
 * Reusable TV Lightweight wrapper. Keeps the chart lifecycle (mount + resize +
 * tear-down) self-contained so the parent only has to hand over data and
 * toggle flags. Indicator overlays are rebuilt incrementally — removing a
 * toggled-off series instead of rebuilding the whole chart.
 */
export function CandlestickChart({
  candles,
  features,
  showIndicators,
  height = 440,
  rsiHeight = 100,
  onCandleClick,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Indicator series refs — kept separately so we can remove one without
  // rebuilding the others.
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kcUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kcLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSyncUnsubRef = useRef<(() => void) | null>(null);

  // Imperative handle holding the latest click callback so we don't rebind
  // the chart-click subscription when the parent re-renders.
  const onClickRef = useRef(onCandleClick);
  onClickRef.current = onCandleClick;

  // Keep a stable reference to LineStyle (loaded alongside the TV module).
  const lineStyleRef = useRef<typeof LineStyle | null>(null);

  // ── Effect 1: mount main + rsi charts ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const tv = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;
      lineStyleRef.current = tv.LineStyle;

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

      // Click handler — dispatches the candle's epoch-seconds time so the
      // parent can match it against its own data without caring about chart
      // internals.
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
          // Chart may already be torn down.
        }
      });

      // Resize with container.
      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
        if (rsiContainerRef.current && rsiChartRef.current) {
          rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);
      unsubs.push(() => ro.disconnect());
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
      // Tear down in reverse of creation order. Unsubscribe the timescale sync
      // BEFORE removing the main chart, otherwise the callback can run against
      // a freed timeScale handle.
      rsiSyncUnsubRef.current?.();
      rsiSyncUnsubRef.current = null;
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      kcUpperRef.current = null;
      kcLowerRef.current = null;
    };
  }, [height]);

  // ── Effect 2: candles ───────────────────────────────────────────────────────
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

  // ── Effect 3: overlay indicators ────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const LineStyleEnum = lineStyleRef.current;
    if (!chart || !LineStyleEnum) return;
    void (async () => {
      const tv = await import('lightweight-charts');
      const data = features ?? [];

      const linesToUpdate = (
        key: keyof Pick<
          IndicatorData,
          'ema20' | 'ema50' | 'bbUpper' | 'bbMiddle' | 'bbLower' | 'kcUpper' | 'kcLower'
        >,
      ) =>
        data
          .filter((d) => d[key] != null)
          .map((d) => ({ time: d.time as Time, value: d[key] as number }));

      // EMA20
      if (showIndicators?.ema20) {
        if (!ema20Ref.current) {
          ema20Ref.current = chart.addSeries(tv.LineSeries, {
            color: '#4E9EFF',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        }
        ema20Ref.current.setData(linesToUpdate('ema20'));
      } else if (ema20Ref.current) {
        chart.removeSeries(ema20Ref.current);
        ema20Ref.current = null;
      }

      // EMA50
      if (showIndicators?.ema50) {
        if (!ema50Ref.current) {
          ema50Ref.current = chart.addSeries(tv.LineSeries, {
            color: '#F5A623',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        }
        ema50Ref.current.setData(linesToUpdate('ema50'));
      } else if (ema50Ref.current) {
        chart.removeSeries(ema50Ref.current);
        ema50Ref.current = null;
      }

      // Bollinger Bands (upper + middle solid + lower)
      if (showIndicators?.bollingerBands) {
        const common = { color: '#8892A4', priceLineVisible: false, lastValueVisible: false };
        if (!bbUpperRef.current) {
          bbUpperRef.current = chart.addSeries(tv.LineSeries, {
            ...common,
            lineWidth: 1,
            lineStyle: LineStyleEnum.Dashed,
          });
        }
        if (!bbMiddleRef.current) {
          bbMiddleRef.current = chart.addSeries(tv.LineSeries, { ...common, lineWidth: 1 });
        }
        if (!bbLowerRef.current) {
          bbLowerRef.current = chart.addSeries(tv.LineSeries, {
            ...common,
            lineWidth: 1,
            lineStyle: LineStyleEnum.Dashed,
          });
        }
        bbUpperRef.current.setData(linesToUpdate('bbUpper'));
        bbMiddleRef.current.setData(linesToUpdate('bbMiddle'));
        bbLowerRef.current.setData(linesToUpdate('bbLower'));
      } else {
        for (const ref of [bbUpperRef, bbMiddleRef, bbLowerRef]) {
          if (ref.current) {
            chart.removeSeries(ref.current);
            ref.current = null;
          }
        }
      }

      // Keltner Channels (dashed upper + lower only — the "middle" basis is
      // intentionally omitted because it'd collide visually with EMA20).
      if (showIndicators?.keltnerChannel) {
        const common = {
          color: '#A855F7',
          lineWidth: 1 as const,
          lineStyle: LineStyleEnum.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        };
        if (!kcUpperRef.current) {
          kcUpperRef.current = chart.addSeries(tv.LineSeries, common);
        }
        if (!kcLowerRef.current) {
          kcLowerRef.current = chart.addSeries(tv.LineSeries, common);
        }
        kcUpperRef.current.setData(linesToUpdate('kcUpper'));
        kcLowerRef.current.setData(linesToUpdate('kcLower'));
      } else {
        for (const ref of [kcUpperRef, kcLowerRef]) {
          if (ref.current) {
            chart.removeSeries(ref.current);
            ref.current = null;
          }
        }
      }
    })();
  }, [
    features,
    showIndicators?.ema20,
    showIndicators?.ema50,
    showIndicators?.bollingerBands,
    showIndicators?.keltnerChannel,
  ]);

  // ── Effect 4: RSI sub-chart ────────────────────────────────────────────────
  useEffect(() => {
    const mainChart = chartRef.current;
    if (!mainChart) return;
    const shouldShow = Boolean(showIndicators?.rsi);
    if (!shouldShow) {
      rsiSyncUnsubRef.current?.();
      rsiSyncUnsubRef.current = null;
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      return;
    }
    if (!rsiContainerRef.current) return;

    void (async () => {
      const tv = await import('lightweight-charts');
      if (!rsiContainerRef.current) return;

      if (!rsiChartRef.current) {
        const rsiChart = tv.createChart(rsiContainerRef.current, {
          height: rsiHeight,
          layout: {
            background: { type: tv.ColorType.Solid, color: TV.BG },
            textColor: TV.TEXT,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
          },
          grid: { vertLines: { visible: false }, horzLines: { color: TV.GRID } },
          rightPriceScale: { borderColor: TV.BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: false } },
          handleScroll: false,
          handleScale: false,
        });
        rsiChartRef.current = rsiChart;

        const rsiSeries = rsiChart.addSeries(tv.LineSeries, {
          color: '#EC4899',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        rsiSeriesRef.current = rsiSeries;

        // Reference lines at 70/30.
        rsiSeries.createPriceLine({
          price: 70,
          color: TV.NEUTRAL,
          lineWidth: 1,
          lineStyle: tv.LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: TV.NEUTRAL,
          lineWidth: 1,
          lineStyle: tv.LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        });

        // Keep RSI's time scale locked to the main chart's. Track the
        // unsubscribe so we don't leak the handler on toggle.
        const syncHandler = (range: LogicalRange | null) => {
          if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
        };
        mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncHandler);
        rsiSyncUnsubRef.current = () => {
          try {
            mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncHandler);
          } catch {
            // Main chart may already be removed.
          }
        };
      }

      const data = (features ?? [])
        .filter((d) => d.rsi != null)
        .map((d) => ({ time: d.time as Time, value: d.rsi as number }));
      rsiSeriesRef.current?.setData(data);
    })();
  }, [showIndicators?.rsi, features, rsiHeight]);

  return (
    <div className="w-full">
      <div ref={containerRef} style={{ height }} aria-hidden="true" />
      {showIndicators?.rsi && (
        <div
          ref={rsiContainerRef}
          className="border-t border-[var(--border-subtle)]"
          style={{ height: rsiHeight }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
