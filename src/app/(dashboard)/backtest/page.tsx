'use client';

import Link from 'next/link';
import { ChevronRight, FlaskConical, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktestRuns } from '@/hooks/useBacktest';
import { cn } from '@/lib/utils';
import type { BacktestRun, BacktestStatus } from '@/types/backtest';
import { format } from 'date-fns';

interface StatusStyle {
  label: string;
  text: string;
  bg: string;
  dotPulse: boolean;
}

const STATUS_META: Record<BacktestStatus, StatusStyle> = {
  RUNNING: {
    label: 'Running',
    text: 'var(--color-info)',
    bg: 'var(--tint-info)',
    dotPulse: true,
  },
  COMPLETED: {
    label: 'Complete',
    text: 'var(--color-profit)',
    bg: 'var(--tint-profit)',
    dotPulse: false,
  },
  FAILED: {
    label: 'Failed',
    text: 'var(--color-loss)',
    bg: 'var(--tint-loss)',
    dotPulse: false,
  },
};

const UNKNOWN_STATUS: StatusStyle = {
  label: 'Unknown',
  text: 'var(--text-muted)',
  bg: 'var(--bg-elevated)',
  dotPulse: false,
};

/** Resolve a status (possibly an unexpected string from the backend) to a visual style. */
function resolveStatusMeta(status: string): StatusStyle {
  const normalized = status?.toUpperCase?.() as BacktestStatus | undefined;
  if (normalized && normalized in STATUS_META) return STATUS_META[normalized];
  return { ...UNKNOWN_STATUS, label: status || 'Unknown' };
}

export default function BacktestListPage() {
  const { data: runs = [], isLoading, isError, refetch } = useBacktestRuns();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="label-caps">Backtests</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Run History
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Simulate strategies against historical data. Results persist; re-run with tweaked params
            any time.
          </p>
        </div>
        <Link
          href="/backtest/new"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm bg-profit px-3 py-2 text-[12px] font-semibold text-text-inverse',
            'transition-opacity duration-fast hover:opacity-90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Plus size={14} strokeWidth={2} />
          New Backtest
        </Link>
      </header>

      {isError ? (
        <EmptyState
          icon={FlaskConical}
          title="Could not load backtests"
          description="The backtest endpoint returned an error."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
            >
              Retry
            </button>
          }
        />
      ) : isLoading ? (
        <BacktestTableSkeleton />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No backtests yet"
          description="Run your first simulation to see results here."
          action={
            <Link
              href="/backtest/new"
              className="inline-flex items-center gap-1.5 rounded-sm bg-profit px-3 py-2 text-[12px] font-semibold text-text-inverse transition-opacity duration-fast hover:opacity-90"
            >
              <Plus size={13} strokeWidth={2} />
              New Backtest
            </Link>
          }
        />
      ) : (
        <BacktestTable runs={runs} />
      )}
    </div>
  );
}

function BacktestTable({ runs }: { runs: BacktestRun[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle bg-bg-surface">
              {[
                'Run',
                'Strategy',
                'Symbol',
                'Interval',
                'Date Range',
                'Status',
                'Return',
                'Sharpe',
                'Max DD',
                '',
              ].map((col) => (
                <th
                  key={col || 'actions'}
                  className="label-caps whitespace-nowrap px-4 py-3 text-left"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <BacktestRow key={run.id} run={run} index={runs.length - i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BacktestRow({ run, index }: { run: BacktestRun; index: number }) {
  const codes = (run.strategyCode ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const totalReturnPct = run.metrics?.totalReturnPct;
  const sharpe = run.metrics?.sharpe;
  const maxDD = run.metrics?.maxDrawdownPct;

  return (
    <tr
      className={cn(
        'group border-b border-bd-subtle transition-colors duration-fast last:border-b-0',
        'hover:bg-bg-elevated',
      )}
    >
      <td className="num whitespace-nowrap px-4 py-3 text-[12px] text-text-muted">
        #{String(index).padStart(3, '0')}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {codes.map((code) => (
            <StrategyBadge key={code} code={code} size="sm" />
          ))}
        </div>
      </td>
      <td className="num whitespace-nowrap px-4 py-3 text-[13px] text-text-primary">
        {run.symbol}
      </td>
      <td className="num whitespace-nowrap px-4 py-3 text-[12px] text-text-secondary">
        {run.interval}
      </td>
      <td className="num whitespace-nowrap px-4 py-3 text-[11px] text-text-muted">
        {safeDateFmt(run.fromDate)}
        <span className="mx-1 text-text-muted">→</span>
        {safeDateFmt(run.toDate)}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={run.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <ReturnCell value={totalReturnPct} />
      </td>
      <td className="num whitespace-nowrap px-4 py-3 text-[12px] text-text-primary">
        {sharpe != null ? sharpe.toFixed(2) : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className="num text-[12px]"
          style={{ color: maxDD != null ? 'var(--color-loss)' : 'var(--text-muted)' }}
        >
          {maxDD != null ? `−${maxDD.toFixed(2)}%` : '—'}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link
          href={`/backtest/${run.id}`}
          className="inline-flex items-center gap-0.5 text-[11px] text-text-muted opacity-0 transition-all duration-fast hover:text-text-primary group-hover:opacity-100"
        >
          View
          <ChevronRight size={12} strokeWidth={1.75} />
        </Link>
      </td>
    </tr>
  );
}

/** Guard against null / unparseable LocalDateTime strings coming back from old rows. */
function safeDateFmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd');
}

function StatusPill({ status }: { status: BacktestStatus | string }) {
  const meta = resolveStatusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 rounded-full', meta.dotPulse && 'pulse-dot')}
        style={{ backgroundColor: meta.text }}
      />
      {meta.label}
    </span>
  );
}

function ReturnCell({ value }: { value: number | undefined | null }) {
  if (value == null) {
    return <span className="num text-[12px] text-text-muted">—</span>;
  }
  const isUp = value >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className="num inline-flex items-center gap-1 text-[12px] font-semibold"
      style={{ color: isUp ? 'var(--color-profit)' : 'var(--color-loss)' }}
    >
      <Icon size={11} strokeWidth={2} />
      {isUp ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

function BacktestTableSkeleton() {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-surface">
      <div className="space-y-0 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-bd-subtle py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
