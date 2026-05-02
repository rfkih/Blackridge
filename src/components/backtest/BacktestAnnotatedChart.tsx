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
import {
  buildTradeMarkers,
  deriveTradeOutcome,
  legHitMap,
  type HitLine,
  type MarkerMeta,
  type OutcomeTone,
} from '@/lib/backtest/buildTradeMarkers';
import { formatDate, formatDuration, formatPnl, formatPrice, formatRMultiple } from '@/lib/formatters';
import type { BacktestTrade } from '@/types/backtest';
import type { PositionExitReason } from '@/types/trading';
import type { CandleData } from '@/types/market';
import { X } from 'lucide-react';

interface BacktestAnnotatedChartProps {
  candles: CandleData[];
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
  /** Drives imperative scroll-to on selection (non-null when selection came from the table). */
  scrollTrigger?: number;
  height?: number;
}

// Generous radius — TV markers are ~10px glyphs, hard to hit precisely
// when bars are pixel-thin. Crosshair uses the same radius so the cursor
// change and click target stay in sync.
const MARKER_HIT_RADIUS_PX = 32;

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

  // Snap marker times to the candle that contains them — backend exit
  // times can be mid-bar and TV reports `param.time` as the candle's
  // start, so unaligned markers would never match on click. Memoised on
  // trades + candles only; selection state is handled by the effect below.
  const { markers, metaByTime } = useMemo(() => {
    const built = buildTradeMarkers(trades);
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
  }, [trades, candles]);

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

      // Pixel-distance hit testing — exact-bar match is too narrow on
      // zoomed-out charts. Click outside the radius deselects.
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

    const hitLine = deriveTradeOutcome(trade.positions).hitLine;

    // Import LineStyle lazily; it's part of the same module we already loaded.
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
        if (price == null || !Number.isFinite(price)) return;
        const wasHit = which != null && hitLine === which;
        // Emphasise the horizontal the trade actually closed on: solid + thicker
        // + a "✓ hit" label suffix. Other lines stay in the ambient dashed state.
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

      // RUNNER_ONLY trades (e.g. DCT) exit purely via trailing stop with no
      // fixed TP. Their stored tp1Price is a sentinel (e.g. entry + 20R)
      // that keeps the persistence layer happy but doesn't represent a real
      // target — drawing it as a price line is misleading and pushes the
      // chart's price scale way off. Detect by "every position is a RUNNER
      // leg", then suppress TP lines and use the trade's actual exit price
      // as the operative exit level instead.
      const isRunnerOnly =
        trade.positions.length > 0 &&
        trade.positions.every((p) => p.type === 'RUNNER');

      add(trade.stopLossPrice, '#FF4D6A', isRunnerOnly ? 'INIT SL' : 'SL', 'SL');
      if (!isRunnerOnly) {
        add(trade.tp1Price, '#00C896', 'TP1', 'TP1');
        add(trade.tp2Price, '#00E5B0', 'TP2', 'TP2');
      }
      if (isRunnerOnly) {
        // Trail exit = where the chandelier finally caught price. Works for
        // both TRAILING_STOP and RUNNER_CLOSE exit reasons, since both close
        // the trade on the trail in a runner-only structure.
        if (trade.exitPrice != null && Number.isFinite(trade.exitPrice)) {
          add(trade.exitPrice, '#4E9EFF', 'TRAIL EXIT', 'RUNNER');
        }
      } else if (hitLine === 'RUNNER') {
        // Multi-leg trades (TP1+RUNNER): only show the trail anchor when the
        // runner actually closed via the trail.
        const runnerLeg = trade.positions.find(
          (p) => p.type === 'RUNNER' && p.exitReason === 'RUNNER_CLOSE',
        );
        if (runnerLeg?.exitPrice != null && Number.isFinite(runnerLeg.exitPrice)) {
          add(runnerLeg.exitPrice, '#4E9EFF', 'TRAIL', 'RUNNER');
        }
      }
      add(trade.entryPrice, '#4E9EFF', 'ENTRY', null);
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

    // Marker iteration deferred to the rAF tick — TV fires crosshair events
    // at mouse-move rate; running the O(markers) hit test inline would
    // jank dense charts. Same hit radius the click handler uses, so the
    // cursor-pointer affordance matches where a click would land.
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
      // Snapshot the point — TV may reuse the param object on the next event.
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
  const selectedTrade = selectedTradeId ? tradeById.get(selectedTradeId) ?? null : null;

  // Switch to pointer wherever the tooltip would show — same hit-radius
  // as the click handler.
  const cursorOverMarker = hoveredTrade != null;

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
      style={{ height, cursor: cursorOverMarker ? 'pointer' : 'crosshair' }}
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label="Backtest annotated candlestick chart"
    >
      {hoveredTrade && hover && <TradeMarkerTooltip trade={hoveredTrade} x={hover.x} y={hover.y} />}
      {selectedTrade && (
        <TradeDetailCard trade={selectedTrade} onClose={() => onTradeSelect(null)} />
      )}
      {!selectedTrade && trades.length > 0 && <ClickAnyMarkerHint />}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

