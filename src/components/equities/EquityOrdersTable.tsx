'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { parseIsoUtc } from '@/lib/formatters';
import type { EquityOrder, EquityOrderSide, EquityOrderStatus } from '@/types/equity';

// Side: BUY=profit color, SELL=loss color
const SIDE_CLASSES: Record<EquityOrderSide, string> = {
  BUY: 'text-[var(--color-profit)]',
  SELL: 'text-[var(--color-loss)]',
};

// Status pill styles — token CSS vars, NO hex
function StatusPill({ status }: { status: EquityOrderStatus }) {
  if (status === 'FILLED') {
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-profit)', color: 'var(--color-profit)' }}
      >
        FILLED
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-loss)', color: 'var(--color-loss)' }}
      >
        REJECTED
      </span>
    );
  }
  if (status === 'SUBMITTED' || status === 'NEW') {
    return (
      <span
        className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-info)', color: 'var(--color-info)' }}
      >
        {status}
      </span>
    );
  }
  // PARTIALLY_FILLED, CANCELED, and any future statuses → neutral
  return (
    <span className="inline-flex items-center rounded-sm bg-[var(--bg-base)] px-1.5 py-0.5 text-[12px] font-semibold tracking-wider text-[var(--text-secondary)]">
      {status}
    </span>
  );
}

const COLUMNS: ColumnDef<EquityOrder, unknown>[] = [
  {
    id: 'asOfDate',
    accessorKey: 'asOfDate',
    header: 'Date',
    cell: ({ row }) => {
      const ms = parseIsoUtc(row.original.asOfDate);
      const label = Number.isFinite(ms) ? new Date(ms).toLocaleDateString() : '—';
      return <span className="font-mono text-[13px] text-[var(--text-muted)]">{label}</span>;
    },
  },
  {
    id: 'symbol',
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-[var(--text-primary)]">
        {row.original.symbol}
      </span>
    ),
  },
  {
    id: 'side',
    accessorKey: 'side',
    header: 'Side',
    cell: ({ row }) => {
      const side = row.original.side;
      return (
        <span className={`font-mono text-[13px] font-semibold ${SIDE_CLASSES[side]}`}>{side}</span>
      );
    },
  },
  {
    id: 'qty',
    accessorKey: 'qty',
    header: 'Qty',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[var(--text-primary)]">{row.original.qty}</span>
    ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: 'brokerOrderId',
    accessorKey: 'brokerOrderId',
    header: 'Broker Order ID',
    cell: ({ row }) => (
      <span className="font-mono text-[13px] text-[var(--text-secondary)]">
        {row.original.brokerOrderId ?? '—'}
      </span>
    ),
  },
];

interface EquityOrdersTableProps {
  orders: EquityOrder[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function EquityOrdersTable({ orders, isLoading, isError, onRetry }: EquityOrdersTableProps) {
  const columns = useMemo(() => COLUMNS, []);

  return (
    <DataTable
      columns={columns}
      data={orders}
      isLoading={isLoading}
      isError={isError}
      errorTitle="Equity service unavailable"
      errorDescription="The blackheart-equity service (:8090) is not reachable. Orders will appear once it is deployed."
      onRetry={onRetry}
      emptyTitle="No equity orders"
      emptyDescription="Orders appear once the blackheart-equity service is live and processing fills."
      hideSearch
      hidePagination={orders.length <= 20}
      getRowId={(row) => `${row.profile}-${row.symbol}-${row.asOfDate}-${row.brokerOrderId ?? ''}`}
    />
  );
}
