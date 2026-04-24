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
import { useTradesList } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { usePositionStore } from '@/store/positionStore';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
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
      {/* ── Header — TRADE LEDGER kicker + Journal serif + action buttons ── */}
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
            style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}
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
          <button type="button" className="mm-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={12} strokeWidth={1.75} /> CSV
          </button>
          <button type="button" className="mm-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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

      {/* ── Stats strip (design pack). Computed from the currently-visible
           server page — server-side aggregates would be more accurate but
           require a new endpoint. This is honest to what's on screen. ── */}
      <JournalStatsStrip trades={tradesQuery.data?.content ?? []} />

      {/* ── Filter bar — design pack's pill treatment ── */}
      <section
        className="mm-card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        {/* Search field — pill shaped, icon-led. Decorative for now — real
            server-side search on symbol/strategy/notes is an open TODO. */}
        <div
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
          <span>Search symbol, strategy, note…</span>
        </div>

        {/* Status pills (All / Open / Partial / Closed) matching the pack */}
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

        {/* Strategy */}
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

        {/* Symbol */}
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

        {/* Dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>From</span>
          <input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={(e) => patchFilters({ from: e.target.value })}
            className="mm-btn"
            style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>To</span>
          <input
            aria-label="To date"
            type="date"
            value={filters.to}
            onChange={(e) => patchFilters({ to: e.target.value })}
            className="mm-btn"
            style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => patchFilters({ status: 'ALL', strategyCode: '', symbol: '' })}
            className="mm-btn mm-btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px' }}
          >
            <X size={11} strokeWidth={1.75} />
            Clear
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

// ─── Journal stats strip ─────────────────────────────────────────────────────
//
// Five-card grid matching the design pack: big cumulative P&L card with a
// cumulative-equity sparkline, followed by win rate, profit factor, avg
// winner, avg loser. Computed from whatever trades are on the current page
// — a real-deal aggregate across all filtered history is a server-side job
// and would need a new endpoint. This trades server accuracy for "numbers
// react live to filters you can see," which is the right trade for a page
// that's primarily a ledger browser.

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
  // Chronological order for a cumulative series that reads left→right as
  // "how did this book evolve over the filtered window."
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

function JournalStatsStrip({ trades }: { trades: Trades[] }) {
  const stats = useMemo(() => computeJournalStats(trades), [trades]);
  const formatCurrency = useCurrencyFormatter();
  const cumFmt = formatCurrency(stats.cumulativePnl, { withSign: true });
  const cumUp = stats.cumulativePnl >= 0;

  return (
    <section
      className="grid gap-3.5"
      style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr' }}
    >
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
          <StatsSparkline values={stats.cumSeries} color={cumUp ? 'var(--mm-up)' : 'var(--mm-dn)'} />
        </div>
      </div>

      <StatCard label="WIN RATE" value={stats.winRate != null ? `${(stats.winRate * 100).toFixed(1)}%` : '—'} />
      <StatCard
        label="PROFIT FACTOR"
        value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'}
        color="var(--mm-mint)"
      />
      <StatCard
        label="AVG WINNER"
        value={stats.avgWin != null ? formatCurrency(stats.avgWin, { withSign: true }) : '—'}
        color="var(--mm-up)"
      />
      <StatCard
        label="AVG LOSER"
        value={stats.avgLoss != null ? formatCurrency(stats.avgLoss, { withSign: true }) : '—'}
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
