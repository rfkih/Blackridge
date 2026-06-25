'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { useChartTheme } from '@/lib/charts/useChartTheme';
import {
  buildTradeMarkers,
  deriveTradeOutcome,
  legHitMap,
  type HitLine,
  type MarkerMeta,
  type OutcomeTone,
} from '@/lib/backtest/buildTradeMarkers';
import {
  formatDate,
  formatDuration,
  formatPnl,
  formatPrice,
  formatRMultiple,
} from '@/lib/formatters';
import type { BacktestTrade } from '@/types/backtest';
import type { PositionExitReason } from '@/types/trading';
import type { CandleData, ChartIndicators, IndicatorData } from '@/types/market';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';
import {
  useChartIndicatorSeries,
  type IndicatorSeriesState,
} from '@/lib/charts/useChartIndicatorSeries';
import { useFeaturesWithComputedEma } from '@/lib/charts/useFeaturesWithComputedEma';
import { X } from 'lucide-react';

// Overlay palette — plain hex by necessity: these feed lightweight-charts'
// price-line options and a raw canvas 2d context, neither of which resolves
// CSS var() tokens. Single source of truth for every trade-annotation color;
// keep visually consistent with --color-loss/--color-profit/--color-info.
const OVERLAY = {
  sl: '#FF4D6A',
  tp1: '#00C896',
  tp2: '#00E5B0',
  entry: '#3B82F6',
  longFill: 'rgba(0,200,150,0.06)',
  shortFill: 'rgba(255,77,106,0.06)',
} as const;

const EMPTY_FEATURES: IndicatorData[] = [];
const EMPTY_CANDLES: CandleData[] = [];

interface BacktestAnnotatedChartProps {
  candles: CandleData[];
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
  /** Drives imperative scroll-to on selection (non-null when selection came from the table). */
  scrollTrigger?: number;
  height?: number;
  features?: IndicatorData[];
  /** ~150 candles BEFORE the window, used only to seed the EMA-100 so it covers the whole window. */
  emaWarmupCandles?: CandleData[];
  showIndicators?: ChartIndicators;
  /** Exit-marker labeling: `'reason'` (default, backtest result page) or
   *  `'action'` (live-trades chart — labels closes BUY/SELL). */
  exitLabelMode?: 'reason' | 'action';
}

