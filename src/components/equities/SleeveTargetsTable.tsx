'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { PriceCell } from '@/components/shared/PriceCell';
import type { SleeveTarget, TargetSide } from '@/types/equity';

const SIDE_CLASSES: Record<TargetSide, string> = {
  LONG: 'text-[var(--color-profit)]',
  SHORT: 'text-[var(--color-loss)]',
  FLAT: 'text-[var(--text-muted)]',
};

const COLUMNS: ColumnDef<SleeveTarget, unknown>[] = [
  {
    id: 'sleeveCode',
    accessorKey: 'sleeveCode',
    header: 'Sleeve',
    cell: ({ row }) => (
      <span className="font-mono text-[13px] text-[var(--text-secondary)]">
        {row.original.sleeveCode}
      </span>
    ),
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
    id: 'exchange',
    accessorKey: 'exchange',
    header: 'Exchange',
    cell: ({ row }) => (
      <span className="text-[13px] text-[var(--text-secondary)]">{row.original.exchange}</span>
    ),
  },
  {
    id: 'side',
    accessorKey: 'side',
    header: 'Side',
    cell: ({ row }) => {
      const side = row.original.side;
      return (
        <span className={`font-mono text-[13px] font-semibold ${SIDE_CLASSES[side] ?? ''}`}>
          {side}
        </span>
      );
    },
  },
  {
    id: 'targetWeight',
    accessorKey: 'targetWeight',
    header: 'Weight',
    cell: ({ row }) => (
      <span className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">
        {(row.original.targetWeight * 100).toFixed(2)}%
      </span>
    ),
  },
  {
    id: 'targetNotional',
    accessorKey: 'targetNotional',
    header: 'Notional',
    cell: ({ row }) => <PriceCell value={row.original.targetNotional} decimals={2} />,
  },
];

interface SleeveTargetsTableProps {
  targets: SleeveTarget[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function SleeveTargetsTable({
  targets,
  isLoading,
  isError,
  onRetry,
}: SleeveTargetsTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={targets}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      emptyTitle="No targets"
      emptyDescription="Run the Book Authority compute for this book/date."
      hideSearch
      hidePagination={targets.length <= 20}
      getRowId={(row) => row.targetId}
    />
  );
}
