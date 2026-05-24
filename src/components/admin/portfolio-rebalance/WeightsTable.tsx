'use client';

import { format, formatDistanceToNow } from 'date-fns';
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

  const lastRebalance = resolveLastRebalance(data.items);
  const scoped = accountId !== undefined;

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">
          Current weights
          <span className="ml-2 font-mono text-[11px] text-text-muted">{data.items.length}</span>
        </h3>
        <div className="font-mono text-[10px] text-text-muted">
          guardrails [{data.guardrails.min_weight}, {data.guardrails.max_weight}]
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-bd-subtle bg-bg-elevated px-4 py-2 font-mono text-[11px] text-text-muted">
        {scoped && (
          <span>
            last rebalance{' '}
            <span className="text-text-primary">
              {lastRebalance.at
                ? `${formatDistanceToNow(lastRebalance.at, { addSuffix: true })}${
                    lastRebalance.label ? ` · ${lastRebalance.label}` : ''
                  }`
                : 'never'}
            </span>
          </span>
        )}
        <span>
          managed <span className="text-text-primary">{lastRebalance.managed}</span>
        </span>
        <span>
          equal-weight <span className="text-text-primary">{lastRebalance.equalWeight}</span>
        </span>
        {lastRebalance.manual > 0 && (
          <span>
            manual <span className="text-[color:var(--color-warning)]">{lastRebalance.manual}</span>
          </span>
        )}
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

interface LastRebalance {
  at: Date | null;
  label: string;
  managed: number;
  equalWeight: number;
  manual: number;
}

function resolveLastRebalance(items: PortfolioWeightRow[]): LastRebalance {
  let at: Date | null = null;
  let label = '';
  let managed = 0;
  let equalWeight = 0;
  let manual = 0;
  for (const row of items) {
    if (row.weight_source === 'EQUAL_WEIGHT') equalWeight += 1;
    else managed += 1;
    if (row.weight_source === 'MANUAL') manual += 1;
    // Only HRP / MEAN_VARIANCE count as "rebalance". MANUAL is an operator
    // hot-fix surfaced via the separate `manual` counter, not a rebalance.
    if (row.weight_source !== 'HRP' && row.weight_source !== 'MEAN_VARIANCE') continue;
    if (!row.weight_updated_at) continue;
    const d = new Date(row.weight_updated_at);
    if (Number.isNaN(d.getTime())) continue;
    if (!at || d.getTime() > at.getTime()) {
      at = d;
      label = row.weight_source;
    }
  }
  return { at, label, managed, equalWeight, manual };
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
