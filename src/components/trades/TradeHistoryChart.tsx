'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, LineChart, RefreshCw } from 'lucide-react';
import { SymbolPicker } from '@/components/charts/SymbolPicker';
import { IntervalTabs } from '@/components/charts/IntervalTabs';
import { IndicatorBar } from '@/components/charts/IndicatorBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartIndicators } from '@/hooks/useChartIndicators';
import { useRangeCandles } from '@/hooks/useRangeCandles';
import { useBacktestIndicators } from '@/hooks/useBacktestIndicators';
import { useEmaWarmupCandles } from '@/hooks/useEmaWarmupCandles';
import { liveTradeToBacktestTrade } from '@/lib/trades/liveTradeToBacktestTrade';
import { INTERVAL_SECONDS } from '@/lib/charts/chartTheme';
import type { BacktestTrade } from '@/types/backtest';
import type { CandleData, ChartInterval, IndicatorData } from '@/types/market';
import type { Trades } from '@/types/trading';

/** Interval set for live trades — includes 1d for daily strategies (DCB /
 *  EMA_BAND / VRP), unlike the intraday market-viewer default. */
const TRADE_CHART_INTERVALS: ChartInterval[] = ['15m', '1h', '4h', '1d'];

/** Context bars kept on each side of the trade span so an entry/exit near the
 *  window edge still has price context around it. */
const MIN_CONTEXT_BARS = 30;
/** Upper bound on fetched candles so a coarse interval over a long span stays a
 *  bounded request. */
const MAX_BARS = 1_000;

const EMPTY_CANDLES: CandleData[] = [];
const EMPTY_FEATURES: IndicatorData[] = [];

const BacktestAnnotatedChart = dynamic(
  () =>
    import('@/components/backtest/BacktestAnnotatedChart').then((m) => m.BacktestAnnotatedChart),
  { ssr: false, loading: () => <Skeleton className="h-[440px] w-full" /> },
);

interface TradeHistoryChartProps {
  /** Symbol the candles are fetched for; `trades` must already be scoped to it. */
  symbol: string;
  /** Live trades to overlay (entry/exit markers, SL/TP lines, duration bands). */
  trades: Trades[];
  /** Controlled interval. Callers seed the initial value with
   *  `defaultIntervalForSpan(span)`. */
  interval: ChartInterval;
  onIntervalChange: (iv: ChartInterval) => void;
  /** When provided alongside `showControls`, renders a SymbolPicker. */
  onSymbolChange?: (s: string) => void;
  selectedTradeId?: string | null;
  onTradeSelect?: (id: string | null) => void;
  /** Bump to imperatively scroll/zoom the chart to the selected trade. */
  scrollTrigger?: number;
  height?: number;
  /** Render the symbol/interval control row (default true). */
  showControls?: boolean;
  /** localStorage key for the indicator toggles. */
  storageKey?: string;
  /** Drop the outer card chrome (border/rounded/bg) so a parent can own it —
   *  used by the collapsible journal panel. */
  bare?: boolean;
}

/**
 * Live-trade candlestick chart. Fetches real candles + indicators over the
 * window spanned by `trades` and renders them through the shared
 * `BacktestAnnotatedChart`, with exit markers labeled by executed action
 * (BUY/SELL) rather than backtest reason codes.
 */