const MARKER_HIT_RADIUS_PX = 16;

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
  features,
  emaWarmupCandles,
  showIndicators,
  exitLabelMode = 'reason',
}: BacktestAnnotatedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]);
  const tvRef = useRef<{
    LineSeries: unknown;
    HistogramSeries: unknown;
    LineStyle: { Dashed: number; Solid: number };
    ColorType: { Solid: unknown };
  } | null>(null);
  const indicatorStateRef = useRef<IndicatorSeriesState>({});
  const bandsCanvasRef = useRef<HTMLCanvasElement>(null);
  const clusterBadgesRef = useRef<HTMLDivElement>(null);
  const overlayCtxRef = useRef({ trades, metaByTime: new Map<number, MarkerMeta[]>() });

  // Theme-aware chart colors; themeRef tracks the latest so the async build
  // effect reads the resolved theme (not the dark fallback) at creation time.
  const { TV } = useChartTheme();
  const themeRef = useRef(TV);
  themeRef.current = TV;

  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);

  const { markers, metaByTime } = useMemo(() => {
    const built = buildTradeMarkers(trades, { exitLabelMode });
    const candleTimes = candles.map((c) => c.time);
    const snap = makeCandleTimeSnapper(candleTimes);

    const snappedMarkers = built.markers.map((m) => {
      const t = m.time as number;
      return { ...m, time: snap(t) as Time };
    });
    const map = new Map<number, MarkerMeta[]>();
    for (const m of built.meta) {
      const snapped = snap(m.time);
      const entry: MarkerMeta = m.time === snapped ? m : { ...m, time: snapped };
      const bucket = map.get(snapped);
      if (bucket) bucket.push(entry);
      else map.set(snapped, [entry]);
    }
    return { markers: snappedMarkers, metaByTime: map };
  }, [trades, candles, exitLabelMode]);

  // Keep overlay context in sync so recomputeOverlays reads fresh data without deps.
  overlayCtxRef.current = { trades, metaByTime };

  const tradeById = useMemo(() => {
    const m = new Map<string, BacktestTrade>();
    for (const t of trades) m.set(t.id, t);
    return m;
  }, [trades]);

  const recomputeOverlays = useCallback(() => {
    const chart = chartRef.current;
    const canvas = bandsCanvasRef.current;
    const badgesEl = clusterBadgesRef.current;
    const container = containerRef.current;
    if (!chart || !canvas || !badgesEl || !container) return;

    const { trades: currentTrades, metaByTime: currentMeta } = overlayCtxRef.current;
    const ts = chart.timeScale();
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Duration bands — canvas is faster than DOM divs for per-frame repaint.
    canvas.width = w;
    canvas.height = h;
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) {
      for (const trade of currentTrades) {
        const e0 = Math.floor(trade.entryTime / 1000);
        const e1 = trade.exitTime ? Math.floor(trade.exitTime / 1000) : e0;
        const x0 = ts.timeToCoordinate(e0 as Time);
        const x1 = ts.timeToCoordinate(e1 as Time);
        if (x0 == null && x1 == null) continue;
        const left = Math.max(0, x0 ?? 0);
        const right = Math.min(w, (x1 ?? w) + 1);
        if (right <= left) continue;
        ctx2d.fillStyle = trade.direction === 'LONG' ? OVERLAY.longFill : OVERLAY.shortFill;
        ctx2d.fillRect(left, 0, right - left, h);
      }
    }

    // Cluster count badges — few DOM nodes (only at multi-trade candles).
    badgesEl.textContent = '';
    currentMeta.forEach((metas, time) => {
      const uniqueIds = new Set(metas.map((m) => m.tradeId));
      if (uniqueIds.size < 2) return;
      const x = ts.timeToCoordinate(time as Time);
      if (x == null || x < 0 || x > w) return;
      const badge = document.createElement('div');
      badge.textContent = String(uniqueIds.size);
      badge.style.cssText = `position:absolute;top:6px;left:${Math.round(x) - 8}px;width:16px;height:16px;border-radius:50%;background:rgba(59,130,246,0.85);color:#fff;font:700 9px/16px monospace;text-align:center`;
      badgesEl.appendChild(badge);
    });
  }, []);

  // Re-run overlays whenever the visible time range changes (pan / zoom).
  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    if (!chart) return;
    recomputeOverlays();
    chart.timeScale().subscribeVisibleTimeRangeChange(recomputeOverlays);
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(recomputeOverlays);
      } catch {}
    };
  }, [ready, recomputeOverlays]);

  // Re-run overlays when the trade/meta set changes (filter change, initial load).
  useEffect(() => {
    if (!ready) return;
    recomputeOverlays();
  }, [ready, trades, metaByTime, recomputeOverlays]);

  const clickCtxRef = useRef({ metaByTime, onTradeSelect, series: seriesRef });
  clickCtxRef.current = { metaByTime, onTradeSelect, series: seriesRef };

  const crosshairRef = useRef<((param: MouseEventParams<Time>) => void) | null>(null);
  const clickUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);

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
          fontSize: 13,
        },
        grid: {
          vertLines: { color: c.GRID },
          horzLines: { color: c.GRID },
        },
        crosshair: {
          mode: tv.CrosshairMode.Normal,
          vertLine: { color: c.CROSSHAIR, labelBackgroundColor: c.LABEL_BG },
          horzLine: { color: c.CROSSHAIR, labelBackgroundColor: c.LABEL_BG },
        },
        rightPriceScale: { borderColor: c.BORDER },
        timeScale: {
          borderColor: c.BORDER,
          timeVisible: true,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      const series = chart.addSeries(tv.CandlestickSeries, {
        upColor: c.PROFIT,
        downColor: c.LOSS,
        borderUpColor: c.PROFIT,
        borderDownColor: c.LOSS,
        wickUpColor: c.PROFIT,
        wickDownColor: c.LOSS,
      });
      seriesRef.current = series;

      markersPluginRef.current = tv.createSeriesMarkers(series, []);

      const clickHandler = (param: MouseEventParams<Time>) => {
        const ctx = clickCtxRef.current;
        if (!param.point) {
          ctx.onTradeSelect(null);
          return;
        }
        const series = ctx.series.current;
        if (!series) return;
        const chosen = findClosestMarkerByPixel(
          ctx.metaByTime,
          series,
          chart,
          param.point,
          MARKER_HIT_RADIUS_PX,
        );
        ctx.onTradeSelect(chosen ? chosen.tradeId : null);
      };
      chart.subscribeClick(clickHandler);
      clickUnsubRef.current = () => {
        try {
          chart.unsubscribeClick(clickHandler);
        } catch {}
      };

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

      priceLineRefs.current = [];
      markersPluginRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      tvRef.current = null;
      indicatorStateRef.current = {};
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Re-apply chrome + candle colors when the theme flips, without rebuilding.
  useEffect(() => {
    const chart = chartRef.current;
    const tv = tvRef.current;
    if (!chart || !tv) return;
    chart.applyOptions({
      layout: {
        background: { type: tv.ColorType.Solid as never, color: TV.BG },
        textColor: TV.TEXT,
      },
      grid: { vertLines: { color: TV.GRID }, horzLines: { color: TV.GRID } },
      crosshair: {
        vertLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
        horzLine: { color: TV.CROSSHAIR, labelBackgroundColor: TV.LABEL_BG },
      },
      rightPriceScale: { borderColor: TV.BORDER },
      timeScale: { borderColor: TV.BORDER },
    });
    seriesRef.current?.applyOptions({
      upColor: TV.PROFIT,
      downColor: TV.LOSS,
      borderUpColor: TV.PROFIT,
      borderDownColor: TV.LOSS,
      wickUpColor: TV.PROFIT,
      wickDownColor: TV.LOSS,
    });
  }, [TV]);

  const augmentedFeatures = useFeaturesWithComputedEma(
    candles,
    features ?? EMPTY_FEATURES,
    emaWarmupCandles ?? EMPTY_CANDLES,
  );

  useChartIndicatorSeries(
    chartRef,
    tvRef,
    indicatorStateRef,
    ready,
    showIndicators ?? DEFAULT_INDICATORS,
    augmentedFeatures,
  );

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

  useEffect(() => {
    if (!ready) return;
    markersPluginRef.current?.setMarkers(markers);
  }, [ready, markers]);

  useEffect(() => {
    if (!ready || !seriesRef.current) return;
    const series = seriesRef.current;

    for (const line of priceLineRefs.current) {
      try {
        series.removePriceLine(line);
      } catch {}
    }
    priceLineRefs.current = [];

    if (!selectedTradeId) return;
    const trade = tradeById.get(selectedTradeId);
    if (!trade) return;

    const hitLine = deriveTradeOutcome(trade.positions).hitLine;

    void (async () => {
      const { LineStyle } = await import('lightweight-charts');
      if (!seriesRef.current) return;
      const activeSeries = seriesRef.current;

      const add = (
        price: number | null | undefined,
        color: string,
        title: string,
        which: HitLine,
      ) => {
        if (price == null || !Number.isFinite(price) || price <= 0) return;
        const wasHit = which != null && hitLine === which;

        const line = activeSeries.createPriceLine({
          price,
          color,
          lineWidth: wasHit ? 2 : 1,
          lineStyle: wasHit ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: wasHit ? `${title} · hit` : title,
        });
        priceLineRefs.current.push(line);
      };

      const isRunnerOnly =
        trade.positions.length > 0 && trade.positions.every((p) => p.type === 'RUNNER');

      add(trade.stopLossPrice, OVERLAY.sl, isRunnerOnly ? 'INIT SL' : 'SL', 'SL');
      if (!isRunnerOnly) {
        add(trade.tp1Price, OVERLAY.tp1, 'TP1', 'TP1');
        add(trade.tp2Price, OVERLAY.tp2, 'TP2', 'TP2');
      }
      if (isRunnerOnly) {
        if (trade.exitPrice != null && Number.isFinite(trade.exitPrice)) {
          add(trade.exitPrice, OVERLAY.entry, 'TRAIL EXIT', 'RUNNER');
        }
      } else if (hitLine === 'RUNNER') {
        const runnerLeg = trade.positions.find(
          (p) => p.type === 'RUNNER' && p.exitReason === 'RUNNER_CLOSE',
        );
        if (runnerLeg?.exitPrice != null && Number.isFinite(runnerLeg.exitPrice)) {
          add(runnerLeg.exitPrice, OVERLAY.entry, 'TRAIL EXIT', 'RUNNER');
        }
      }
      add(trade.entryPrice, OVERLAY.entry, 'ENTRY', null);
    })();
  }, [ready, selectedTradeId, tradeById]);

  useEffect(() => {
    if (!ready || !scrollTrigger || !selectedTradeId) return;
    const trade = tradeById.get(selectedTradeId);
    if (!trade) return;
    const chart = chartRef.current;
    if (!chart) return;

    const entrySec = Math.floor(trade.entryTime / 1000);
    const exitSec = trade.exitTime != null ? Math.floor(trade.exitTime / 1000) : entrySec;

    const span = Math.max(exitSec - entrySec, 60 * 60);
    const pad = Math.max(span * 0.5, 60 * 60);
    chart.timeScale().setVisibleRange({
      from: (entrySec - pad) as Time,
      to: (exitSec + pad) as Time,
    });
  }, [ready, scrollTrigger, selectedTradeId, tradeById]);

  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    if (!chart) return;

    let rafId: number | null = null;
    let pendingPoint: { x: number; y: number } | null = null;
    let pendingValid = false;
    let lastPayload: HoverState | null = null;

    const commit = () => {
      rafId = null;
      const point = pendingValid ? pendingPoint : null;
      pendingPoint = null;
      pendingValid = false;

      let next: HoverState | null = null;
      if (point) {
        const series = seriesRef.current;
        if (series && chart) {
          const chosen = findClosestMarkerByPixel(
            metaByTime,
            series,
            chart,
            point,
            MARKER_HIT_RADIUS_PX,
          );
          if (chosen) {
            next = { tradeId: chosen.tradeId, x: point.x, y: point.y };
          }
        }
      }

      if (next === null && lastPayload === null) return;
      if (
        next &&
        lastPayload &&
        next.tradeId === lastPayload.tradeId &&
        next.x === lastPayload.x &&
        next.y === lastPayload.y
      )
        return;
      lastPayload = next;
      setHover(next);
    };

    const handler = (param: MouseEventParams<Time>) => {
      pendingPoint = param.point ? { x: param.point.x, y: param.point.y } : null;
      pendingValid = true;
      if (rafId == null) rafId = requestAnimationFrame(commit);
    };

    chart.subscribeCrosshairMove(handler);
    crosshairRef.current = handler;

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      try {
        chart.unsubscribeCrosshairMove(handler);
      } catch {}
      crosshairRef.current = null;
    };
  }, [ready, metaByTime]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') onTradeSelect(null);
    },
    [onTradeSelect],
  );

  const hoveredTrade = hover ? tradeById.get(hover.tradeId) : null;
  const selectedTrade = selectedTradeId ? (tradeById.get(selectedTradeId) ?? null) : null;

  const cursorOverMarker = hoveredTrade != null;

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <div
      ref={containerRef}
      role="application"
      className="relative w-full"
      style={{ height, cursor: cursorOverMarker ? 'pointer' : 'crosshair' }}
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label="Backtest annotated candlestick chart"
    >
      {/* Trade duration bands rendered on a transparent canvas overlay */}
      <canvas
        ref={bandsCanvasRef}
        className="pointer-events-none absolute left-0 top-0"
        aria-hidden="true"
      />
      {hoveredTrade && hover && <TradeMarkerTooltip trade={hoveredTrade} x={hover.x} y={hover.y} />}
      {/* Portal the pinned card to <body>: the dashboard <main> carries a
          `will-change: transform` + a lingering page-enter `translateY(0)`, either
          of which makes <main> the containing block for `position: fixed`
          descendants — so a card left inside the chart tree anchors to <main>
          (the scroll container) and won't track viewport scroll. Rendering it at
          the document root restores true viewport-fixed positioning. */}
      {selectedTrade &&
        typeof document !== 'undefined' &&
        createPortal(
          <TradeDetailCard trade={selectedTrade} onClose={() => onTradeSelect(null)} />,
          document.body,
        )}
      {!selectedTrade && trades.length > 0 && <ClickAnyMarkerHint />}
      {/* Cluster count badges for candles with multiple overlapping markers */}
      <div
        ref={clusterBadgesRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      {ready && <ExportChartButton chartRef={chartRef} />}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

const HINT_DISMISS_KEY = 'blackheart:backtest-chart-hint-dismissed';

function ClickAnyMarkerHint() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(window.localStorage.getItem(HINT_DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(HINT_DISMISS_KEY, '1');
    } catch {}
  };

  return (
    <div
      role="status"
      className="pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] shadow-lg"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <span>Click any marker for trade details</span>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        aria-label="Dismiss hint"
      >
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}

function ExportChartButton({ chartRef }: { chartRef: { current: IChartApi | null } }) {
  const handleExport = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const canvas = chart.takeScreenshot();
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backtest-chart.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  }, [chartRef]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="absolute bottom-3 left-3 z-10 rounded-md border border-[var(--border-default)] px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] shadow-md transition-colors hover:text-[var(--text-primary)]"
      style={{ background: 'var(--bg-elevated)' }}
      aria-label="Export chart as PNG"
    >
      PNG
    </button>
  );
}

