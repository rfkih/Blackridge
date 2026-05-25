'use client';

import { useCallback, useMemo, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PendingApprovalCard } from './PendingApprovalCard';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';

/**
 * Embeddable section that renders the curator's pending-approval inbox.
 *
 * Wires up usePendingApprovals (30s polling), a per-symbol filter select
 * (only shown when more than one symbol is present in the list), a manual
 * refresh button, skeleton first-load state, and empty-state with Inbox icon.
 *
 * Anchor id="pending-approvals" + scroll-mt-20 lets external links deep-link
 * straight to this section (e.g. from curator email notifications).
 */
export function PendingApprovalsSection() {
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [openDialogCount, setOpenDialogCount] = useState(0);
  const {
    data: rows = [],
    isLoading,
    isFetching,
    refetch,
  } = usePendingApprovals({}, { pollingPaused: openDialogCount > 0 });

  const handleDialogOpenChange = useCallback(
    (delta: 1 | -1) => setOpenDialogCount((c) => Math.max(0, c + delta)),
    [],
  );

  /** All distinct symbols in the current PENDING list. */
  const symbols = useMemo(() => {
    const seen: Record<string, true> = {};
    rows.forEach((r) => {
      seen[r.symbol] = true;
    });
    return Object.keys(seen).sort();
  }, [rows]);

  const visible = symbolFilter ? rows.filter((r) => r.symbol === symbolFilter) : rows;

  const isFirstLoad = isLoading && rows.length === 0;

  return (
    <section id="pending-approvals" className="scroll-mt-20 space-y-4">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[16px] font-semibold text-text-primary">
            Pending approvals
          </h2>
          {!isFirstLoad && (
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary">
              {rows.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Symbol filter — only shown when >1 symbol present */}
          {symbols.length > 1 && (
            <select
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="rounded-md border border-bd-subtle bg-bg-surface px-2 py-1 font-mono text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter by symbol"
            >
              <option value="">All symbols</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Manual refresh button (30s polling runs automatically) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
            aria-label="Refresh pending approvals"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {isFirstLoad ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-bd-subtle bg-bg-surface py-12 text-center">
          <Inbox className="h-8 w-8 text-text-muted" strokeWidth={1.25} />
          <div>
            <p className="text-[14px] font-semibold text-text-primary">
              {symbolFilter ? `No pending approvals for ${symbolFilter}` : 'Inbox is empty'}
            </p>
            <p className="mt-1 text-[12px] text-text-secondary">
              {symbolFilter
                ? 'Clear the filter to see all pending items.'
                : 'New curator submissions will appear here automatically.'}
            </p>
          </div>
          {symbolFilter && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSymbolFilter('')}>
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <PendingApprovalCard
              key={row.id}
              row={row}
              onDialogOpenChange={handleDialogOpenChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
