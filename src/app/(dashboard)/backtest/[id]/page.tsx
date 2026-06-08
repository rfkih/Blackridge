'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  PlayCircle,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { RunSourceBadge } from '@/components/backtest/RunSourceBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { BacktestMetricsGrid } from '@/components/backtest/BacktestMetricsGrid';
import { BacktestMonthlyReturns } from '@/components/backtest/BacktestMonthlyReturns';
import { BacktestTradeTable } from '@/components/backtest/BacktestTradeTable';
import { FundingRatePanel } from '@/components/backtest/FundingRatePanel';
import { AnalysisCard } from '@/components/research/AnalysisCard';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { BacktestActivateStrategyDialog } from '@/components/backtest/BacktestActivateStrategyDialog';
import { isHedging } from '@/lib/strategyKind';
import { buyHoldSeries, compareToBuyHold, maxDrawdownPct, totalReturnPct } from '@/lib/buyHold';
import { btcStackSeries, type BtcStackPoint, type EquitySample } from '@/lib/hedging/btcCompare';
import {
  useBacktestCandles,
  useBacktestEquityPoints,
  useBacktestProgressStream,
  useBacktestRun,
  useBacktestTrades,
  useCancelBacktestRun,
} from '@/hooks/useBacktest';
import { useAccountStrategies } from '@/hooks/useStrategies';
import { useChartIndicators } from '@/hooks/useChartIndicators';
import { useBacktestIndicators } from '@/hooks/useBacktestIndicators';
import { useEmaWarmupCandles } from '@/hooks/useEmaWarmupCandles';
import { IndicatorBar } from '@/components/charts/IndicatorBar';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { cn } from '@/lib/utils';
import type { BacktestEquityPoint, BacktestRun, BacktestTrade } from '@/types/backtest';
import type { AccountStrategy } from '@/types/strategy';
import { BacktestProgressBar } from '@/components/backtest/BacktestProgressBar';
import type { CandleData, IndicatorData } from '@/types/market';
import { DrawdownVsBuyHoldPanel } from '@/components/hedging/DrawdownVsBuyHoldPanel';
import { BtcStackPanel } from '@/components/hedging/BtcStackPanel';

const EMPTY_TRADES: BacktestTrade[] = [];
const EMPTY_CANDLES: CandleData[] = [];
const EMPTY_EQUITY: BacktestEquityPoint[] = [];
const EMPTY_FEATURES: IndicatorData[] = [];