function TradeMarkerTooltip({ trade, x, y }: { trade: BacktestTrade; x: number; y: number }) {
  const hits = legHitMap(trade.positions);
  const legs = (Object.keys(hits) as Array<keyof typeof hits>).filter(
    (k) => hits[k] === 'TP_HIT' || hits[k] === 'RUNNER_CLOSE',
  );
  const outcome = deriveTradeOutcome(trade.positions);
  const outcomeColors = tooltipOutcomeColors(outcome.tone);
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-[var(--border-default)] px-2.5 py-2 font-mono text-[13px] text-[var(--text-primary)] shadow-lg"
      style={{
        background: 'var(--bg-elevated)',
        left: Math.min(x + 12, 400),
        top: Math.max(y - 70, 8),
        minWidth: 200,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tracking-wider"
          style={{
            background: trade.direction === 'LONG' ? 'var(--tint-profit)' : 'var(--tint-loss)',
            color: trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)',
          }}
        >
          {trade.direction}
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tracking-wider"
          title={outcome.description}
          style={{ background: outcomeColors.bg, color: outcomeColors.fg }}
        >
          {outcome.label}
        </span>
      </div>
      <div className="mt-1.5 tabular-nums text-[var(--text-secondary)]">
        {formatPrice(trade.entryPrice)}
        {trade.exitPrice != null && ` → ${formatPrice(trade.exitPrice)}`}
      </div>
      <div
        className="mt-1 tabular-nums"
        style={{
          color: trade.realizedPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
        }}
      >
        {formatPnl(trade.realizedPnl)}
      </div>
      {legs.length > 0 && (
        <div className="mt-1 text-[12px] text-[var(--text-muted)]">
          Legs hit: {legs.join(' · ')}
        </div>
      )}
    </div>
  );
}