export function TradeHistoryChart({
  symbol,
  trades,
  interval,
  onIntervalChange,
  onSymbolChange,
  selectedTradeId = null,
  onTradeSelect,
  scrollTrigger,
  height = 440,
  showControls = true,
  storageKey = 'blackheart:trades-indicators',
  bare = false,
}: TradeHistoryChartProps) {
  const { indicators, toggle, anyActive } = useChartIndicators(storageKey);

  const chartWindow = useMemo(() => computeWindow(trades, interval), [trades, interval]);

  const candlesQ = useRangeCandles(
    symbol,
    interval,
    chartWindow?.fromMs,
    chartWindow?.toMs,
    !!chartWindow,
  );
  const indicatorsQ = useBacktestIndicators(
    symbol,
    interval,
    chartWindow?.fromMs,
    chartWindow?.toMs,
    anyActive && !!chartWindow,
  );
  const warmupQ = useEmaWarmupCandles(
    symbol,
    interval,
    chartWindow?.fromMs,
    indicators.ema100 && !!chartWindow,
  );

  const adapted = useMemo<BacktestTrade[]>(
    () => trades.map((t) => liveTradeToBacktestTrade(t, interval)),
    [trades, interval],
  );

  const handleSelect = onTradeSelect ?? noop;

  return (
    <div
      className={
        bare
          ? 'overflow-hidden'
          : 'overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface'
      }
    >
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd-subtle px-4 py-3">
          <div className="flex items-center gap-3">
            {onSymbolChange && <SymbolPicker value={symbol} onChange={onSymbolChange} />}
            <IntervalTabs
              value={interval}
              onChange={onIntervalChange}
              intervals={TRADE_CHART_INTERVALS}
            />
          </div>
          <span className="font-mono text-[12px] uppercase tracking-wider text-text-muted">
            {trades.length} trade{trades.length === 1 ? '' : 's'} · {symbol.replace(/USDT$/, '')}
          </span>
        </div>
      )}

      <div className="border-b border-bd-subtle px-4">
        <IndicatorBar indicators={indicators} onToggle={toggle} />
      </div>

      <div className="relative">
        {trades.length === 0 || !chartWindow ? (
          <EmptyChart symbol={symbol} />
        ) : candlesQ.isError ? (
          <ChartError onRetry={() => candlesQ.refetch()} height={height} />
        ) : candlesQ.isLoading && !candlesQ.data ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : (
          <BacktestAnnotatedChart
            candles={candlesQ.data ?? EMPTY_CANDLES}
            trades={adapted}
            selectedTradeId={selectedTradeId}
            onTradeSelect={handleSelect}
            scrollTrigger={scrollTrigger}
            features={indicatorsQ.data ?? EMPTY_FEATURES}
            emaWarmupCandles={warmupQ.data ?? EMPTY_CANDLES}
            showIndicators={indicators}
            exitLabelMode="action"
            height={height}
          />
        )}
      </div>
    </div>
  );
}

function noop() {}

/**
 * Candle fetch window = [min entry, max(exit ?? now)] padded by at least
 * {@link MIN_CONTEXT_BARS} on each side, then clamped to {@link MAX_BARS} total
 * (keeping the most recent slice). Returns null when no trade has a usable
 * entry time, so the caller renders an empty state instead of a blank chart.
 */
function computeWindow(
  trades: Trades[],
  interval: ChartInterval,
): { fromMs: number; toMs: number } | null {
  const now = Date.now();
  let minEntry = Infinity;
  let maxExit = -Infinity;
  for (const t of trades) {
    if (!Number.isFinite(t.entryTime) || t.entryTime <= 0) continue;
    if (t.entryTime < minEntry) minEntry = t.entryTime;
    const end = t.exitTime ?? now;
    if (end > maxExit) maxExit = end;
  }
  if (!Number.isFinite(minEntry)) return null;
  if (maxExit < minEntry) maxExit = minEntry;

  const stepMs = (INTERVAL_SECONDS[interval] ?? 3_600) * 1_000;
  const span = maxExit - minEntry;
  const pad = Math.max(span * 0.15, MIN_CONTEXT_BARS * stepMs);

  // Round to integer epoch-ms: span*0.15 is fractional, and the candle API
  // rejects non-integer timestamps ("Unsupported date format: …503.2"). Floor
  // the start / ceil the end so the window still fully covers the trades.
  const toMs = Math.ceil(maxExit + pad);
  let fromMs = Math.floor(minEntry - pad);

  const maxSpanMs = MAX_BARS * stepMs;
  if (toMs - fromMs > maxSpanMs) fromMs = toMs - maxSpanMs;
  // Never emit a pre-epoch start — a degenerate span on a coarse interval could
  // otherwise pad below 0 and send a negative timestamp to the candle API.
  if (fromMs < 0) fromMs = 0;

  return { fromMs, toMs };
}

function EmptyChart({ symbol }: { symbol: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-[14px] text-text-muted">
      <LineChart size={20} className="opacity-40" />
      <span>No trades on {symbol.replace(/USDT$/, '')} in this view.</span>
      <span className="text-text-muted/70 text-[13px]">
        Pick another symbol or widen the date range.
      </span>
    </div>
  );
}

function ChartError({ onRetry, height }: { onRetry: () => void; height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-[14px] text-text-muted"
      style={{ height }}
    >
      <AlertCircle size={20} />
      <span>Failed to load candles for this window.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[13px] text-text-primary hover:bg-bg-hover"
      >
        <RefreshCw size={11} /> Retry
      </button>
    </div>
  );
}
