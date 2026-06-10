'use client';

/* eslint-disable react/no-unstable-nested-components */
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Download,
  ListFilter,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { PriceCell } from '@/components/shared/PriceCell';
import { PnlCell } from '@/components/shared/PnlCell';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { useTradesList, useTradeStats } from '@/hooks/useTrades';
import type { TradesPageFilters } from '@/lib/api/trades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useAccountView } from '@/lib/accountType/registry';
import { RebalanceHistory } from '@/components/hedging/RebalanceHistory';
import { usePositionStore } from '@/store/positionStore';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { formatDate, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { TradeStatus, Trades } from '@/types/trading';

type StatusFilter = TradeStatus | 'ALL';
const STATUSES: StatusFilter[] = ['ALL', 'OPEN', 'PARTIALLY_CLOSED', 'CLOSED'];

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTradesCsv(trades: Trades[]) {
  const headers = ['id', 'symbol', 'strategy', 'direction', 'status', 'entry_time', 'entry_price', 'exit_time', 'exit_price', 'quantity', 'realized_pnl', 'fee_usdt'];
  const rows = trades.map((t) => [
    t.id,
    t.symbol,
    t.strategyCode,
    t.direction,
    t.status,
    t.entryTime ? new Date(t.entryTime).toISOString() : '',
    t.entryPrice,
    t.exitTime ? new Date(t.exitTime).toISOString() : '',
    t.exitAvgPrice ?? '',
    t.quantity,
    t.realizedPnl,
    t.feeUsdt,
  ].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const { activeAccount, isAll, scopedAccountId } = useActiveAccount();

  // Account-type branch: a single active HEDGING account sees the monitor as a
  // "Rebalances" view. TRADING and the "All" aggregate keep the existing trades
  // ledger byte-for-byte (this branch is additive — it never restructures the
  // trading table below).
  if (!isAll && activeAccount?.accountType === 'HEDGING') {
    return <RebalancesMonitor accountId={scopedAccountId} />;
  }

  return (
    <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
      <TradesPageContent />
    </Suspense>
  );
}

/**
 * The monitor surface for a HEDGING account — the same page slot the trades
 * ledger occupies, retitled via the account view's `monitorLabel` and backed
 * by the account-scoped rebalance log instead of the trades table.
 */
function RebalancesMonitor({ accountId }: { accountId: string | undefined }) {
  const { monitorLabel } = useAccountView();

  return (
    <div className="flex flex-col gap-5">
      <section
        className="mm-card"
        style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}
      >
        <div className="mm-kicker">REBALANCE LOG</div>
        <h1
          className="font-display"
          style={{ fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}
        >
          {monitorLabel}
        </h1>
      </section>

      <RebalanceHistory accountId={accountId} />
    </div>
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

  // Hero-strip stats are scoped to the same filters as the list (minus
  // pagination) and aggregated server-side over every matching trade.
  const statsFilters = useMemo<Omit<TradesPageFilters, 'page' | 'size'>>(
    () => ({
      status: filters.status,
      strategyCode: filters.strategyCode || undefined,
      symbol: filters.symbol || undefined,
      from: filters.from,
      to: filters.to,
      accountId: scopedAccountId,
    }),
    [filters.status, filters.strategyCode, filters.symbol, filters.from, filters.to, scopedAccountId],
  );

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

  const [filtersOpen, setFiltersOpen] = useState(false);

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
      {}
      <section
        className="mm-card"
        style={{
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="mm-kicker">TRADE LEDGER</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            <h1
              className="font-display"
              style={{ fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1 }}
            >
              Journal
            </h1>
            <span style={{ color: 'var(--mm-ink-2)', fontSize: 13 }}>
              {tradesQuery.data?.total ?? 0} total · page {filters.page + 1} of {totalPages}
              {filters.from && filters.to ? ` · ${filters.from} → ${filters.to}` : ''}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="mm-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => downloadTradesCsv(rows)}
            disabled={rows.length === 0}
            title="Download current page as CSV"
          >
            <Download size={12} strokeWidth={1.75} /> CSV
          </button>
          <button
            type="button"
            className="mm-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.5, cursor: 'not-allowed' }}
            title="FIFO tax report — coming soon"
            disabled
          >
            <Receipt size={12} strokeWidth={1.75} /> FIFO · tax
          </button>
          <button
            type="button"
            className="mm-btn mm-btn-mint"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={12} strokeWidth={2} /> Log manual
          </button>
        </div>
      </section>

      {}
      <JournalStatsStrip statsFilters={statsFilters} pageTrades={tradesQuery.data?.content ?? []} />

      {}
      <section className="mm-card" style={{ padding: '12px 16px' }}>
        {}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label
            style={{
              flex: '0 1 280px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              borderRadius: 999,
              background: 'var(--mm-surface-2)',
              fontSize: 12,
              color: 'var(--mm-ink-3)',
              minWidth: 0,
            }}
          >
            <Search size={12} strokeWidth={1.75} aria-hidden="true" />
            <input
              type="text"
              value={filters.symbol}
              onChange={(e) => patchFilters({ symbol: e.target.value })}
              placeholder="Search symbol…"
              aria-label="Filter by symbol"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--mm-ink-1)',
                width: '100%',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 6 }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => patchFilters({ status: s })}
                className={cn('mm-pill', filters.status === s && 'mm-pill-active')}
                style={{ padding: '5px 12px', fontSize: 11 }}
                aria-pressed={filters.status === s}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} aria-hidden="true" />

          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn('mm-btn', (filtersOpen || hasActiveFilters) && 'mm-btn-mint')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              fontSize: 11,
            }}
            aria-expanded={filtersOpen}
          >
            <ListFilter size={12} strokeWidth={1.75} />
            Filters
            {hasActiveFilters && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.25)',
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {[filters.strategyCode, filters.symbol].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {}
        {filtersOpen && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--mm-hair)',
            }}
          >
            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>Strategy</span>
              <select
                aria-label="Filter by strategy"
                value={filters.strategyCode}
                onChange={(e) => patchFilters({ strategyCode: e.target.value })}
                className="mm-btn"
                style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                <option value="">any</option>
                {uniqueStrategyCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>Symbol</span>
              <input
                aria-label="Filter by symbol"
                type="text"
                value={filters.symbol}
                onChange={(e) => patchFilters({ symbol: e.target.value.toUpperCase() })}
                placeholder="any"
                className="mm-btn"
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  width: 110,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  cursor: 'text',
                }}
              />
            </div>

            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>From</span>
              <DatePicker
                id="trades-from"
                value={filters.from}
                onChange={(v) => patchFilters({ from: v })}
                placeholder="From"
                clearable
                className="h-7 px-2 py-0 text-[12px]"
              />
              <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>To</span>
              <DatePicker
                id="trades-to"
                value={filters.to}
                onChange={(v) => patchFilters({ to: v })}
                placeholder="To"
                clearable
                className="h-7 px-2 py-0 text-[12px]"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => patchFilters({ status: 'ALL', strategyCode: '', symbol: '' })}
                className="mm-btn mm-btn-ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  padding: '5px 10px',
                }}
              >
                <X size={11} strokeWidth={1.75} />
                Clear
              </button>
            )}
          </div>
        )}
      </section>

      {}
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

      {}
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
              className="rounded-xl border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => patchFilters({ page: filters.page + 1 })}
              disabled={filters.page + 1 >= totalPages}
              className="rounded-xl border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-40"
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
    <span className="inline-flex items-center rounded-sm bg-bg-base px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-text-secondary">
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