const BacktestAnnotatedChart = dynamic(
  () =>
    import('@/components/backtest/BacktestAnnotatedChart').then((m) => m.BacktestAnnotatedChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const BacktestEquityPanel = dynamic(
  () => import('@/components/backtest/BacktestEquityPanel').then((m) => m.BacktestEquityPanel),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> },
);

export default function BacktestResultPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const idIsValid = typeof id === 'string' && id.length > 0 && id !== 'undefined' && id !== 'null';

  const runQ = useBacktestRun(idIsValid ? id : undefined);
  const cancelM = useCancelBacktestRun(idIsValid ? id : undefined);

  useBacktestProgressStream(idIsValid ? id : undefined);
  const tradesQ = useBacktestTrades(idIsValid ? id : undefined);
  const candlesQ = useBacktestCandles(idIsValid ? id : undefined);
  const equityQ = useBacktestEquityPoints(idIsValid ? id : undefined);

  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const [tableScrollTrigger, setTableScrollTrigger] = useState(0);
  const [chartScrollTrigger, setChartScrollTrigger] = useState(0);

  const [filteredTrades, setFilteredTrades] = useState<BacktestTrade[] | null>(null);

  const [activateDialogOpen, setActivateDialogOpen] = useState(false);

  const { data: strategies = [] } = useAccountStrategies();

  // Chart indicators: persisted toggle state + lazy fetch of indicator series
  // for this run's exact window. fromDate/toDate are ISO-8601 strings on the
  // normalized run, so convert to epoch ms for the range fetch.
  const { indicators, toggle, anyActive } = useChartIndicators(
    'blackheart:backtest-indicators',
  );
  const fromMs = runQ.data?.fromDate ? new Date(runQ.data.fromDate).getTime() : undefined;
  const toMs = runQ.data?.toDate ? new Date(runQ.data.toDate).getTime() : undefined;
  const indicatorsQ = useBacktestIndicators(
    runQ.data?.symbol,
    runQ.data?.interval,
    fromMs,
    toMs,
    anyActive,
  );
  // EMA-100 is computed client-side over [warmup + window]. A 100-period EMA
  // needs 100 prior bars, so without warmup it's blank for the first ~100 of a
  // short window. Fetch ~150 candles before the window — only when ema100 is on.
  const warmupQ = useEmaWarmupCandles(
    runQ.data?.symbol,
    runQ.data?.interval,
    fromMs,
    indicators.ema100,
  );

  const liveSourceStrategies = useMemo(() => {
    if (!runQ.data || runQ.data.status !== 'COMPLETED' || !strategies.length) return [];
    const boundIds = new Set(Object.values(runQ.data.strategyAccountStrategyIds ?? {}));
    return strategies.filter((s) => boundIds.has(s.id) && s.status === 'LIVE');
  }, [runQ.data, strategies]);

  /**
   * Derived data for the hedging DrawdownVsBuyHoldPanel. Computed only when
   * both equity points and candles are available; otherwise the panel renders
   * its own honest empty state. Logic mirrors what BacktestEquityPanel does
   * internally for its buy-hold overlay.
   */
  const hedgingDrawdownData = useMemo(() => {
    const equity = equityQ.data;
    const candles = candlesQ.data;
    const capital = runQ.data?.initialCapital;
    if (!equity?.length || !candles?.length || !capital) return null;

    // Align buy-hold series to equity timestamps (same logic as BacktestEquityPanel).
    const bh = buyHoldSeries(
      candles.map((c) => ({ ts: c.time * 1_000, close: c.close })),
      capital,
    );
    if (!bh.length) return null;

    // Map equity drawdown series.
    const strategySeries = equity.map((p) => ({ time: p.ts, drawdownPct: p.drawdownPct }));

    // Compute buy-hold drawdown by stepping through equity timestamps.
    let bhIdx = 0;
    const buyHoldAligned: Array<{ ts: number; equity: number }> = [];
    for (const p of equity) {
      while (bhIdx + 1 < bh.length && bh[bhIdx + 1].ts <= p.ts) bhIdx++;
      buyHoldAligned.push({ ts: p.ts, equity: bh[bhIdx].value });
    }

    // Compute running peak-to-trough drawdown for the buy-hold series.
    let peak = buyHoldAligned[0]?.equity ?? 0;
    const buyHoldSeries2 = buyHoldAligned.map((p) => {
      if (p.equity > peak) peak = p.equity;
      const dd = peak > 0 ? (p.equity / peak - 1) * 100 : 0;
      return { time: p.ts, drawdownPct: dd };
    });

    // Compute verdict for the panel caption.
    const strategyEndEquity = equity[equity.length - 1]?.equity ?? capital;
    const strategyReturnPctVal = totalReturnPct(capital, strategyEndEquity);
    const strategyMaxDdPctVal =
      equity.reduce((acc, p) => (p.drawdownPct < acc ? p.drawdownPct : acc), 0);

    const bhFirst = buyHoldAligned[0]?.equity ?? capital;
    const bhLast = buyHoldAligned[buyHoldAligned.length - 1]?.equity ?? capital;
    const bhReturnPctVal = totalReturnPct(bhFirst, bhLast);
    const bhMaxDdPctVal = maxDrawdownPct(buyHoldAligned.map((p) => ({ value: p.equity })));

    const verdict = compareToBuyHold(
      strategyReturnPctVal,
      strategyMaxDdPctVal,
      bhReturnPctVal,
      bhMaxDdPctVal,
    );

    return { strategySeries, buyHoldSeries: buyHoldSeries2, verdict };
  }, [equityQ.data, candlesQ.data, runQ.data?.initialCapital]);

  /**
   * Absolute BTC-stack curve ("ended with N× the BTC of buy-hold"). Mirrors
   * the exact join in `useBtcBuyHold`: equity samples ({time: ts, equity})
   * day-aligned (`alignClosesToEquity` inside `btcStackSeries`) to ms-normalized
   * BTC closes, so the math is identical to the live hedging dashboard. `null`
   * until both equity + candles load; the panel renders its own empty state.
   */
  const btcStack = useMemo<BtcStackPoint[] | null>(() => {
    const equity = equityQ.data;
    const candles = candlesQ.data;
    if (!equity?.length || !candles?.length) return null;
    const equitySamples: EquitySample[] = equity.map((p) => ({ time: p.ts, equity: p.equity }));
    const closes = candles.map((c) => ({ ts: c.time * 1_000, close: c.close }));
    const series = btcStackSeries(equitySamples, closes);
    return series.length ? series : null;
  }, [equityQ.data, candlesQ.data]);

  const handleChartSelect = useCallback((tradeId: string | null) => {
    setSelectedTradeId(tradeId);
    setTableScrollTrigger((t) => t + 1);
  }, []);

  const handleTableSelect = useCallback((tradeId: string | null) => {
    setSelectedTradeId(tradeId);
    setChartScrollTrigger((t) => t + 1);
  }, []);

  const hydrateFromRun = useBacktestParamStore((s) => s.hydrateFromRun);

  const handleRerun = useCallback(() => {
    if (!runQ.data) return;
    const run = runQ.data;
    const codes = (run.strategyCode ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const persisted = run.strategyAccountStrategyIds ?? {};
    const strategyAccountStrategyIds: Record<string, string> = {};
    for (const code of codes) {
      strategyAccountStrategyIds[code] = persisted[code] ?? run.accountStrategyId;
    }

    hydrateFromRun(
      {
        symbol: run.symbol,
        interval: run.interval,
        fromDate: run.fromDate,
        toDate: run.toDate,
        initialCapital: run.initialCapital,
        strategyCodes: codes,
        strategyAccountStrategyIds,

        allowLong: run.allowLong ?? true,
        allowShort: run.allowShort ?? false,
        maxConcurrentStrategies: run.maxConcurrentStrategies ?? undefined,
        strategyAllocations: run.strategyAllocations ?? undefined,
        strategyRiskPcts: run.strategyRiskPcts ?? undefined,
        strategyAllowLong: run.strategyAllowLong ?? undefined,
        strategyAllowShort: run.strategyAllowShort ?? undefined,

        strategyKillSwitchOverrides: run.strategyKillSwitchOverrides ?? undefined,
        strategyRegimeOverrides: run.strategyRegimeOverrides ?? undefined,
        strategyCorrelationOverrides: run.strategyCorrelationOverrides ?? undefined,
        strategyConcurrentCapOverrides: run.strategyConcurrentCapOverrides ?? undefined,
        strategyIntervals: run.strategyIntervals ?? undefined,
        evaluationMode: run.strategyIntervals ? 'multi' : 'single',
      },
      run.paramSnapshot ?? {},
      run.id,
    );
    router.push('/backtest/new');
  }, [runQ.data, hydrateFromRun, router]);

  if (!idIsValid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-bd-subtle bg-bg-surface p-8 text-center shadow-panel">
          <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
            Invalid run id
          </p>
          <h1 className="mt-3 font-display text-2xl text-text-primary">
            This backtest link is broken
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            The URL doesn&apos;t point to a real run. Try picking one from the list instead.
          </p>
          <Link
            href="/backtest"
            className="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
          >
            <ArrowLeft size={12} strokeWidth={1.75} /> Back to runs
          </Link>
        </div>
      </div>
    );
  }

  if (runQ.isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ErrorState message="Could not load this backtest run." onRetry={() => runQ.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResultHeader
        run={runQ.data}
        isLoading={runQ.isLoading}
        onRerun={handleRerun}
        onActivate={() => setActivateDialogOpen(true)}
        liveSourceStrategies={liveSourceStrategies}
      />

      {}
      {liveSourceStrategies.length === 0 &&
        runQ.data &&
        runQ.data.status === 'COMPLETED' &&
        activateDialogOpen && (
          <BacktestActivateStrategyDialog
            run={runQ.data}
            open={activateDialogOpen}
            onClose={() => setActivateDialogOpen(false)}
          />
        )}

      {runQ.data && (
        <BacktestProgressBar
          run={runQ.data}
          onCancel={() => cancelM.mutate()}
          canceling={cancelM.isPending}
        />
      )}

      {runQ.data && <RunConfigPanel run={runQ.data} />}

      <BacktestMetricsGrid
        metrics={runQ.data?.metrics ?? null}
        isLoading={runQ.isLoading}
        strategyKind={runQ.data?.strategyKind}
        endingBalance={runQ.data?.endingBalance}
        initialCapital={runQ.data?.initialCapital}
      />

      {runQ.data && !isHedging(runQ.data.strategyKind) && (
        <ErrorBoundary label="Funding rate">
          <FundingRatePanel
            symbol={runQ.data.symbol}
            fromDate={runQ.data.fromDate}
            toDate={runQ.data.toDate}
            configuredBpsPer8h={runQ.data.fundingRateBpsPer8h}
          />
        </ErrorBoundary>
      )}

      {idIsValid && runQ.data?.status?.toUpperCase() === 'COMPLETED' && (
        <ErrorBoundary label="Research analysis">
          <AnalysisCard runId={id} />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="Equity curve">
        <BacktestEquityPanel
          points={equityQ.data ?? EMPTY_EQUITY}
          initialCapital={runQ.data?.initialCapital ?? 0}
          isLoading={equityQ.isLoading}
          candles={candlesQ.data}
          symbol={runQ.data?.symbol}
        />
      </ErrorBoundary>

      {isHedging(runQ.data?.strategyKind) && (
        <ErrorBoundary label="Drawdown vs buy-hold">
          <DrawdownVsBuyHoldPanel
            strategySeries={hedgingDrawdownData?.strategySeries ?? null}
            buyHoldSeries={hedgingDrawdownData?.buyHoldSeries ?? null}
            verdict={hedgingDrawdownData?.verdict ?? null}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="BTC stack">
        <BtcStackPanel series={equityQ.isLoading || candlesQ.isLoading ? null : btcStack} />
      </ErrorBoundary>

      <ErrorBoundary label="Monthly returns">
        <BacktestMonthlyReturns
          points={equityQ.data ?? EMPTY_EQUITY}
          isLoading={equityQ.isLoading}
        />
      </ErrorBoundary>

      <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-[13px] font-semibold text-text-primary">
            {isHedging(runQ.data?.strategyKind) ? 'Allocation Switches' : 'Trade Execution'}
          </h3>
          {selectedTradeId && (
            <button
              type="button"
              onClick={() => handleTableSelect(null)}
              className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary"
            >
              Clear selection
            </button>
          )}
        </div>
        {candlesQ.isError ? (
          <div className="p-6">
            <ErrorState
              message="Could not load candles for this run."
              onRetry={() => candlesQ.refetch()}
            />
          </div>
        ) : candlesQ.isLoading || tradesQ.isLoading ? (
          <ChartSkeleton />
        ) : (
          <ErrorBoundary label="Annotated chart">
            <div className="px-2 pt-1">
              <IndicatorBar indicators={indicators} onToggle={toggle} />
            </div>
            <BacktestAnnotatedChart
              candles={candlesQ.data ?? EMPTY_CANDLES}
              trades={filteredTrades ?? tradesQ.data ?? EMPTY_TRADES}
              selectedTradeId={selectedTradeId}
              onTradeSelect={handleChartSelect}
              scrollTrigger={chartScrollTrigger}
              features={indicatorsQ.data ?? EMPTY_FEATURES}
              emaWarmupCandles={warmupQ.data ?? EMPTY_CANDLES}
              showIndicators={indicators}
            />
          </ErrorBoundary>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-[14px] font-semibold text-text-primary">
            Trades{' '}
            <span className="ml-1 font-mono text-[11px] text-text-muted">
              {(tradesQ.data?.length ?? 0).toLocaleString()} total
            </span>
          </h3>
        </div>
        {tradesQ.isError ? (
          <ErrorState
            message="Could not load trades for this run."
            onRetry={() => tradesQ.refetch()}
          />
        ) : tradesQ.isLoading ? (
          <TableSkeleton />
        ) : (
          <ErrorBoundary label="Trade table">
            <BacktestTradeTable
              trades={tradesQ.data ?? EMPTY_TRADES}
              selectedTradeId={selectedTradeId}
              onTradeSelect={handleTableSelect}
              scrollTrigger={tableScrollTrigger}
              onFilteredTradesChange={setFilteredTrades}
              strategyKind={runQ.data?.strategyKind}
            />
          </ErrorBoundary>
        )}
      </section>

      {runQ.data && <ReproducibilityPanel run={runQ.data} />}
    </div>
  );
}

interface ResultHeaderProps {
  run: BacktestRun | undefined;
  isLoading: boolean;
  onRerun: () => void;
  onActivate: () => void;
  liveSourceStrategies: AccountStrategy[];
}

function ResultHeader({
  run,
  isLoading,
  onRerun,
  onActivate,
  liveSourceStrategies,
}: ResultHeaderProps) {
  const codes = useMemo(
    () =>
      (run?.strategyCode ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [run?.strategyCode],
  );

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Link
          href="/backtest"
          className="inline-flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={12} strokeWidth={1.75} /> Back to runs
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            {isLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <>
                Run{' '}
                <span className="font-mono text-[14px] text-text-muted">
                  #{run?.id.slice(0, 8) ?? '—'}
                </span>
              </>
            )}
          </h1>
          <RunStatusPill status={run?.status} />
          {run && <RunSourceBadge source={run.triggeredBy} size="md" />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
          {codes.length === 0 ? (
            isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : null
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {codes.map((code) => (
                <StrategyBadge key={code} code={code} size="sm" />
              ))}
            </div>
          )}
          {run && (
            <>
              <span className="num text-text-primary">{run.symbol}</span>
              <span className="num text-text-muted">{run.interval}</span>
              <span className="num text-text-muted">
                {safeDateFmt(run.fromDate)} <span className="mx-1">→</span>{' '}
                {safeDateFmt(run.toDate)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {run?.status === 'COMPLETED' &&
          (liveSourceStrategies.length > 0 ? (

            <div className="border-[var(--color-profit)]/30 bg-[var(--color-profit)]/5 inline-flex items-center gap-2 rounded-full border px-3 py-2">
              <Zap size={13} strokeWidth={2} className="text-[var(--color-profit)]/70 shrink-0" />
              <span className="text-[12px] text-[var(--text-secondary)]">Active strategy</span>
              <span className="h-3 w-px bg-[var(--border-subtle)]" aria-hidden />
              <Link
                href={`/strategies/${liveSourceStrategies[0].id}`}
                className="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--color-profit)] hover:underline"
              >
                {liveSourceStrategies[0].strategyCode} · {liveSourceStrategies[0].symbol}
                {liveSourceStrategies.length > 1 && (
                  <span className="text-[var(--color-profit)]/70 ml-0.5">
                    +{liveSourceStrategies.length - 1}
                  </span>
                )}
                <ExternalLink size={10} strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold',
                'bg-profit text-text-inverse transition-opacity hover:opacity-90',
              )}
            >
              <Zap size={13} strokeWidth={2} />
              Activate as Strategy
            </button>
          ))}
        <button
          type="button"
          onClick={onRerun}
          disabled={!run}
          className={cn(
            'mm-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          style={{ borderRadius: 9999, padding: '9px 16px', fontSize: 13 }}
        >
          <PlayCircle size={14} strokeWidth={2} />
          Re-run with these params
        </button>
      </div>
    </header>
  );
}

/**
 * Surfaces the per-strategy sizing config that was used for this run —
 * allocation %, risk/trade %, and direction. Placed before the metrics grid
 * so users read the sizing context before interpreting the numbers (a +20%
 * return on 5% allocation is very different from 50% allocation).
 * Renders nothing when none of these fields are populated (older runs).
 */
function RunConfigPanel({ run }: { run: BacktestRun }) {
  const codes = useMemo(
    () =>
      (run.strategyCode ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [run.strategyCode],
  );

  const hasAllocations =
    run.strategyAllocations != null && Object.keys(run.strategyAllocations).length > 0;
  const hasRiskPcts = run.strategyRiskPcts != null && Object.keys(run.strategyRiskPcts).length > 0;
  const hasDirections =
    (run.strategyAllowLong != null && Object.keys(run.strategyAllowLong).length > 0) ||
    (run.strategyAllowShort != null && Object.keys(run.strategyAllowShort).length > 0);

  if (!hasAllocations && !hasRiskPcts && !hasDirections) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface shadow-panel">
      <div className="flex items-center gap-2 border-b border-bd-subtle px-4 py-2.5">
        <Scale size={13} className="shrink-0 text-text-muted" />
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Position sizing
        </h3>
        {run.maxConcurrentStrategies != null && run.maxConcurrentStrategies > 1 && (
          <span className="ml-auto font-mono text-[10px] text-text-muted">
            max {run.maxConcurrentStrategies} concurrent
          </span>
        )}
      </div>
      <div className="divide-y divide-bd-subtle">
        {codes.map((code) => {
          const allocation = run.strategyAllocations?.[code];
          const riskPct = run.strategyRiskPcts?.[code];
          const allowLong = run.strategyAllowLong?.[code];
          const allowShort = run.strategyAllowShort?.[code];

          const dir = (() => {
            if (allowLong == null || allowShort == null) return null;
            if (allowLong && allowShort) return 'Long + Short';
            if (allowLong) return 'Long only';
            if (allowShort) return 'Short only';
            return null;
          })();

          return (
            <div
              key={code}
              className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-[12px]"
            >
              {codes.length > 1 && (
                <span className="w-16 font-mono font-semibold text-text-primary">{code}</span>
              )}
              {allocation != null ? (
                <span className="text-text-secondary">
                  Allocation{' '}
                  <span className="font-mono font-semibold text-text-primary">
                    {allocation.toFixed(1)}%
                  </span>
                </span>
              ) : (
                <span className="font-mono text-[11px] text-text-muted">default allocation</span>
              )}
              {riskPct != null && (
                <span className="text-text-secondary">
                  Risk/trade{' '}
                  <span className="font-mono font-semibold text-text-primary">
                    {(riskPct * 100).toFixed(2)}%
                  </span>
                </span>
              )}
              {dir && (
                <span className="text-text-secondary">
                  Direction <span className="font-mono font-semibold text-text-primary">{dir}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RunStatusPill({ status }: { status: string | undefined }) {
  if (!status) return null;
  const normalised = status.toUpperCase();
  const style = (() => {
    if (normalised === 'COMPLETED')
      return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)', label: 'Complete' };
    if (normalised === 'RUNNING')
      return { bg: 'var(--tint-info)', fg: 'var(--color-info)', label: 'Running' };
    if (normalised === 'PENDING')
      return { bg: 'var(--tint-warning)', fg: 'var(--color-warning)', label: 'Queued' };
    if (normalised === 'FAILED')
      return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)', label: 'Failed' };
    return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)', label: status };
  })();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: style.fg }}
      />
      {style.label}
    </span>
  );
}

function safeDateFmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd');
}

function ChartSkeleton() {
  return (
    <div className="relative p-2">
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-0 rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-bd-subtle py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-bd-subtle bg-bg-surface px-6 py-10 text-center shadow-panel">
      <AlertCircle size={20} className="text-text-muted" />
      <p className="text-sm text-text-secondary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}

/**
 * Footer panel showing the manifest captured at submission: git SHA + app
 * version, asset/interval/window, and the param overrides applied. With
 * these values + the strategy code, this run can be replayed identically
 * months later.
 */
function ReproducibilityPanel({ run }: { run: BacktestRun }) {
  const sha = run.gitCommitSha ?? '—';
  const shortSha = sha !== '—' && sha !== 'unknown' ? sha.slice(0, 12) : sha;
  const version = run.appVersion ?? '—';
  const overrideEntries = run.paramSnapshot
    ? Object.entries(run.paramSnapshot).filter(([, kv]) => kv && Object.keys(kv).length > 0)
    : [];
  const overrideCount = overrideEntries.reduce((acc, [, kv]) => acc + Object.keys(kv).length, 0);
  const effectiveEntries = run.effectiveParamsSnapshot
    ? Object.entries(run.effectiveParamsSnapshot).filter(
        ([, kv]) => kv && Object.keys(kv).length > 0,
      )
    : [];
  const effectiveCount = effectiveEntries.reduce((acc, [, kv]) => acc + Object.keys(kv).length, 0);

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface shadow-panel">
      <div className="border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">
          Reproducibility
        </h3>
        <p className="mt-0.5 text-[11px] text-text-muted">
          Manifest captured at submission. With these values + the strategy code, this run can be
          replayed identically.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-[12px] sm:grid-cols-4">
        <ManifestField label="Git SHA" mono title={sha}>
          {shortSha}
        </ManifestField>
        <ManifestField label="App version" mono>
          {version}
        </ManifestField>
        <ManifestField label="Strategy code" mono>
          {run.strategyCode || '—'}
        </ManifestField>
        <ManifestField label="Param overrides">
          {overrideCount === 0 ? (
            <span className="text-text-muted">defaults</span>
          ) : (
            `${overrideCount} key${overrideCount === 1 ? '' : 's'}`
          )}
        </ManifestField>
      </dl>
      {overrideEntries.length > 0 && (
        <div className="border-t border-bd-subtle px-4 py-3">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Override values <span className="text-text-muted/70 ml-1 normal-case">(deltas vs defaults)</span>
          </p>
          <ParamSnapshotTables entries={overrideEntries} />
        </div>
      )}
      {effectiveEntries.length > 0 && (
        <details className="border-t border-bd-subtle px-4 py-3">
          <summary className="cursor-pointer select-none font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Effective params{' '}
            <span className="text-text-muted/70 normal-case">
              ({effectiveCount} key{effectiveCount === 1 ? '' : 's'}, defaults + overrides — what
              activation replays)
            </span>
          </summary>
          <div className="mt-2">
            <ParamSnapshotTables entries={effectiveEntries} />
          </div>
        </details>
      )}
    </section>
  );
}

function ParamSnapshotTables({
  entries,
}: {
  entries: Array<[string, Record<string, unknown>]>;
}) {
  return (
    <div className="space-y-3">
      {entries.map(([code, kv]) => (
        <div key={code}>
          <p className="font-mono text-[11px] font-semibold text-text-primary">{code}</p>
          <table className="mt-1 w-full font-mono text-[11px]">
            <tbody>
              {Object.entries(kv).map(([k, v]) => (
                <tr key={k} className="border-bd-subtle/60 border-t">
                  <td className="py-1 pr-3 text-text-secondary">{k}</td>
                  <td className="py-1 tabular-nums text-text-primary">
                    {formatOverrideValue(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function formatOverrideValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function ManifestField({
  label,
  children,
  mono,
  title,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className={cn('text-text-primary', mono && 'font-mono')} title={title}>
        {children}
      </dd>
    </div>
  );
}