/**
 * Click-pinned detail card. Shown in the chart's top-right when a trade
 * marker is clicked. The hover tooltip is the quick-scan affordance; this
 * is the "I want the full picture for this trade" view — strategy + TF,
 * entry/exit times and prices, SL/TP levels, P&L, R-multiple, and which
 * legs hit what. Dismiss via the close button or by pressing ESC on the
 * focused chart container.
 */
function TradeDetailCard({ trade, onClose }: { trade: BacktestTrade; onClose: () => void }) {
  const isLong = trade.direction === 'LONG';
  const pnlColor = trade.realizedPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  const outcome = deriveTradeOutcome(trade.positions);
  const outcomeColors = tooltipOutcomeColors(outcome.tone);
  const duration = trade.exitTime != null ? trade.exitTime - trade.entryTime : null;

  return (
    <div
      // `fixed` (not `absolute`) so the card is anchored to the viewport and follows the page
      // scroll — it stays visible wherever you are, instead of being stuck at the chart's
      // position near the top of the page when scrolled down.
      className="fixed bottom-4 right-4 z-40 w-[280px] rounded-md border border-[var(--border-default)] shadow-lg"
      style={{ background: 'var(--bg-elevated)' }}
      role="dialog"
      aria-label="Trade details"
    >
      {}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-wider"
            style={{
              background: isLong ? 'var(--tint-profit)' : 'var(--tint-loss)',
              color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
            }}
          >
            {trade.direction}
          </span>
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-wider"
            title={outcome.description}
            style={{ background: outcomeColors.bg, color: outcomeColors.fg }}
          >
            {outcome.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Close trade details"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      {}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        {trade.strategyCode || trade.strategyName ? (
          <span
            className="truncate rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[var(--text-primary)]"
            title={trade.strategyName ?? trade.strategyCode ?? ''}
          >
            {trade.strategyCode ?? trade.strategyName}
          </span>
        ) : (
          <span className="font-mono text-[12px] text-[var(--text-muted)]">no strategy</span>
        )}
        <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
          {trade.interval ?? '—'}
        </span>
      </div>

      {}
      <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[13px]">
        <DetailRow label="Entry" value={formatDate(trade.entryTime)} muted />
        <DetailRow
          label="Exit"
          value={trade.exitTime != null ? formatDate(trade.exitTime) : '— still open'}
          muted
        />
        {duration != null && <DetailRow label="Held" value={formatDuration(duration)} muted />}
      </div>

      {}
      {(() => {
        const isRunnerOnly =
          trade.positions.length > 0 && trade.positions.every((p) => p.type === 'RUNNER');
        return (
          <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[13px] tabular-nums">
            <DetailRow label="Entry @" value={formatPrice(trade.entryPrice)} />
            <DetailRow
              label="Exit @"
              value={trade.exitPrice != null ? formatPrice(trade.exitPrice) : '—'}
            />
            <DetailRow
              label={isRunnerOnly ? 'Initial stop' : 'Stop loss'}
              value={
                trade.stopLossPrice != null && trade.stopLossPrice > 0
                  ? formatPrice(trade.stopLossPrice)
                  : '—'
              }
              dotColor="var(--color-loss)"
            />
            {isRunnerOnly ? (
              <DetailRow
                label="Trailing exit"
                value={trade.exitPrice != null ? formatPrice(trade.exitPrice) : '— in flight'}
                dotColor="var(--color-info)"
              />
            ) : (
              <>
                <DetailRow
                  label="Take profit 1"
                  value={trade.tp1Price != null ? formatPrice(trade.tp1Price) : '—'}
                  dotColor="var(--color-profit)"
                />
                {trade.tp2Price != null && (
                  <DetailRow
                    label="Take profit 2"
                    value={formatPrice(trade.tp2Price)}
                    dotColor="var(--color-profit)"
                  />
                )}
              </>
            )}
          </div>
        );
      })()}

      {}
      <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[13px] tabular-nums">
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
            Realized P&L
          </span>
          <span className="font-semibold" style={{ color: pnlColor }}>
            {formatPnl(trade.realizedPnl)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
            R-multiple
          </span>
          <span style={{ color: pnlColor }}>{formatRMultiple(trade.rMultiple)}</span>
        </div>
        <DetailRow label="Quantity" value={trade.quantity.toString()} muted />
      </div>

      {}
      <div className="px-3 py-2">
        <div className="label-caps mb-1 !text-[12px]">Legs</div>
        {trade.positions.length === 0 ? (
          <div className="font-mono text-[12px] text-[var(--text-muted)]">— no positions</div>
        ) : (
          <ul className="space-y-1 font-mono text-[12px]">
            {trade.positions.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: legDotColor(p.exitReason) }}
                  />
                  <span className="font-semibold text-[var(--text-primary)]">{p.type}</span>
                </span>
                <span className="text-[var(--text-muted)]">
                  {legSummary(p.exitReason, p.exitPrice)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  muted,
  dotColor,
}: {
  label: string;
  value: string;
  muted?: boolean;
  dotColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
        {dotColor && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dotColor }}
          />
        )}
        {label}
      </span>
      <span className={muted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>
        {value}
      </span>
    </div>
  );
}

