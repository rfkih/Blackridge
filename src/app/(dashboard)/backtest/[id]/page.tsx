'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, PlayCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { BacktestMetricsGrid } from '@/components/backtest/BacktestMetricsGrid';
import { BacktestEquityPanel } from '@/components/backtest/BacktestEquityPanel';
import { BacktestTradeTable } from '@/components/backtest/BacktestTradeTable';
import {
  useBacktestCandles,
  useBacktestEquityPoints,
  useBacktestRun,
  useBacktestTrades,
} from '@/hooks/useBacktest';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { cn } from '@/lib/utils';
import type {
  BacktestEquityPoint,
  BacktestRun,
  BacktestTrade,
} from '@/types/backtest';
import type { CandleData } from '@/types/market';

// Module-level empty arrays so render-time fallbacks don't churn referential
// identity. Without these, every "loading" render hands child memos a fresh
// `[]`, which busts buildTradeMarkers / equity transforms downstream.
const EMPTY_TRADES: BacktestTrade[] = [];
const EMPTY_CANDLES: CandleData[] = [];
const EMPTY_EQUITY: BacktestEquityPoint[] = [];

// TradingView is not SSR-safe — load the whole chart component on the client.
const BacktestAnnotatedChart = dynamic(
  () =>
    import('@/components/backtest/BacktestAnnotatedChart').then((m) => m.BacktestAnnotatedChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export default function BacktestResultPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  // Route params can legitimately be the literal string "undefined" when an
  // upstream caller built the URL from a run whose id was missing. Treating
  // that as a routing error beats silently 404-ing against the backend.
  const idIsValid =
    typeof id === 'string' && id.length > 0 && id !== 'undefined' && id !== 'null';

  const runQ = useBacktestRun(idIsValid ? id : undefined);
  const tradesQ = useBacktestTrades(idIsValid ? id : undefined);
  const candlesQ = useBacktestCandles(idIsValid ? id : undefined);
  const equityQ = useBacktestEquityPoints(idIsValid ? id : undefined);

  if (!idIsValid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-md border border-bd-subtle bg-bg-surface p-8 text-center shadow-panel">
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
            className="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
          >
            <ArrowLeft size={12} strokeWidth={1.75} /> Back to runs
          </Link>
        </div>
      </div>
    );
  }

  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  // Two separate triggers so a chart→table scroll never loops back into a
  // chart scroll, and vice versa.
  const [tableScrollTrigger, setTableScrollTrigger] = useState(0);
  const [chartScrollTrigger, setChartScrollTrigger] = useState(0);

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
    // Prefer the per-strategy mapping the backend captured at submit time.
    // Falls back to pinning every code to the run's default accountStrategyId
    // so single-strategy legacy runs still resolve.
    const persisted = run.strategyAccountStrategyIds ?? {};
    const strategyAccountStrategyIds: Record<string, string> = {};
    for (const code of codes) {
      strategyAccountStrategyIds[code] = persisted[code] ?? run.accountStrategyId;
    }
    // paramSnapshot is the exact diff-vs-defaults we sent on submission; replay
    // it into the wizard so "Re-run with these params" is a true replay rather
    // than re-tuning from scratch.
    hydrateFromRun(
      {
        symbol: run.symbol,
        interval: run.interval,
        fromDate: run.fromDate,
        toDate: run.toDate,
        initialCapital: run.initialCapital,
        strategyCodes: codes,
        strategyAccountStrategyIds,
      },
      run.paramSnapshot ?? {},
    );
    router.push('/backtest/new');
  }, [runQ.data, hydrateFromRun, router]);

  if (runQ.isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ErrorState message="Could not load this backtest run." onRetry={() => runQ.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResultHeader run={runQ.data} isLoading={runQ.isLoading} onRerun={handleRerun} />

      <BacktestMetricsGrid metrics={runQ.data?.metrics ?? null} isLoading={runQ.isLoading} />

      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-[13px] font-semibold text-text-primary">
            Trade Execution
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
          <BacktestAnnotatedChart
            candles={candlesQ.data ?? EMPTY_CANDLES}
            trades={tradesQ.data ?? EMPTY_TRADES}
            selectedTradeId={selectedTradeId}
            onTradeSelect={handleChartSelect}
            scrollTrigger={chartScrollTrigger}
          />
        )}
      </section>

      <BacktestEquityPanel
        points={equityQ.data ?? EMPTY_EQUITY}
        initialCapital={runQ.data?.initialCapital ?? 0}
        isLoading={equityQ.isLoading}
      />

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
          <BacktestTradeTable
            trades={tradesQ.data ?? EMPTY_TRADES}
            selectedTradeId={selectedTradeId}
            onTradeSelect={handleTableSelect}
            scrollTrigger={tableScrollTrigger}
          />
        )}
      </section>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface ResultHeaderProps {
  run: BacktestRun | undefined;
  isLoading: boolean;
  onRerun: () => void;
}

function ResultHeader({ run, isLoading, onRerun }: ResultHeaderProps) {
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
      <button
        type="button"
        onClick={onRerun}
        disabled={!run}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-primary',
          'transition-colors duration-fast hover:bg-bg-hover',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <PlayCircle size={14} strokeWidth={2} />
        Re-run with these params
      </button>
    </header>
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
    if (normalised === 'FAILED')
      return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)', label: 'Failed' };
    return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)', label: status };
  })();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
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

// ─── Loading / error states ──────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="relative p-2">
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-0 rounded-md border border-bd-subtle bg-bg-surface p-4">
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-bd-subtle bg-bg-surface px-6 py-10 text-center">
      <AlertCircle size={20} className="text-text-muted" />
      <p className="text-sm text-text-secondary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