interface JournalStats {
  cumulativePnl: number;
  winRate: number | null;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  cumSeries: number[];
}

function computeJournalStats(trades: Trades[]): JournalStats {
  const closed = trades.filter((t) => t.status !== 'OPEN' && Number.isFinite(t.realizedPnl));

  const byEntry = [...closed].sort((a, b) => a.entryTime - b.entryTime);
  const cumSeries: number[] = [];
  let running = 0;
  for (const t of byEntry) {
    running += t.realizedPnl;
    cumSeries.push(running);
  }
  const wins = closed.filter((t) => t.realizedPnl > 0);
  const losses = closed.filter((t) => t.realizedPnl < 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const grossProfit = wins.reduce((acc, t) => acc + t.realizedPnl, 0);
  const grossLoss = losses.reduce((acc, t) => acc + Math.abs(t.realizedPnl), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : null;
  const avgLoss = losses.length > 0 ? -(grossLoss / losses.length) : null;
  return {
    cumulativePnl: running,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    cumSeries,
  };
}

function JournalStatsStrip({
  statsFilters,
  pageTrades,
}: {
  statsFilters: Omit<TradesPageFilters, 'page' | 'size'>;
  pageTrades: Trades[];
}) {
  const statsQuery = useTradeStats(statsFilters);
  const formatCurrency = useCurrencyFormatter();

  // Headline figures are authoritative server-side totals over the FULL
  // filtered set (all pages). The sparkline is a lightweight visual sketch of
  // the currently-loaded page only — it needs per-trade ordering we don't
  // round-trip, and it is decorative, not an authoritative number.
  const data = statsQuery.data;
  const cumulativePnl = data?.cumulativePnl ?? 0;
  const winRate = data?.winRate ?? null;
  const profitFactor = data?.profitFactor ?? null;
  const avgWin = data?.avgWin ?? null;
  const avgLoss = data?.avgLoss ?? null;
  const cumSeries = useMemo(() => computeJournalStats(pageTrades).cumSeries, [pageTrades]);

  const cumFmt = formatCurrency(cumulativePnl, { withSign: true });
  const cumUp = cumulativePnl >= 0;

  return (
    <section className="grid gap-3.5" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}>
      <div className="mm-card" style={{ padding: '18px 22px' }}>
        <div className="mm-kicker">CUMULATIVE P&amp;L</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <span
            style={{
              fontSize: 26,
              fontFamily: 'var(--font-num)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: cumUp ? 'var(--mm-up)' : 'var(--mm-dn)',
            }}
          >
            {cumFmt}
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <StatsSparkline
            values={cumSeries}
            color={cumUp ? 'var(--mm-up)' : 'var(--mm-dn)'}
          />
        </div>
      </div>

      <StatCard
        label="WIN RATE"
        value={winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
      />
      <StatCard
        label="PROFIT FACTOR"
        value={profitFactor != null ? profitFactor.toFixed(2) : '—'}
        color="var(--brand-500)"
      />
      <StatCard
        label="AVG WINNER"
        value={avgWin != null ? formatCurrency(avgWin, { withSign: true }) : '—'}
        color="var(--mm-up)"
      />
      <StatCard
        label="AVG LOSER"
        value={avgLoss != null ? formatCurrency(avgLoss, { withSign: true }) : '—'}
        color="var(--mm-dn)"
      />
    </section>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="mm-card" style={{ padding: '18px 22px' }}>
      <div className="mm-kicker">{label}</div>
      <div
        style={{
          fontSize: 22,
          marginTop: 8,
          fontFamily: 'var(--font-num)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color: color ?? 'var(--mm-ink-0)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Compact SVG polyline for the stats-strip hero card. Kept inline — we only
 *  need it here, and the existing chart libraries are overkill for a 320×48
 *  sparkline with no axes, tooltips, or interaction. */
function StatsSparkline({
  values,
  color,
  width = 320,
  height = 48,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          borderRadius: 4,
          background:
            'linear-gradient(90deg, var(--mm-hair) 0%, var(--mm-hair-2) 50%, var(--mm-hair) 100%)',
          opacity: 0.5,
        }}
        aria-hidden="true"
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