function legSummary(
  reason: PositionExitReason | null | undefined,
  exitPrice: number | null,
): string {
  if (!reason) return 'open';
  const priceTail = exitPrice != null ? ` @ ${formatPrice(exitPrice)}` : '';
  switch (reason) {
    case 'TP_HIT':
      return `TP hit${priceTail}`;
    case 'SL_HIT':
      return `SL hit${priceTail}`;
    case 'RUNNER_CLOSE':
      return `trail${priceTail}`;
    case 'MANUAL_CLOSE':
      return `manual${priceTail}`;
    case 'BACKTEST_END':
      return `bt-end${priceTail}`;
    case 'EMABAND_EXIT':
      return `signal exit${priceTail}`;
    default:
      return `${reason}${priceTail}`;
  }
}

function legDotColor(reason: PositionExitReason | null | undefined): string {
  switch (reason) {
    case 'TP_HIT':
      return 'var(--color-profit)';
    case 'RUNNER_CLOSE':
      return 'var(--color-info)';
    case 'SL_HIT':
      return 'var(--color-loss)';
    case 'EMABAND_EXIT':
      return 'var(--color-info)';
    case 'MANUAL_CLOSE':
    case 'BACKTEST_END':
      return 'var(--color-warning)';
    default:
      return 'var(--text-muted)';
  }
}

