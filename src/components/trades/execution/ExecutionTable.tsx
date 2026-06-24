'use client';

/* eslint-disable react/no-unstable-nested-components -- TanStack column `cell` render props, per the trades page convention */
import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { DataTable } from '@/components/shared/DataTable';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';
import { CATEGORY_LABEL } from './FailureBreakdownPanel';

function CauseBadge({ event }: { event: ExecutionEvent }) {
  if (event.status === 'DIVERTED') {
    return (
      <span
        style={{ color: 'var(--mm-ink-3)', fontSize: 13 }}
        title="Paper trade — simulated strategy, no real order placed"
      >
        ◌ Paper
      </span>
    );
  }
  if (event.status !== 'FAILED' || !event.failureCategory) {
    return <span style={{ color: 'var(--mm-up)', fontSize: 13 }}>● OK</span>;
  }
  return (
    <span style={{ color: 'var(--mm-dn)', fontSize: 13, fontWeight: 500 }}>
      {'● '}
      <span>{CATEGORY_LABEL[event.failureCategory]}</span>
    </span>
  );
}

export function ExecutionTable({
  rows,
  isLoading,
  onRowClick,
}: {
  rows: ExecutionEvent[];
  isLoading: boolean;
  onRowClick: (e: ExecutionEvent) => void;
}) {
  const columns = useMemo<ColumnDef<ExecutionEvent, unknown>[]>(
    () => [
      {
        accessorKey: 'executedAt',
        header: 'Time',
        cell: ({ row }) => {
          const d = new Date(row.original.executedAt);
          return (
            <span className="font-mono text-[13px] text-text-muted">
              {Number.isNaN(d.getTime()) ? row.original.executedAt : format(d, 'MM-dd HH:mm')}
            </span>
          );
        },
      },
      {
        accessorKey: 'executionType',
        header: 'Type',
        cell: ({ row }) => (
          <span className="font-mono text-[13px] text-text-secondary">
            {row.original.executionType}
          </span>
        ),
      },
      {
        accessorKey: 'asset',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono text-[14px] font-medium text-text-primary">
            {row.original.asset}
          </span>
        ),
      },
      {
        accessorKey: 'strategyName',
        header: 'Strategy',
        cell: ({ row }) =>
          row.original.strategyName ? (
            <StrategyBadge code={row.original.strategyName} size="sm" />
          ) : (
            <span>—</span>
          ),
      },
      {
        accessorKey: 'side',
        header: 'Side',
        cell: ({ row }) => (
          <span
            style={{
              color: row.original.side === 'SHORT' ? 'var(--mm-dn)' : 'var(--mm-up)',
              fontSize: 13,
            }}
          >
            {row.original.side ?? '—'}
          </span>
        ),
      },
      {
        id: 'cause',
        header: 'Cause',
        cell: ({ row }) => <CauseBadge event={row.original} />,
      },
      {
        id: 'detail',
        header: 'Detail',
        cell: ({ row }) => (
          <span
            className="text-[13px] text-text-secondary"
            style={{
              display: 'block',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.original.errorMessage ?? row.original.executionReason ?? '—'}
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
      onRowClick={onRowClick}
      getRowId={(r) => r.id}
      manualSorting
      hideSearch
      emptyTitle="No executions"
      emptyDescription="No executions match these filters in this range."
      hidePagination
    />
  );
}
