'use client';

// TanStack Table's idiomatic column defs pass inline `cell: ({ row }) => …`
// renderers. They're memoised as part of `columns` via useMemo, so the usual
// stability concern the no-unstable-nested-components rule warns about
// doesn't apply. Disable it for this file only.
/* eslint-disable react/no-unstable-nested-components */
import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Layers,
  ListFilter,
  TrendingUp,
  X,
} from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { PriceCell } from '@/components/shared/PriceCell';
import { PnlCell } from '@/components/shared/PnlCell';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTradesList } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { usePositionStore } from '@/store/positionStore';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { formatDate, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { TradeStatus, Trades } from '@/types/trading';

type StatusFilter = TradeStatus | 'ALL';
const STATUSES: StatusFilter[] = ['ALL', 'OPEN', 'PARTIALLY_CLOSED', 'CLOSED'];

interface Filters {
  status: StatusFilter;
  strategyCode: string;
  symbol: string;
  from: string;
  to: string;
  page: number;
  size: number;
}

function readFilters(params: URLSearchParams): Filters {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fallbackFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const rawStatus = params.get('status')?.toUpperCase() ?? 'ALL';
  const status: StatusFilter = (STATUSES as string[]).includes(rawStatus)
    ? (rawStatus as StatusFilter)
    : 'ALL';
  const pageRaw = Number(params.get('page'));
  const sizeRaw = Number(params.get('size'));
  return {
    status,
    strategyCode: params.get('strategyCode') ?? '',
    symbol: params.get('symbol') ?? '',
    from: params.get('from') || fallbackFrom,
    to: params.get('to') || today,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 0,
    size: [20, 50, 100].includes(sizeRaw) ? sizeRaw : 20,
  };
}

const STATUS_META: Record<StatusFilter, { label: string }> = {
  ALL: { label: 'All' },
  OPEN: { label: 'Open' },
  PARTIALLY_CLOSED: { label: 'Partial' },
  CLOSED: { label: 'Closed' },
};

export default function TradesPage() {
  // useSearchParams forces a client render boundary — Suspense satisfies
  // Next 14's prerender pass.
  return (
    <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
      <TradesPageContent />
    </Suspense>
  );
}

function TradesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const patchFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = new URLSearchParams(searchParams.toString());
      const apply = (key: keyof Filters, value: string | number | undefined | null) => {
        if (value == null || value === '') next.delete(key);
        else next.set(key, String(value));
      };
      // Any filter change resets pagination — showing page 5 of a freshly
      // filtered result set is almost always wrong.
      const mutated: Filters = { ...filters, ...patch };
      if ('page' in patch) {
        apply('page', mutated.page || null);
      } else if (Object.keys(patch).some((k) => k !== 'page' && k !== 'size')) {
        apply('page', null);
      }
      for (const key of Object.keys(mutated) as (keyof Filters)[]) {
        if (key === 'page' && !('page' in patch)) continue;
        if (key === 'from' || key === 'to') {
          apply(key, mutated[key]);
        } else if (key !== 'page') {
          apply(key, mutated[key]);
        }
      }
      router.replace(`/trades${next.toString() ? `?${next.toString()}` : ''}`);
    },
    [filters, router, searchParams],
  );

  // Live-P&L wiring for OPEN rows. The list shows both open and closed trades
  // depending on the filter; even when filtering to CLOSED, wiring these hooks
  // is cheap (the store is idle when there are no open trades from REST).
  const { scopedAccountId } = useActiveAccount();
  useLivePnl(scopedAccountId);

  const tradesQuery = useTradesList({
    status: filters.status,
    strategyCode: filters.strategyCode || undefined,
    symbol: filters.symbol || undefined,
    from: filters.from,
    to: filters.to,
    accountId: scopedAccountId,
    page: filters.page,
    size: filters.size,
  });

  // Sync just the open rows into positionStore so PnlCell gets live updates.
  // Derive from the current page — the server is the source of truth; this
  // only needs to be accurate for what's on-screen.
  const openSlice = useMemo(
    () => (tradesQuery.data?.content ?? []).filter((t) => t.status === 'OPEN'),
    [tradesQuery.data?.content],
  );
  useSyncOpenPositions(
    useMemo(
      () =>
        openSlice.map((t) => ({
          tradeId: t.id,
          accountId: t.accountId,
          accountStrategyId: t.accountStrategyId,
          symbol: t.symbol,
          direction: t.direction,
          quantity: t.quantity,
          entryPrice: t.entryPrice,
          markPrice: t.markPrice ?? null,
          unrealizedPnl: t.unrealizedPnl,
          unrealizedPnlPct: t.unrealizedPnlPct ?? 0,
          openedAt: t.entryTime,
        })),
      [openSlice],
    ),
  );

  const { data: strategies = [] } = useStrategies();
  const uniqueStrategyCodes = useMemo(() => {
    const set = new Set<string>();
    for (const s of strategies) set.add(s.strategyCode);
    return Array.from(set).sort();
  }, [strategies]);

  const columns = useMemo<ColumnDef<Trades, unknown>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        size: 48,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-text-muted">
            {filters.page * filters.size + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono text-[13px] font-medium text-text-primary">
            {row.original.symbol.replace(/USDT$/, '')}
            <span className="ml-1 text-[10px] text-text-muted">
              {row.original.symbol.endsWith('USDT') ? 'USDT' : ''}
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'strategyCode',
        header: 'Strategy',
        cell: ({ row }) => <StrategyBadge code={row.original.strategyCode} size="sm" />,
      },
      {
        accessorKey: 'direction',
        header: 'Dir',
        cell: ({ row }) => <DirectionPill direction={row.original.direction} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        accessorKey: 'entryPrice',
        header: 'Entry',
        cell: ({ row }) => <PriceCell value={row.original.entryPrice} decimals={4} />,
      },
      {
        id: 'exit',
        header: 'Exit',
        accessorFn: (t) => t.exitAvgPrice ?? t.markPrice ?? null,
        cell: ({ row }) => (
          <PriceCell
            value={row.original.exitAvgPrice ?? row.original.markPrice ?? null}
            decimals={4}
          />
        ),
      },
      {
        id: 'pnl',
        header: 'P&L',
        accessorFn: (t) => (t.status === 'OPEN' ? t.unrealizedPnl : t.realizedPnl),
        cell: ({ row }) => <LivePnlOrRealizedCell trade={row.original} />,
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorFn: (t) => (t.exitTime ?? Date.now()) - t.entryTime,
        cell: ({ row }) => {
          const end = row.original.exitTime ?? Date.now();
          return (
            <span className="font-mono text-[11px] text-text-secondary">
              {formatDuration(end - row.original.entryTime)}
            </span>
          );
        },
      },
      {
        accessorKey: 'entryTime',
        header: 'Opened',
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-text-muted">
            {formatDate(row.original.entryTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 text-[11px] text-text-muted group-hover:text-text-primary">
            <span className="sr-only">View {row.original.symbol} trade</span>
            View
            <ChevronRight size={12} strokeWidth={1.75} />
          </div>
        ),
      },
    ],
    [filters.page, filters.size],
  );

  const rows = tradesQuery.data?.content ?? [];

  const totalPages = tradesQuery.data
    ? Math.max(1, Math.ceil(tradesQuery.data.total / filters.size))
    : 1;
  const hasActiveFilters =
    filters.status !== 'ALL' || Boolean(filters.strategyCode) || Boolean(filters.symbol);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Trades</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Ledger
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Every execution — open, partial, closed. Filter by status, strategy, symbol, or date.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <Layers size={12} strokeWidth={1.75} />
          {tradesQuery.data?.total ?? 0} total · page {filters.page + 1} of {totalPages}
        </div>
      </header>

      {/* Filter bar */}
      <section className="flex flex-wrap items-center gap-3 rounded-md border border-bd-subtle bg-bg-surface p-3">
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchFilters({ status: s })}
              className={cn(
                'rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                filters.status === s
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary',
              )}
              aria-pressed={filters.status === s}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-bd-subtle" aria-hidden="true" />

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>Strategy</span>
          <select
            aria-label="Filter by strategy"
            value={filters.strategyCode}
            onChange={(e) => patchFilters({ strategyCode: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          >
            <option value="">All</option>
            {uniqueStrategyCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
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
          <span>From</span>
          <input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={(e) => patchFilters({ from: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>To</span>
          <input
            aria-label="To date"
            type="date"
            value={filters.to}
            onChange={(e) => patchFilters({ to: e.target.value })}
            className="h-8 rounded-md border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary focus:outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => patchFilters({ status: 'ALL', strategyCode: '', symbol: '' })}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-bd-subtle bg-bg-base px-2.5 text-[11px] text-text-muted transition-colors hover:border-bd hover:text-text-primary"
          >
            <X size={11} strokeWidth={1.75} />
            Clear filters
          </button>
        )}
      </section>

      {/* Table — uses client-side sort/pagination on top of the server page.
         A server page of ≤100 rows is fine to sort locally; the header size
         selector patches URL `size` so the caller re-fetches a bigger page. */}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={tradesQuery.isLoading}
        onRowClick={(t) => router.push(`/trades/${t.id}`)}
        initialSort={[{ id: 'entryTime', desc: true }]}
        hideSearch
        emptyIcon={ListFilter}
        emptyTitle="No trades match"
        emptyDescription="Try clearing filters or widening the date range."
        pageSize={filters.size}
        hidePagination
      />

      {/* Server-side pagination controls — sit under the table because the
         DataTable's built-in pagination only knows about the current page. */}
      {tradesQuery.data && tradesQuery.data.total > filters.size && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="text-[11px] text-text-muted">
            Showing {filters.page * filters.size + 1}–
            {Math.min((filters.page + 1) * filters.size, tradesQuery.data.total)} of{' '}
            {tradesQuery.data.total}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => patchFilters({ page: Math.max(0, filters.page - 1) })}
              disabled={filters.page === 0}
              className="rounded-md border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-elevated disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => patchFilters({ page: filters.page + 1 })}
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

function DirectionPill({ direction }: { direction: 'LONG' | 'SHORT' }) {
  const isLong = direction === 'LONG';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
      style={{
        backgroundColor: isLong ? 'var(--tint-profit)' : 'var(--tint-loss)',
        color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
      }}
    >
      {isLong ? (
        <ArrowUpRight size={10} strokeWidth={2} />
      ) : (
        <ArrowDownRight size={10} strokeWidth={2} />
      )}
      {direction}
    </span>
  );
}

function StatusPill({ status }: { status: TradeStatus }) {
  if (status === 'OPEN') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-info)', color: 'var(--color-info)' }}
      >
        <TrendingUp size={10} strokeWidth={2} />
        OPEN
      </span>
    );
  }
  if (status === 'PARTIALLY_CLOSED') {
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-warning)', color: 'var(--color-warning)' }}
      >
        PARTIAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sm bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-text-secondary">
      CLOSED
    </span>
  );
}

/** For OPEN trades, subscribe to the positionStore's live P&L map; for CLOSED
 * trades render the realized P&L. Closing over the tradeId keeps the selector
 * scoped and avoids re-subscribing the whole table on unrelated updates. */
function LivePnlOrRealizedCell({ trade }: { trade: Trades }) {
  const livePnl = usePositionStore((s) => s.pnlMap[trade.id]);
  if (trade.status === 'OPEN') {
    const value = livePnl ?? trade.unrealizedPnl;
    return <PnlCell value={value} />;
  }
  return <PnlCell value={trade.realizedPnl} noFlash />;
}
