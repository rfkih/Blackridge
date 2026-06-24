'use client';

/* eslint-disable react/no-unstable-nested-components -- TanStack column `cell` render props, per the trades page convention */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { PnlCell } from '@/components/shared/PnlCell';
import { PriceCell } from '@/components/shared/PriceCell';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { CarryPair, CarryStatus } from '@/types/trading';
import { DeltaMeter } from './DeltaMeter';

const STATUS_STYLE: Record<CarryStatus, { bg: string; fg: string }> = {
  PENDING: { bg: 'var(--tint-info)', fg: 'var(--color-info)' },
  OPENING: { bg: 'var(--tint-info)', fg: 'var(--color-info)' },
  OPEN: { bg: 'var(--tint-info)', fg: 'var(--color-info)' },
  REBALANCING: { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' },
  CLOSING: { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' },
  CLOSED: { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' },
  FAILED: { bg: 'var(--tint-loss)', fg: 'var(--color-loss)' },
  UNKNOWN: { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' },
};

function StatusPill({ status }: { status: CarryStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  );
}

function ModeBadge({ simulated }: { simulated: boolean }) {
  if (simulated) {
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider"
        style={{ background: 'var(--tint-warning)', color: 'var(--color-warning)' }}
      >
        Paper
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider"
      style={{ background: 'var(--tint-profit)', color: 'var(--color-profit)' }}
    >
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full"
        style={{ background: 'var(--color-profit)' }}
      />
      Live
    </span>
  );
}

interface CarryBookTableProps {
  rows: CarryPair[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRowClick?: (row: CarryPair) => void;
}

export function CarryBookTable({
  rows,
  isLoading,
  isError,
  onRetry,
  onRowClick,
}: CarryBookTableProps) {
  const columns = useMemo<ColumnDef<CarryPair, unknown>[]>(
    () => [
      {
        id: 'pair',
        header: 'Pair',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[14px] font-medium tabular-nums text-text-primary">
              {row.original.symbol}
            </span>
            <ModeBadge simulated={row.original.simulated} />
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: 'hedge',
        header: 'Hedge (Δ)',
        cell: ({ row }) => (
          <DeltaMeter
            spotQty={row.original.spotQty}
            perpQty={row.original.perpQty}
            bandPct={row.original.rebalanceBandPct ?? undefined}
          />
        ),
      },
      {
        id: 'legs',
        header: 'Legs (base)',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 font-mono text-[12px] tabular-nums">
            <span style={{ color: 'var(--color-profit)' }}>L {fmtQty(row.original.spotQty)}</span>
            <span style={{ color: 'var(--color-loss)' }}>S {fmtQty(row.original.perpQty)}</span>
          </div>
        ),
      },
      {
        id: 'lev',
        header: 'Lev',
        cell: ({ row }) => (
          <span className="font-mono text-[13px] tabular-nums text-text-secondary">
            {row.original.perpLeverage != null ? `${trimNum(row.original.perpLeverage)}×` : '—'}
          </span>
        ),
      },
      {
        id: 'mark',
        header: 'Mark',
        cell: ({ row }) => <PriceCell value={row.original.markPrice} decimals={2} />,
      },
      {
        id: 'funding',
        header: 'Funding',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <PnlCell value={row.original.fundingPnl} noFlash />
            <span className="text-[10px] uppercase tracking-wide text-text-muted">the edge</span>
          </div>
        ),
      },
      {
        id: 'basis',
        header: 'Basis',
        cell: ({ row }) => <BasisCell value={row.original.unrealizedPnl} />,
      },
      {
        id: 'total',
        header: 'Total P&L',
        cell: ({ row }) => <PnlCell value={row.original.totalPnl} noFlash />,
      },
      {
        id: 'opened',
        header: 'Opened',
        cell: ({ row }) => (
          <span className="text-[12px] text-text-secondary">
            {row.original.createdAt ? formatDate(parseIsoUtc(row.original.createdAt)) : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      isError={isError}
      errorTitle="Couldn't load the carry book"
      errorDescription="The carry pairs endpoint didn't respond. Retry, or check the trading engine."
      onRetry={onRetry}
      onRowClick={onRowClick}
      getRowId={(r) => r.id}
      manualSorting
      hideSearch
      hidePagination
      emptyTitle="No carry pairs"
      emptyDescription="No delta-neutral carry pairs yet. Open one from the carry admin flow to start earning funding."
    />
  );
}

function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

function trimNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

/** Basis (unrealized) drift — "the noise". Muted + signed, in the user's display currency. */
function BasisCell({ value }: { value: number | null }) {
  const formatCurrency = useCurrencyFormatter();
  return (
    <span className="font-mono text-[13px] tabular-nums text-text-muted">
      {value == null || !Number.isFinite(value) ? '—' : formatCurrency(value, { withSign: true })}
    </span>
  );
}
