'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { PriceCell } from '@/components/shared/PriceCell';
import type { EquityPosition } from '@/types/equity';

const COLUMNS: ColumnDef<EquityPosition, unknown>[] = [
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
    id: 'venue',
    accessorKey: 'venue',
    header: 'Venue',
    cell: ({ row }) => (
      <span className="text-[13px] text-[var(--text-secondary)]">{row.original.venue}</span>
    ),
  },
  {
    id: 'sleeveCode',
    accessorKey: 'sleeveCode',
    header: 'Sleeve',
    cell: ({ row }) => (
      <span className="font-mono text-[13px] text-[var(--text-secondary)]">
        {row.original.sleeveCode ?? '—'}
      </span>
    ),
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
    id: 'avgPrice',
    accessorKey: 'avgPrice',
    header: 'Avg Price',
    cell: ({ row }) => <PriceCell value={row.original.avgPrice} decimals={2} />,
  },
];

interface EquityPositionsTableProps {
  positions: EquityPosition[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function EquityPositionsTable({
  positions,
  isLoading,
  isError,
  onRetry,
}: EquityPositionsTableProps) {
  const columns = useMemo(() => COLUMNS, []);

  return (
    <DataTable
      columns={columns}
      data={positions}
      isLoading={isLoading}
      isError={isError}
      errorTitle="Equity service unavailable"
      errorDescription="The blackheart-equity service (:8090) is not reachable. Positions will appear once it is deployed."
      onRetry={onRetry}
      emptyTitle="No equity positions"
      emptyDescription="Positions appear once the blackheart-equity service is live and has filled orders."
      hideSearch
      hidePagination={positions.length <= 20}
      getRowId={(row) => `${row.profile}-${row.symbol}-${row.venue}`}
    />
  );
}
