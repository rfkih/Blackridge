'use client';

// TanStack Table's idiomatic column defs pass inline `cell: ({ row }) => …`
// renderers. They're memoised as part of `columns` via useMemo; the
// no-unstable-nested-components rule is a false positive for this pattern.
/* eslint-disable react/no-unstable-nested-components */

import Link from 'next/link';
import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type Updater,
} from '@tanstack/react-table';
import { ChevronRight, FlaskConical, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktestRuns } from '@/hooks/useBacktest';
import type { BacktestSortKey } from '@/lib/api/backtest';
import type { BacktestRun, BacktestStatus } from '@/types/backtest';
import { cn } from '@/lib/utils';

const STATUSES: Array<{ value: '' | BacktestStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Complete' },
  { value: 'FAILED', label: 'Failed' },
];

const INTERVALS = ['', '1m', '5m', '15m', '1h', '4h', '1d'] as const;
const PAGE_SIZES = [20, 50, 100];

interface Filters {
  status: '' | BacktestStatus;
  strategyCode: string;
  symbol: string;
  interval: string;
  from: string;
  to: string;
  sortBy: BacktestSortKey;
  sortDir: 'ASC' | 'DESC';
  page: number;
  size: number;
}

const SORTABLE_KEYS: BacktestSortKey[] = [
  'createdAt',
  'symbol',
  'strategyCode',
  'status',
  'returnPct',
  'sharpe',
  'maxDrawdownPct',
  'totalTrades',
  'winRate',
];

function readFilters(params: URLSearchParams): Filters {
  const rawStatus = (params.get('status') ?? '').toUpperCase();
  const status = ['RUNNING', 'COMPLETED', 'FAILED'].includes(rawStatus)
    ? (rawStatus as BacktestStatus)
    : '';
  const rawSortBy = (params.get('sortBy') ?? 'createdAt') as BacktestSortKey;
  const sortBy = SORTABLE_KEYS.includes(rawSortBy) ? rawSortBy : 'createdAt';
  const rawSortDir = (params.get('sortDir') ?? 'DESC').toUpperCase();
  const sortDir: 'ASC' | 'DESC' = rawSortDir === 'ASC' ? 'ASC' : 'DESC';
  const pageRaw = Number(params.get('page'));
  const sizeRaw = Number(params.get('size'));
  return {
    status,
    strategyCode: params.get('strategyCode') ?? '',
    symbol: params.get('symbol') ?? '',
    interval: params.get('interval') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    sortBy,
    sortDir,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 0,
    size: PAGE_SIZES.includes(sizeRaw) ? sizeRaw : 20,
  };
}

export default function BacktestListPage() {
  return (
    <Suspense fallback={<BacktestTableSkeleton />}>
      <BacktestListContent />
    </Suspense>
  );
}

function BacktestListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const patchFilters = useCallback(
    (patch: Partial<Filters>, opts: { resetPage?: boolean } = {}) => {
      const { resetPage = true } = opts;
      const next = new URLSearchParams(searchParams.toString());
      const merged: Filters = { ...filters, ...patch };
      if (resetPage && !('page' in patch)) merged.page = 0;
      const apply = (key: string, value: string | number | undefined | null) => {
        if (value == null || value === '' || value === 0) next.delete(key);
        else next.set(key, String(value));
      };
      apply('status', merged.status);
      apply('strategyCode', merged.strategyCode);
      apply('symbol', merged.symbol);
      apply('interval', merged.interval);
      apply('from', merged.from);
      apply('to', merged.to);
      // Always keep sort in the URL — even defaults — so a shared link
      // reproduces the viewer's exact sort. Hiding the default makes
      // "copy URL" surprising.
      next.set('sortBy', merged.sortBy);
      next.set('sortDir', merged.sortDir);
      apply('page', merged.page || null);
      apply('size', merged.size === 20 ? null : merged.size);
      router.replace(`/backtest${next.toString() ? `?${next.toString()}` : ''}`);
    },
    [filters, router, searchParams],
  );

  const toIsoStart = (d: string) => (d ? `${d}T00:00:00` : undefined);
  const toIsoEnd = (d: string) => (d ? `${d}T23:59:59` : undefined);

  const runsQuery = useBacktestRuns({
    status: filters.status || undefined,
    strategyCode: filters.strategyCode || undefined,
    symbol: filters.symbol || undefined,
    interval: filters.interval || undefined,
    from: toIsoStart(filters.from),
    to: toIsoEnd(filters.to),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: filters.page,
    size: filters.size,
  });

  const rows = runsQuery.data?.content ?? [];
  const total = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.size));
  const hasActiveFilters =
    Boolean(filters.status) ||
    Boolean(filters.strategyCode) ||
    Boolean(filters.symbol) ||
    Boolean(filters.interval) ||
    Boolean(filters.from) ||
    Boolean(filters.to);

  // TanStack Table's sorting state — we mirror server-side sort into/out of
  // it so clicking a column header updates the URL (and re-fetches) rather
  // than doing a pure client-side reorder.
  const sorting: SortingState = useMemo(
    () => [{ id: filters.sortBy, desc: filters.sortDir === 'DESC' }],
    [filters.sortBy, filters.sortDir],
  );

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (!first) {
        // TanStack cleared the sort — snap back to default createdAt DESC so
        // the list never ends up in an unordered state.
        patchFilters({ sortBy: 'createdAt', sortDir: 'DESC' }, { resetPage: false });
        return;
      }
      const key = (
        SORTABLE_KEYS.includes(first.id as BacktestSortKey) ? first.id : 'createdAt'
      ) as BacktestSortKey;
      patchFilters({ sortBy: key, sortDir: first.desc ? 'DESC' : 'ASC' }, { resetPage: false });
    },
    [sorting, patchFilters],
  );

  const columns = useMemo<ColumnDef<BacktestRun, unknown>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        size: 56,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="num text-[12px] text-text-muted">
            {String(filters.page * filters.size + row.index + 1).padStart(3, '0')}
          </span>
        ),
      },
      {
        id: 'strategyCode',
        accessorKey: 'strategyCode',
        header: 'Strategy',
        cell: ({ row }) => {
          const codes = (row.original.strategyCode ?? '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
          if (codes.length === 0) return <span className="text-text-muted">—</span>;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {codes.map((code) => (
                <StrategyBadge key={code} code={code} size="sm" />
              ))}
            </div>
          );
        },
      },
      {
        id: 'symbol',
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="num text-[13px] text-text-primary">{row.original.symbol}</span>
        ),
      },
      {
        id: 'interval',
        accessorKey: 'interval',
        header: 'Interval',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="num text-[12px] text-text-secondary">{row.original.interval}</span>
        ),
      },
      {
        id: 'range',
        header: 'Date range',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="num whitespace-nowrap text-[11px] text-text-muted">
            {safeDateFmt(row.original.fromDate)}
            <span className="mx-1 text-text-muted">→</span>
            {safeDateFmt(row.original.toDate)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: 'returnPct',
        header: 'Return',
        accessorFn: (r) => r.metrics?.totalReturnPct ?? null,
        cell: ({ row }) => <ReturnCell value={row.original.metrics?.totalReturnPct ?? null} />,
      },
      {
        id: 'sharpe',
        header: 'Sharpe',
        accessorFn: (r) => r.metrics?.sharpe ?? null,
        cell: ({ row }) => {
          const v = row.original.metrics?.sharpe;
          return (
            <span className="num text-[12px] text-text-primary">
              {v != null ? v.toFixed(2) : '—'}
            </span>
          );
        },
      },
      {
        id: 'maxDrawdownPct',
        header: 'Max DD',
        accessorFn: (r) => r.metrics?.maxDrawdownPct ?? null,
        cell: ({ row }) => {
          const v = row.original.metrics?.maxDrawdownPct;
          return (
            <span
              className="num text-[12px]"
              style={{ color: v != null ? 'var(--color-loss)' : 'var(--text-muted)' }}
            >
              {v != null ? `−${v.toFixed(2)}%` : '—'}
            </span>
          );
        },
      },
      {
        id: 'totalTrades',
        header: 'Trades',
        accessorFn: (r) => r.metrics?.totalTrades ?? null,
        cell: ({ row }) => (
          <span className="num text-[12px] text-text-secondary">
            {row.original.metrics?.totalTrades ?? '—'}
          </span>
        ),
      },
      {
        id: 'winRate',
        header: 'Win rate',
        accessorFn: (r) => r.metrics?.winRate ?? null,
        cell: ({ row }) => {
          const v = row.original.metrics?.winRate;
          return (
            <span className="num text-[12px] text-text-primary">
              {v != null ? `${v.toFixed(1)}%` : '—'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        enableSorting: false,
        enableHiding: false,
        cell: () => (
          <div className="flex items-center justify-end gap-0.5 text-[11px] text-text-muted">
            View
            <ChevronRight size={12} strokeWidth={1.75} />
          </div>
        ),
      },
    ],
    [filters.page, filters.size],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Backtests</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Run History
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Simulate strategies against historical data. Filter, sort, and re-run with tweaked
            params any time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted">
            {total} run{total === 1 ? '' : 's'} · page {filters.page + 1} of {totalPages}
          </span>
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
        </div>
      </header>

      {/* Filter bar */}
      <section className="flex flex-wrap items-center gap-3 rounded-md border border-bd-subtle bg-bg-surface p-3">
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => {
            const active = filters.status === s.value;
            return (
              <button
                key={s.value || 'all'}
                type="button"
                onClick={() => patchFilters({ status: s.value })}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  active
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]'
                    : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary',
                )}
                aria-pressed={active}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-bd-subtle" aria-hidden="true" />

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>Strategy</span>
          <input
            aria-label="Filter by strategy code"
            type="text"
            value={filters.strategyCode}
            onChange={(e) => patchFilters({ strategyCode: e.target.value.toUpperCase() })}
            placeholder="LSR_V2"
            className="h-8 w-[140px] rounded-md border border-bd-subtle bg-bg-base px-2 font-mono text-[12px] uppercase text-text-primary placeholder:normal-case placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>Symbol</span>
          <input
            aria-label="Filter by symbol"
            type="text"
            value={filters.symbol}
            onChange={(e) => patchFilters({ symbol: e.target.value.toUpperCase() })}
            placeholder="BTCUSDT"
            className="h-8 w-[120px] rounded-md border border-bd-subtle bg-bg-base px-2 font-mono text-[12px] uppercase text-text-primary placeholder:normal-case placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>Interval</span>
          <select
            aria-label="Filter by interval"
            value={filters.interval}
            onChange={(e) => patchFilters({ interval: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          >
            {INTERVALS.map((iv) => (
              <option key={iv || 'all'} value={iv}>
                {iv || 'All'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>From</span>
          <input
            aria-label="Created from"
            type="date"
            value={filters.from}
            onChange={(e) => patchFilters({ from: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>To</span>
          <input
            aria-label="Created to"
            type="date"
            value={filters.to}
            onChange={(e) => patchFilters({ to: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-text-muted">
          <span>Rows</span>
          <select
            aria-label="Page size"
            value={filters.size}
            onChange={(e) => patchFilters({ size: Number(e.target.value) })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() =>
                patchFilters({
                  status: '',
                  strategyCode: '',
                  symbol: '',
                  interval: '',
                  from: '',
                  to: '',
                })
              }
              className="inline-flex h-8 items-center gap-1 rounded-md border border-bd-subtle bg-bg-base px-2.5 text-[11px] text-text-muted transition-colors hover:border-bd hover:text-text-primary"
            >
              <X size={11} strokeWidth={1.75} />
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Table */}
      {runsQuery.isError ? (
        <EmptyState
          icon={FlaskConical}
          title="Could not load backtests"
          description="The backtest endpoint returned an error."
          action={
            <button
              type="button"
              onClick={() => runsQuery.refetch()}
              className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
            >
              Retry
            </button>
          }
        />
      ) : !runsQuery.isLoading && rows.length === 0 && !hasActiveFilters ? (
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
        <DataTable
          columns={columns}
          data={rows}
          isLoading={runsQuery.isLoading}
          onRowClick={(r) => router.push(`/backtest/${r.id}`)}
          manualSorting
          sorting={sorting}
          onSortingChange={handleSortingChange}
          hideSearch
          emptyIcon={FlaskConical}
          emptyTitle="No runs match"
          emptyDescription="Clear filters or widen the date range."
          hidePagination
        />
      )}

      {/* Server-side pagination controls */}
      {!runsQuery.isLoading && total > filters.size && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="text-[11px] text-text-muted">
            Showing {filters.page * filters.size + 1}–
            {Math.min((filters.page + 1) * filters.size, total)} of {total}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                patchFilters({ page: Math.max(0, filters.page - 1) }, { resetPage: false })
              }
              disabled={filters.page === 0}
              className="rounded-md border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => patchFilters({ page: filters.page + 1 }, { resetPage: false })}
              disabled={filters.page + 1 >= totalPages}
              className="rounded-md border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function safeDateFmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd');
}

interface StatusStyle {
  label: string;
  text: string;
  bg: string;
  dotPulse: boolean;
}

const STATUS_META: Record<BacktestStatus, StatusStyle> = {
  PENDING: {
    label: 'Queued',
    text: 'var(--color-warning)',
    bg: 'var(--tint-warning)',
    dotPulse: true,
  },
  RUNNING: { label: 'Running', text: 'var(--color-info)', bg: 'var(--tint-info)', dotPulse: true },
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

function resolveStatusMeta(status: string): StatusStyle {
  const normalized = status?.toUpperCase?.() as BacktestStatus | undefined;
  if (normalized && normalized in STATUS_META) return STATUS_META[normalized];
  return {
    label: status || 'Unknown',
    text: 'var(--text-muted)',
    bg: 'var(--bg-elevated)',
    dotPulse: false,
  };
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
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