const HINT_DISMISS_KEY = 'blackheart:backtest-chart-hint-dismissed';

// One-time discoverability nudge — dismissal persists across sessions.
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
    } catch {
      // No persistence available (private mode); the in-memory dismiss still
      // takes effect for this session.
    }
  };

  return (
    <div
      role="status"
      className="pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-lg"
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

function TradeMarkerTooltip({ trade, x, y }: { trade: BacktestTrade; x: number; y: number }) {
  const hits = legHitMap(trade.positions);
  const legs = (Object.keys(hits) as Array<keyof typeof hits>).filter(
    (k) => hits[k] === 'TP_HIT' || hits[k] === 'RUNNER_CLOSE',
  );
  const outcome = deriveTradeOutcome(trade.positions);
  const outcomeColors = tooltipOutcomeColors(outcome.tone);
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-[var(--border-default)] px-2.5 py-2 font-mono text-[11px] text-[var(--text-primary)] shadow-lg"
      style={{
        background: 'var(--bg-elevated)',
        left: Math.min(x + 12, 400),
        top: Math.max(y - 70, 8),
        minWidth: 200,
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
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
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
        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
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
      className="absolute right-3 top-3 z-20 w-[280px] rounded-md border border-[var(--border-default)] shadow-lg"
      style={{ background: 'var(--bg-elevated)' }}
      role="dialog"
      aria-label="Trade details"
    >
      {/* Header — direction, outcome, close */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
            style={{
              background: isLong ? 'rgba(0,200,150,0.15)' : 'rgba(255,77,106,0.15)',
              color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
            }}
          >
            {trade.direction}
          </span>
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
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

      {/* Strategy + TF — surfaces the per-trade attribution we recently added */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        {trade.strategyCode || trade.strategyName ? (
          <span
            className="truncate rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-primary)]"
            title={trade.strategyName ?? trade.strategyCode ?? ''}
          >
            {trade.strategyCode ?? trade.strategyName}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-[var(--text-muted)]">no strategy</span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {trade.interval ?? '—'}
        </span>
      </div>

      {/* Entry / exit times */}
      <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[11px]">
        <DetailRow label="Entry" value={formatDate(trade.entryTime)} muted />
        <DetailRow
          label="Exit"
          value={trade.exitTime != null ? formatDate(trade.exitTime) : '— still open'}
          muted
        />
        {duration != null && (
          <DetailRow label="Held" value={formatDuration(duration)} muted />
        )}
      </div>

      {/* Price levels — the SL / TP / entry prices the trade was sized against.
          For RUNNER_ONLY trades (no fixed TP, pure trailing exit) we hide
          TP rows since the stored tp1Price is just a sentinel. */}
      {(() => {
        const isRunnerOnly =
          trade.positions.length > 0 &&
          trade.positions.every((p) => p.type === 'RUNNER');
        return (
          <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[11px] tabular-nums">
            <DetailRow label="Entry @" value={formatPrice(trade.entryPrice)} />
            <DetailRow
              label="Exit @"
              value={trade.exitPrice != null ? formatPrice(trade.exitPrice) : '—'}
            />
            <DetailRow
              label={isRunnerOnly ? 'Initial stop' : 'Stop loss'}
              value={formatPrice(trade.stopLossPrice)}
              dotColor="var(--color-loss)"
            />
            {isRunnerOnly ? (
              <DetailRow
                label="Trailing exit"
                value={
                  trade.exitPrice != null ? formatPrice(trade.exitPrice) : '— in flight'
                }
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

      {/* P&L summary */}
      <div className="space-y-1 border-b border-[var(--border-subtle)] px-3 py-2 font-mono text-[11px] tabular-nums">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Realized P&L
          </span>
          <span className="font-semibold" style={{ color: pnlColor }}>
            {formatPnl(trade.realizedPnl)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            R-multiple
          </span>
          <span style={{ color: pnlColor }}>{formatRMultiple(trade.rMultiple)}</span>
        </div>
        <DetailRow label="Quantity" value={trade.quantity.toString()} muted />
      </div>

      {/* Per-leg breakdown — what each child position did */}
      <div className="px-3 py-2">
        <div className="label-caps mb-1 !text-[9px]">Legs</div>
        {trade.positions.length === 0 ? (
          <div className="font-mono text-[10px] text-[var(--text-muted)]">— no positions</div>
        ) : (
          <ul className="space-y-1 font-mono text-[10px]">
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
                <span className="text-[var(--text-muted)]">{legSummary(p.exitReason, p.exitPrice)}</span>
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
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
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

function legSummary(reason: PositionExitReason | null | undefined, exitPrice: number | null): string {
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
    case 'MANUAL_CLOSE':
    case 'BACKTEST_END':
      return 'var(--color-warning)';
    default:
      return 'var(--text-muted)';
  }
}

// Nearest marker to a click/hover point in pixel space. The x-distance
// quick-reject keeps this cheap on dense charts; we measure from the
// marker's price coord (not its rendered glyph offset) and rely on the
// generous radius to absorb the visual offset.
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
    if (x == null) return; // marker scrolled off the visible time scale
    const dx = x - point.x;
    if (Math.abs(dx) > hitRadiusPx) return; // x-only quick-reject
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

// Snap to the candle whose [start, start + interval) contains t. Falls
// back to identity until candles load; mid-bar markers won't snap in that
// window but exact-aligned trades still bind.
function makeCandleTimeSnapper(sortedTimes: number[]): (t: number) => number {
  if (sortedTimes.length < 2) return (t) => t;
  // Backend contract: ascending. We don't re-sort.
  const last = sortedTimes[sortedTimes.length - 1];
  const first = sortedTimes[0];
  return (t: number): number => {
    if (t <= first) return first;
    // Past the loaded range — anchor to the last candle so it stays clickable.
    if (t >= last) return last;
    let lo = 0;
    let hi = sortedTimes.length - 1;
    // Largest index whose value is <= t.
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
      return { bg: 'rgba(0,200,150,0.15)', fg: 'var(--color-profit)' };
    case 'loss':
      return { bg: 'rgba(255,77,106,0.15)', fg: 'var(--color-loss)' };
    case 'warning':
      return { bg: 'rgba(245,166,35,0.15)', fg: 'var(--color-warning)' };
    case 'info':
      return { bg: 'rgba(78,158,255,0.15)', fg: 'var(--color-info)' };
    default:
      return { bg: 'var(--bg-surface)', fg: 'var(--text-muted)' };
  }
}