function findClosestMarkerByPixel(
  metaByTime: Map<number, MarkerMeta[]>,
  series: ISeriesApi<'Candlestick'>,
  chart: IChartApi,
  point: { x: number; y: number },
  hitRadiusPx: number,
): MarkerMeta | null {
  const timeScale = chart.timeScale();
  let chosen: MarkerMeta | null = null;
  let bestDist = Infinity;

  metaByTime.forEach((metas, time) => {
    const x = timeScale.timeToCoordinate(time as Time);
    if (x == null) return;
    const dx = x - point.x;
    if (Math.abs(dx) > hitRadiusPx) return;
    for (const meta of metas) {
      const y = series.priceToCoordinate(meta.price);
      if (y == null) continue;
      const dy = y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist <= hitRadiusPx) {
        bestDist = dist;
        chosen = meta;
      }
    }
  });

  return chosen;
}

function makeCandleTimeSnapper(sortedTimes: number[]): (t: number) => number {
  if (sortedTimes.length < 2) return (t) => t;

  const last = sortedTimes[sortedTimes.length - 1];
  const first = sortedTimes[0];
  return (t: number): number => {
    if (t <= first) return first;

    if (t >= last) return last;
    let lo = 0;
    let hi = sortedTimes.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (sortedTimes[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return sortedTimes[lo];
  };
}

function tooltipOutcomeColors(tone: OutcomeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'profit':
      return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)' };
    case 'loss':
      return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)' };
    case 'warning':
      return { bg: 'rgba(245,166,35,0.15)', fg: 'var(--color-warning)' };
    case 'info':
      return { bg: 'rgba(59,130,246,0.15)', fg: 'var(--color-info)' };
    default:
      return { bg: 'var(--bg-surface)', fg: 'var(--text-muted)' };
  }
}
