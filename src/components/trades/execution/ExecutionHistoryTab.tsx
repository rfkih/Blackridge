'use client';

import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useExecutionSummary, useExecutionsList } from '@/hooks/useTradeExecutions';
import { useStrategies } from '@/hooks/useStrategies';
import type { ExecutionEvent, FailureCategory } from '@/lib/api/tradeExecutions';
import { FailureBreakdownPanel } from './FailureBreakdownPanel';
import { ExecutionFilterBar, type ExecutionFilterState } from './ExecutionFilterBar';
import { ExecutionTable } from './ExecutionTable';
import { ExecutionDetailDrawer } from './ExecutionDetailDrawer';

const PAGE_SIZE = 50;

export function ExecutionHistoryTab({ accountId }: { accountId: string | undefined }) {
  const [filters, setFilters] = useState<ExecutionFilterState>(() => ({
    status: 'REAL',
    symbol: '',
    strategyName: '',
    executionType: 'ALL',
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  }));
  const [activeCategory, setActiveCategory] = useState<FailureCategory | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ExecutionEvent | null>(null);

  const patch = (p: Partial<ExecutionFilterState>) => {
    setPage(0);
    setActiveCategory(null);
    setFilters((f) => ({ ...f, ...p }));
  };

  const strategiesQuery = useStrategies();
  const strategyCodes = useMemo<string[]>(
    () =>
      Array.from(
        new Set((strategiesQuery.data ?? []).map((s: { strategyCode: string }) => s.strategyCode)),
      ).sort(),
    [strategiesQuery.data],
  );

  const common = {
    symbol: filters.symbol || undefined,
    strategyName: filters.strategyName || undefined,
    executionType: filters.executionType,
    from: filters.from,
    to: filters.to,
    accountId,
  };

  const summaryQuery = useExecutionSummary(common);
  const listQuery = useExecutionsList({
    ...common,
    status: filters.status,
    failureCategory: filters.status === 'FAILED' ? activeCategory : null,
    page,
    size: PAGE_SIZE,
  });

  const rows = listQuery.data?.content ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <ExecutionFilterBar filters={filters} strategyCodes={strategyCodes} onPatch={patch} />

      {filters.status !== 'PAPER' && (
        <FailureBreakdownPanel
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          activeCategory={activeCategory}
          onSelectCategory={(c) => {
            setPage(0);
            setActiveCategory(c);
          }}
        />
      )}

      {activeCategory && (
        <div className="flex items-center gap-2 text-[14px]" style={{ color: 'var(--mm-ink-2)' }}>
          <span>
            Filtered to <b>{activeCategory}</b>
          </span>
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="mm-pill"
            style={{ padding: '2px 8px' }}
          >
            clear ✕
          </button>
        </div>
      )}

      <ExecutionTable rows={rows} isLoading={listQuery.isLoading} onRowClick={setSelected} />

      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-3 text-[14px]"
          style={{ color: 'var(--mm-ink-2)' }}
        >
          <button
            type="button"
            className="mm-pill"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ padding: '3px 10px' }}
          >
            ‹ Prev
          </button>
          <span>
            page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="mm-pill"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '3px 10px' }}
          >
            Next ›
          </button>
        </div>
      )}

      <ExecutionDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
