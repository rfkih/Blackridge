'use client';

// TradingView Lightweight Charts is imported dynamically inside useEffect.
// The module is not safe under SSR, so the parent dynamic()-imports this
// component with ssr: false.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { TV } from '@/lib/charts/chartTheme';
import { buildTradeMarkers, legHitMap, type MarkerMeta } from '@/lib/backtest/buildTradeMarkers';
import { formatPnl, formatPrice } from '@/lib/formatters';
import type { BacktestTrade } from '@/types/backtest';
import type { CandleData } from '@/types/market';

interface BacktestAnnotatedChartProps {
  candles: CandleData[];
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
  /** Drives imperative scroll-to on selection (non-null when selection came from the table). */
  scrollTrigger?: number;
  height?: number;
}

interface HoverState {
  tradeId: string;
  x: number;
  y: number;
}

export function BacktestAnnotatedChart({
  candles,
  trades,
  selectedTradeId,
  onTradeSelect,
  scrollTrigger,
  height = 500,
}: BacktestAnnotatedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]);

  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Compute markers + lookup maps. Memoised on trades only, never on
  // selectedTradeId — setMarkers is an O(n) redraw, so we keep it off the
  // selection path (see selection effect below).
  const { markers, metaByTime } = useMemo(() => {
    const built = buildTradeMarkers(trades);
    const map = new Map<number, MarkerMeta[]>();
    for (const m of built.meta) {
      const bucket = map.get(m.time);
      if (bucket) bucket.push(m);
      else map.set(m.time, [m]);
    }
    return { markers: built.markers, metaByTime: map };
  }, [trades]);

  const tradeById = useMemo(() => {
    const m = new Map<string, BacktestTrade>();
    for (const t of trades) m.set(t.id, t);
    return m;
  }, [trades]);

  // Keep the click/crosshair handlers referencing the latest marker maps via a
  // ref so we can subscribe once and still resolve against the current set.
  const clickCtxRef = useRef({ metaByTime, onTradeSelect, series: seriesRef });
  clickCtxRef.current = { metaByTime, onTradeSelect, series: seriesRef };

  // Subscribe refs that span effects.
  const crosshairRef = useRef<((param: MouseEventParams<Time>) => void) | null>(null);
  const clickUnsubRef = useRef<(() => void) | null>(null);

  // ── Effect 1: mount the chart ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const tv = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

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
        crosshair: {
          mode: tv.CrosshairMode.Normal,
          vertLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
          horzLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
        },
        rightPriceScale: { borderColor: TV.BORDER },
        timeScale: {
          borderColor: TV.BORDER,
          timeVisible: true,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      const series = chart.addSeries(tv.CandlestickSeries, {
        upColor: TV.PROFIT,
        downColor: TV.LOSS,
        borderUpColor: TV.PROFIT,
        borderDownColor: TV.LOSS,
        wickUpColor: TV.PROFIT,
        wickDownColor: TV.LOSS,
      });
      seriesRef.current = series;

      // TV v5: markers are a plugin bolted onto a series, not a method on it.
      markersPluginRef.current = tv.createSeriesMarkers(series, []);

      // ── Click: resolve to a marker and toggle selection. When multiple
      // markers share a candle (multi-leg trades), pick the one whose price is
      // closest to the clicked y-coordinate so the user lands on the leg they
      // actually clicked.
      const clickHandler = (param: MouseEventParams<Time>) => {
        const ctx = clickCtxRef.current;
        if (!param.time) {
          ctx.onTradeSelect(null);
          return;
        }
        const bucket = ctx.metaByTime.get(param.time as number);
        if (!bucket?.length) {
          ctx.onTradeSelect(null);
          return;
        }
        let chosen = bucket[0];
        const series = ctx.series.current;
        if (bucket.length > 1 && series && param.point) {
          const clickedPrice = series.coordinateToPrice(param.point.y);
          if (clickedPrice != null && Number.isFinite(clickedPrice)) {
            let bestDist = Infinity;
            for (const m of bucket) {
              const d = Math.abs(m.price - clickedPrice);
              if (d < bestDist) {
                bestDist = d;
                chosen = m;
              }
            }
          }
        }
        ctx.onTradeSelect(chosen.tradeId);
      };
      chart.subscribeClick(clickHandler);
      clickUnsubRef.current = () => {
        try {
          chart.unsubscribeClick(clickHandler);
        } catch {
          // Chart may already be removed.
        }
      };

      // ── Resize with the container.
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);
      unsubs.push(() => ro.disconnect());

      if (cancelled) return;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
      clickUnsubRef.current?.();
      clickUnsubRef.current = null;
      // Price lines live on the series — dropping the chart drops them too.
      priceLineRefs.current = [];
      markersPluginRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setReady(false);
    };
  }, [height]);

  // ── Effect 2: load candles ────────────────────────────────────────────────
  // getBacktestCandles already filters NaN and sorts ascending. We do one
  // linear pass to drop duplicate timestamps (TV rejects them) but skip the
  // O(n log n) re-sort the earlier version performed every refetch.
  useEffect(() => {
    if (!ready || !candles.length || !seriesRef.current) return;
    const seen = new Set<number>();
    const valid: typeof candles = [];
    for (const c of candles) {
      if (seen.has(c.time)) continue;
      seen.add(c.time);
      valid.push(c);
    }
    if (!valid.length) return;
    seriesRef.current.setData(
      valid.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [ready, candles]);

  // ── Effect 3: apply markers. Only depends on the marker array. ────────────
  useEffect(() => {
    if (!ready) return;
    markersPluginRef.current?.setMarkers(markers);
  }, [ready, markers]);

  // ── Effect 4: SL / TP price lines for the selected trade ──────────────────
  useEffect(() => {
    if (!ready || !seriesRef.current) return;
    const series = seriesRef.current;

    // Remove whatever was drawn last.
    for (const line of priceLineRefs.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // Series may have been torn down — ignore.
      }
    }
    priceLineRefs.current = [];

    if (!selectedTradeId) return;
    const trade = tradeById.get(selectedTradeId);
    if (!trade) return;

    // Import LineStyle lazily; it's part of the same module we already loaded.
    void (async () => {
      const { LineStyle } = await import('lightweight-charts');
      if (!seriesRef.current) return;
      const activeSeries = seriesRef.current;

      const add = (price: number | null | undefined, color: string, title: string) => {
        if (price == null || !Number.isFinite(price)) return;
        const line = activeSeries.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        });
        priceLineRefs.current.push(line);
      };

      add(trade.stopLossPrice, '#FF4D6A', 'SL');
      add(trade.tp1Price, '#00C896', 'TP1');
      add(trade.tp2Price, '#00E5B0', 'TP2');
      add(trade.entryPrice, '#4E9EFF', 'ENTRY');
    })();
  }, [ready, selectedTradeId, tradeById]);

  // ── Effect 5: scroll to the selected trade when a scroll is requested. ────
  // Use setVisibleRange so we can centre regardless of the current scroll
  // position. timeToCoordinate would only work if the trade is already
  // on-screen, which defeats the purpose of "scroll to it".
  useEffect(() => {
    if (!ready || !scrollTrigger || !selectedTradeId) return;
    const trade = tradeById.get(selectedTradeId);
    if (!trade) return;
    const chart = chartRef.current;
    if (!chart) return;

    const entrySec = Math.floor(trade.entryTime / 1000);
    const exitSec = trade.exitTime != null ? Math.floor(trade.exitTime / 1000) : entrySec;
    // Pad either side so the trade isn't pinned to the edge. Fall back to one
    // hour for instant in/out trades so the visible range never collapses to zero.
    const span = Math.max(exitSec - entrySec, 60 * 60);
    const pad = Math.max(span * 0.5, 60 * 60);
    chart.timeScale().setVisibleRange({
      from: (entrySec - pad) as Time,
      to: (exitSec + pad) as Time,
    });
  }, [ready, scrollTrigger, selectedTradeId, tradeById]);

  // ── Effect 6: crosshair tooltip. Rebind when the marker index changes. ────
  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    if (!chart) return;

    const handler = (param: MouseEventParams<Time>) => {
      if (!param.point || !param.time) {
        setHover(null);
        return;
      }
      const bucket = metaByTime.get(param.time as number);
      if (!bucket?.length) {
        setHover(null);
        return;
      }
      // Same disambiguation as the click handler — pick the leg whose price is
      // closest to the cursor's price.
      let chosen = bucket[0];
      const series = seriesRef.current;
      if (bucket.length > 1 && series) {
        const cursorPrice = series.coordinateToPrice(param.point.y);
        if (cursorPrice != null && Number.isFinite(cursorPrice)) {
          let bestDist = Infinity;
          for (const m of bucket) {
            const d = Math.abs(m.price - cursorPrice);
            if (d < bestDist) {
              bestDist = d;
              chosen = m;
            }
          }
        }
      }
      setHover({ tradeId: chosen.tradeId, x: param.point.x, y: param.point.y });
    };

    chart.subscribeCrosshairMove(handler);
    crosshairRef.current = handler;

    return () => {
      try {
        chart.unsubscribeCrosshairMove(handler);
      } catch {
        // Chart tear-down race.
      }
      crosshairRef.current = null;
    };
  }, [ready, metaByTime]);

  // Keyboard: ESC deselects.
  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') onTradeSelect(null);
    },
    [onTradeSelect],
  );

  const hoveredTrade = hover ? tradeById.get(hover.tradeId) : null;

  return (
    // The div hosts TradingView's canvas — TV captures pointer events; we
    // only listen for ESC to deselect. `role="application"` marks this as a
    // focusable application region for screen readers; we still suppress the
    // noninteractive-element-interactions rule because the handler attaches
    // to the region container, not an intrinsically-interactive element.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <div
      ref={containerRef}
      role="application"
      className="relative w-full"
      style={{ height }}
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label="Backtest annotated candlestick chart"
    >
      {hoveredTrade && hover && <TradeMarkerTooltip trade={hoveredTrade} x={hover.x} y={hover.y} />}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

function TradeMarkerTooltip({ trade, x, y }: { trade: BacktestTrade; x: number; y: number }) {
  const hits = legHitMap(trade.positions);
  const legs = (Object.keys(hits) as Array<keyof typeof hits>).filter(
    (k) => hits[k] === 'TP_HIT' || hits[k] === 'RUNNER_CLOSE',
  );
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-[var(--border-default)] px-2.5 py-2 font-mono text-[11px] text-[var(--text-primary)] shadow-lg"
      style={{
        background: 'var(--bg-elevated)',
        left: Math.min(x + 12, 400),
        top: Math.max(y - 70, 8),
        minWidth: 180,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
          style={{
            background:
              trade.direction === 'LONG' ? 'rgba(0,200,150,0.15)' : 'rgba(255,77,106,0.15)',
            color: trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)',
          }}
        >
          {trade.direction}
        </span>
        <span className="tabular-nums text-[var(--text-secondary)]">
          {formatPrice(trade.entryPrice)}
          {trade.exitPrice != null && ` → ${formatPrice(trade.exitPrice)}`}
        </span>
      </div>
      <div
        className="mt-1.5 tabular-nums"
        style={{
          color: trade.realizedPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
        }}
      >
        {formatPnl(trade.realizedPnl)}
      </div>
      {legs.length > 0 && (
        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
          Legs hit: {legs.join(' · ')}
        </div>
      )}
    </div>
  );
}
