'use client';

import { format } from 'date-fns';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePortfolioWeights } from '@/hooks/usePortfolioRebalance';
import type { PortfolioWeightRow, PortfolioWeightSource } from '@/types/portfolioRebalance';

interface WeightsTableProps {
  /**
   * Optional account scope. Pass the active account's id for the per-user
   * view; omit for the admin "all accounts" view across the platform.
   */
  accountId?: string;
}

/**
 * Live portfolio_weight per AccountStrategy row. Read-only -- mutations
 * go through {@link RebalanceDialog}. The "MANUAL" source badge signals
 * the operator that this row will be SKIPPED by the next rebalance
 * (the orchestrator never overwrites a manual hot-fix).
 */
export function WeightsTable({ accountId }: WeightsTableProps = {}) {
  const { data, isLoading, isError, refetch } = usePortfolioWeights(accountId);

  if (isLoading) return <TableSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load portfolio weights"
        description="The orchestrator's /portfolio/weights endpoint returned an error."
        action={
          <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw size={12} /> Retry
          </Button>
        }
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="No live AccountStrategy rows"
        description="Nothing live to rebalance. Enable a strategy first, then come back."
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">
          Current weights
          <span className="ml-2 font-mono text-[11px] text-text-muted">{data.items.length}</span>
        </h3>
        <div className="font-mono text-[10px] text-text-muted">
          guardrails [{data.guardrails.min_weight}, {data.guardrails.max_weight}]
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle">
              {['Code', 'Symbol', 'Interval', 'Weight', 'Source', 'Updated'].map((col) => (
                <th key={col} className="label-caps whitespace-nowrap px-4 py-2.5 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <WeightRow key={row.account_strategy_id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeightRow({ row }: { row: PortfolioWeightRow }) {
  return (
    <tr className="border-b border-bd-subtle last:border-b-0 hover:bg-bg-hover">
      <td className="num whitespace-nowrap px-4 py-3">
        <span className="font-mono text-[12px] font-semibold text-text-primary">
          {row.strategy_code}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-text-primary">{row.symbol}</td>
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[11px] text-text-muted">
        {row.interval_name}
      </td>
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[12px] tabular-nums text-text-primary">
        {formatWeight(row.portfolio_weight)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <SourceBadge source={row.weight_source} />
      </td>
      <td className="num whitespace-nowrap px-4 py-3 text-[11px] text-text-muted">
        {safeDateFmt(row.weight_updated_at)}
      </td>
    </tr>
  );
}

function formatWeight(w: number): string {
  if (!Number.isFinite(w)) return '—';
  return `${(w * 100).toFixed(2)}%`;
}

function SourceBadge({ source }: { source: PortfolioWeightSource }) {
  const meta = resolveSource(source);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
      )}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.fg }}
      />
      {source}
    </span>
  );
}

function resolveSource(source: PortfolioWeightSource): { bg: string; fg: string } {
  switch (source) {
    case 'HRP':
    case 'MEAN_VARIANCE':
      return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)' };
    case 'MANUAL':
      return { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' };
    case 'EQUAL_WEIGHT':
    default:
      return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' };
  }
}

function safeDateFmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd HH:mm');
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-bd-subtle bg-bg-surface p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-bd-subtle py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="ml-auto h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
