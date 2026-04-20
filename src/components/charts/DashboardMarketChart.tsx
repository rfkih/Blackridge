'use client';

// TV is only ever loaded inside useEffect (client-only).
// The entire component is wrapped with dynamic({ ssr: false }) at usage site.

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  LogicalRange,
  MouseEventParams,
} from 'lightweight-charts';
import { ChartPanelShell } from './ChartPanelShell';
import { IntervalTabs } from './IntervalTabs';
import { IndicatorToggleBar } from './IndicatorToggleBar';
import { OhlcvReadout } from './OhlcvReadout';
import { SymbolPicker } from './SymbolPicker';
import { useMarketChart } from '@/hooks/useMarketChart';
import { TV, INDICATOR_COLORS } from '@/lib/charts/chartTheme';
import { safeRemove, addEmaLine, addBbSeries, addKcSeries } from '@/lib/charts/indicatorSeries';
import type { BbSeries, KcSeries } from '@/lib/charts/indicatorSeries';
import type { CandleData } from '@/types/market';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface OhlcvState {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prevClose: number | null;
  volume: number | null;
}

function LivePill({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block size-1.5 rounded-full"
        style={{
          backgroundColor: active ? 'var(--color-profit)' : 'var(--text-muted)',
          animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      <span className="font-mono text-[10px] text-[var(--text-muted)]">LIVE</span>
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded"
      style={{ height, background: 'var(--bg-elevated)' }}
      aria-hidden="true"
    />
  );
}

export function DashboardMarketChart() {
  const {
    symbol,
    setSymbol,
    interval,
    setInterval,
    indicators,
    toggleIndicator,
    candles,
    indicatorData,
    isLoadingCandles,
    isError,
    refetch,
  } = useMarketChart();

  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const mainChart = useRef<IChartApi | null>(null);
  const volChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);
  const macdChart = useRef<IChartApi | null>(null);

  // Series refs (typed with generic Time so they match TV v5 returns)
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbRef = useRef<BbSeries | null>(null);
  const kcRef = useRef<KcSeries | null>(null);
  const rsiSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLine = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignal = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHisto = useRef<ISeriesApi<'Histogram'> | null>(null);

  const candleMap = useRef<Map<number, CandleData>>(new Map());
  const [chartReady, setChartReady] = useState(false);
  const [ohlcv, setOhlcv] = useState<OhlcvState>({
    open: null, high: null, low: null, close: null, prevClose: null, volume: null,
  });

  // ── Effect 1: Create main + volume charts (per symbol) ──────────────────────
  useEffect(() => {
    if (!mainRef.current || !volRef.current) return;
    setChartReady(false);

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const tv = await import('lightweight-charts');
      if (cancelled || !mainRef.current || !volRef.current) return;

      const mc = tv.createChart(mainRef.current, {
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
        crosshair: {
          mode: tv.CrosshairMode.Normal,
          vertLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
          horzLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
        },
        rightPriceScale: {
          borderColor: TV.BORDER,
          scaleMargins: { top: 0.08, bottom: 0.05 },
        },
        timeScale: {
          borderColor: TV.BORDER,
          timeVisible: true,
          secondsVisible: false,
        },
      });
      mainChart.current = mc;

      const cs = mc.addSeries(tv.CandlestickSeries, {
        upColor: TV.PROFIT,
        downColor: TV.LOSS,
        borderUpColor: TV.PROFIT,
        borderDownColor: TV.LOSS,
        wickUpColor: TV.PROFIT,
        wickDownColor: TV.LOSS,
      });
      candleSeries.current = cs;

      // Volume chart
      const vc = tv.createChart(volRef.current!, {
        layout: {
          background: { type: tv.ColorType.Solid, color: TV.BG },
          textColor: TV.TEXT,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: { vertLines: { visible: false }, horzLines: { color: TV.GRID } },
        rightPriceScale: {
          borderColor: TV.BORDER,
          scaleMargins: { top: 0.1, bottom: 0 },
        },
        timeScale: { visible: false },
        crosshair: { vertLine: { labelVisible: false }, horzLine: { visible: false } },
        handleScroll: false,
        handleScale: false,
      });
      volChart.current = vc;
      volSeries.current = vc.addSeries(tv.HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Sync volume time scale
      const volHandler = (range: LogicalRange | null) => {
        if (range) vc.timeScale().setVisibleLogicalRange(range);
      };
      mc.timeScale().subscribeVisibleLogicalRangeChange(volHandler);
      unsubs.push(() => mc.timeScale().unsubscribeVisibleLogicalRangeChange(volHandler));

      // Crosshair → OHLCV readout
      const crosshairHandler = (param: MouseEventParams<Time>) => {
        if (!param.time) {
          const arr = Array.from(candleMap.current.values());
          const last = arr[arr.length - 1];
          if (last) {
            const prev = arr[arr.length - 2];
            setOhlcv({ open: last.open, high: last.high, low: last.low, close: last.close, prevClose: prev?.close ?? null, volume: last.volume });
          }
          return;
        }
        const key = typeof param.time === 'number' ? param.time : 0;
        const raw = candleMap.current.get(key);
        const arr = Array.from(candleMap.current.values());
        const idx = arr.findIndex((c) => c.time === key);
        const prevClose = idx > 0 ? arr[idx - 1]?.close ?? null : null;
        const d = param.seriesData.get(cs) as CandlestickData<Time> | undefined;
        if (d) setOhlcv({ open: d.open, high: d.high, low: d.low, close: d.close, prevClose, volume: raw?.volume ?? null });
      };
      mc.subscribeCrosshairMove(crosshairHandler);
      unsubs.push(() => mc.unsubscribeCrosshairMove(crosshairHandler));

      // ResizeObserver
      const ro = new ResizeObserver(() => {
        if (mainRef.current) mc.applyOptions({ width: mainRef.current.clientWidth });
        if (volRef.current) vc.applyOptions({ width: volRef.current.clientWidth });
        if (rsiRef.current && rsiChart.current) rsiChart.current.applyOptions({ width: rsiRef.current.clientWidth });
        if (macdRef.current && macdChart.current) macdChart.current.applyOptions({ width: macdRef.current.clientWidth });
      });
      if (wrapRef.current) ro.observe(wrapRef.current);
      unsubs.push(() => ro.disconnect());

      setChartReady(true);
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
      mainChart.current?.remove();
      volChart.current?.remove();
      mainChart.current = null;
      volChart.current = null;
      candleSeries.current = null;
      volSeries.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      bbRef.current = null;
      kcRef.current = null;
      setChartReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Effect 2: Update candle + volume data ────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !candles.length) return;

    // Guard: filter NaN, deduplicate, sort ascending — TV assertion requires this.
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

    candleMap.current = new Map(valid.map((c) => [c.time, c]));

    candleSeries.current?.setData(
      valid.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volSeries.current?.setData(
      valid.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0,200,150,0.5)' : 'rgba(255,77,106,0.5)',
      })),
    );

    const last = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    if (last) setOhlcv({ open: last.open, high: last.high, low: last.low, close: last.close, prevClose: prev?.close ?? null, volume: last.volume });
  }, [chartReady, candles]);

  // ── Effect 3: Overlay indicators ────────────────────────────────────────────
  useEffect(() => {
    const chart = mainChart.current;
    if (!chart || !chartReady) return;

    // ── EMA20
    if (indicators.ema20) {
      if (!ema20Ref.current && indicatorData.length) {
        ema20Ref.current = addEmaLine(chart, indicatorData, 'ema20', INDICATOR_COLORS.ema20);
      } else if (ema20Ref.current && indicatorData.length) {
        ema20Ref.current.setData(indicatorData.filter((d) => d.ema20 != null).map((d) => ({ time: d.time as Time, value: d.ema20! })));
      }
    } else if (ema20Ref.current) {
      safeRemove(chart, ema20Ref.current);
      ema20Ref.current = null;
    }

    // ── EMA50
    if (indicators.ema50) {
      if (!ema50Ref.current && indicatorData.length) {
        ema50Ref.current = addEmaLine(chart, indicatorData, 'ema50', INDICATOR_COLORS.ema50);
      } else if (ema50Ref.current && indicatorData.length) {
        ema50Ref.current.setData(indicatorData.filter((d) => d.ema50 != null).map((d) => ({ time: d.time as Time, value: d.ema50! })));
      }
    } else if (ema50Ref.current) {
      safeRemove(chart, ema50Ref.current);
      ema50Ref.current = null;
    }

    // ── EMA200
    if (indicators.ema200) {
      if (!ema200Ref.current && indicatorData.length) {
        ema200Ref.current = addEmaLine(chart, indicatorData, 'ema200', INDICATOR_COLORS.ema200);
      } else if (ema200Ref.current && indicatorData.length) {
        ema200Ref.current.setData(indicatorData.filter((d) => d.ema200 != null).map((d) => ({ time: d.time as Time, value: d.ema200! })));
      }
    } else if (ema200Ref.current) {
      safeRemove(chart, ema200Ref.current);
      ema200Ref.current = null;
    }

    // ── BB
    if (indicators.bb) {
      if (!bbRef.current && indicatorData.length) {
        bbRef.current = addBbSeries(chart, indicatorData, TV.NEUTRAL);
      } else if (bbRef.current && indicatorData.length) {
        const f = indicatorData.filter((d) => d.bbUpper != null);
        bbRef.current.upper.setData(f.map((d) => ({ time: d.time as Time, value: d.bbUpper! })));
        bbRef.current.middle.setData(f.map((d) => ({ time: d.time as Time, value: d.bbMiddle! })));
        bbRef.current.lower.setData(f.map((d) => ({ time: d.time as Time, value: d.bbLower! })));
      }
    } else if (bbRef.current) {
      safeRemove(chart, bbRef.current.upper);
      safeRemove(chart, bbRef.current.middle);
      safeRemove(chart, bbRef.current.lower);
      bbRef.current = null;
    }

    // ── KC
    if (indicators.kc) {
      if (!kcRef.current && indicatorData.length) {
        kcRef.current = addKcSeries(chart, indicatorData, '#14B8A6');
      } else if (kcRef.current && indicatorData.length) {
        const f = indicatorData.filter((d) => d.kcUpper != null);
        kcRef.current.upper.setData(f.map((d) => ({ time: d.time as Time, value: d.kcUpper! })));
        kcRef.current.lower.setData(f.map((d) => ({ time: d.time as Time, value: d.kcLower! })));
      }
    } else if (kcRef.current) {
      safeRemove(chart, kcRef.current.upper);
      safeRemove(chart, kcRef.current.lower);
      kcRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, indicators.ema20, indicators.ema50, indicators.ema200, indicators.bb, indicators.kc, indicatorData]);

  // ── Effect 4: RSI sub-chart ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady) return;
    if (!indicators.rsi) {
      rsiChart.current?.remove();
      rsiChart.current = null;
      rsiSeries.current = null;
      return;
    }
    if (!rsiRef.current || !indicatorData.length) return;

    void (async () => {
      const tv = await import('lightweight-charts');
      if (!rsiRef.current) return;

      if (!rsiChart.current) {
        const rc = tv.createChart(rsiRef.current, {
          height: 80,
          layout: { background: { type: tv.ColorType.Solid, color: TV.BG }, textColor: TV.TEXT, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
          grid: { vertLines: { visible: false }, horzLines: { color: TV.GRID } },
          rightPriceScale: { borderColor: TV.BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: false } },
          handleScroll: false,
          handleScale: false,
        });
        rsiChart.current = rc;
        const rs = rc.addSeries(tv.LineSeries, {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        rsiSeries.current = rs;

        // Sync
        const rsiHandler = (range: LogicalRange | null) => {
          if (range) rc.timeScale().setVisibleLogicalRange(range);
        };
        mainChart.current?.timeScale().subscribeVisibleLogicalRangeChange(rsiHandler);

        // OB/OS reference lines
        rs.createPriceLine({ price: 70, color: TV.NEUTRAL, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
        rs.createPriceLine({ price: 30, color: TV.NEUTRAL, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
      }

      rsiSeries.current?.setData(
        indicatorData.filter((d) => d.rsi != null).map((d) => ({ time: d.time as Time, value: d.rsi! })),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, indicators.rsi, indicatorData]);

  // ── Effect 5: MACD sub-chart ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady) return;
    if (!indicators.macd) {
      macdChart.current?.remove();
      macdChart.current = null;
      macdLine.current = null;
      macdSignal.current = null;
      macdHisto.current = null;
      return;
    }
    if (!macdRef.current || !indicatorData.length) return;

    void (async () => {
      const tv = await import('lightweight-charts');
      if (!macdRef.current) return;

      if (!macdChart.current) {
        const mc = tv.createChart(macdRef.current, {
          height: 80,
          layout: { background: { type: tv.ColorType.Solid, color: TV.BG }, textColor: TV.TEXT, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
          grid: { vertLines: { visible: false }, horzLines: { color: TV.GRID } },
          rightPriceScale: { borderColor: TV.BORDER, scaleMargins: { top: 0.15, bottom: 0.15 } },
          timeScale: { visible: false },
          crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: false } },
          handleScroll: false,
          handleScale: false,
        });
        macdChart.current = mc;
        macdHisto.current = mc.addSeries(tv.HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
        macdLine.current = mc.addSeries(tv.LineSeries, { color: INDICATOR_COLORS.macdLine, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        macdSignal.current = mc.addSeries(tv.LineSeries, { color: INDICATOR_COLORS.macdSignal, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

        const macdHandler = (range: LogicalRange | null) => {
          if (range) mc.timeScale().setVisibleLogicalRange(range);
        };
        mainChart.current?.timeScale().subscribeVisibleLogicalRangeChange(macdHandler);
      }

      const valid = indicatorData.filter((d) => d.macd != null);
      macdHisto.current?.setData(valid.map((d) => ({
        time: d.time as Time,
        value: d.macdHistogram ?? 0,
        color: (d.macdHistogram ?? 0) >= 0 ? INDICATOR_COLORS.macdUp : INDICATOR_COLORS.macdDown,
      })));
      macdLine.current?.setData(valid.map((d) => ({ time: d.time as Time, value: d.macd! })));
      macdSignal.current?.setData(valid.map((d) => ({ time: d.time as Time, value: d.macdSignal ?? 0 })));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, indicators.macd, indicatorData]);

  const handleRetry = useCallback(() => void refetch(), [refetch]);

  return (
    <ChartPanelShell
      headerLeft={<SymbolPicker value={symbol} onChange={setSymbol} />}
      headerRight={
        <div className="flex items-center gap-3">
          <IntervalTabs value={interval} onChange={setInterval} />
          <LivePill active={!isLoadingCandles && !isError} />
        </div>
      }
    >
      <div className="border-b border-[var(--border-subtle)]">
        <OhlcvReadout open={ohlcv.open} high={ohlcv.high} low={ohlcv.low} close={ohlcv.close} previousClose={ohlcv.prevClose} volume={ohlcv.volume} symbol={symbol} />
      </div>
      <div className="border-b border-[var(--border-subtle)]">
        <IndicatorToggleBar indicators={indicators} onToggle={toggleIndicator} />
      </div>

      <div ref={wrapRef} aria-label={`Candlestick chart for ${symbol} at ${interval} interval`} className="relative select-none">
        {isError ? (
          <div className="flex h-[380px] flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <AlertCircle size={20} />
            <span className="text-sm">Failed to load chart data</span>
            <button onClick={handleRetry} className="flex items-center gap-1.5 rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : (
          <>
            {isLoadingCandles && (
              <div className="absolute inset-0 z-10 p-2">
                <ChartSkeleton height={380} />
              </div>
            )}
            <div ref={mainRef} style={{ height: 380 }} aria-hidden="true" />
            <div ref={volRef} style={{ height: 80, opacity: indicators.vol ? 1 : 0.3, transition: 'opacity 200ms' }} className="border-t border-[var(--border-subtle)]" aria-hidden="true" />
            {indicators.rsi && <div ref={rsiRef} style={{ height: 80 }} className="border-t border-[var(--border-subtle)]" aria-hidden="true" />}
            {indicators.macd && <div ref={macdRef} style={{ height: 80 }} className="border-t border-[var(--border-subtle)]" aria-hidden="true" />}
          </>
        )}
      </div>
    </ChartPanelShell>
  );
}
