'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useResearchLog } from '@/hooks/useResearch';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatters';

/**
 * Progression view across every completed research run. One row per run,
 * headline metrics flattened. Lets us see v0.1 → v0.2 → v0.3 → v0.4 at a
 * glance without opening each run's detail page.
 */
export default function ResearchLogPage() {
  const [strategyFilter, setStrategyFilter] = useState<string>('TPR');
  const { data, isLoading, isFetching, refetch } = useResearchLog(
    strategyFilter || undefined,
    100,
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · LOG</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Progression
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            One row per completed run. Only runs with an analysis snapshot show up here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="label-caps !text-[9px]">Strategy</label>
          <select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            className="num rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1.5 text-[12px] text-text-primary"
          >
            <option value="">All</option>
            <option value="TPR">TPR</option>
            <option value="VCB">VCB</option>
            <option value="LSR">LSR</option>
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover"
          >
            {isFetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-md border border-bd-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
          No completed runs with analysis snapshots yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr className="border-b border-bd-subtle bg-bg-elevated">
                  <Th>Version</Th>
                  <Th>Created</Th>
                  <Th>Symbol · Int</Th>
                  <Th align="right">Trades</Th>
                  <Th align="right">WR</Th>
                  <Th align="right">PF</Th>
                  <Th align="right">Avg R</Th>
                  <Th align="right">Net PnL</Th>
                  <Th align="right">Max DD</Th>
                  <Th align="right">Consec L</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const wrColor =
                    row.winRate >= 0.5 ? 'var(--color-profit)' : 'var(--color-loss)';
                  const rColor =
                    row.avgR > 0
                      ? 'var(--color-profit)'
                      : row.avgR < 0
                        ? 'var(--color-loss)'
                        : 'var(--text-muted)';
                  const pnlColor =
                    row.netPnl > 0
                      ? 'var(--color-profit)'
                      : row.netPnl < 0
                        ? 'var(--color-loss)'
                        : 'var(--text-muted)';
                  const pfStr = row.profitFactor == null ? '∞' : row.profitFactor.toFixed(2);
                  return (
                    <tr key={row.runId} className="border-b border-bd-subtle last:border-b-0">
                      <Td className="font-mono">
                        {row.strategyVersion ?? '—'}
                        <span className="ml-2 text-text-muted">{row.strategyCode}</span>
                      </Td>
                      <Td className="font-mono text-text-muted">
                        {row.createdAt ? formatDate(Date.parse(row.createdAt)) : '—'}
                      </Td>
                      <Td className="font-mono">
                        {row.asset}
                        <span className="ml-1 text-text-muted">{row.interval}</span>
                      </Td>
                      <Td align="right" className="num">
                        {row.tradeCount}
                      </Td>
                      <Td align="right" className="num" style={{ color: wrColor }}>
                        {(row.winRate * 100).toFixed(1)}%
                      </Td>
                      <Td align="right" className="num">
                        {pfStr}
                      </Td>
                      <Td align="right" className="num" style={{ color: rColor }}>
                        {row.avgR.toFixed(3)}
                      </Td>
                      <Td align="right" className="num" style={{ color: pnlColor }}>
                        {row.netPnl > 0 ? '+' : ''}
                        {row.netPnl.toFixed(2)}
                      </Td>
                      <Td align="right" className="num text-[var(--color-loss)]">
                        {row.maxDrawdown.toFixed(2)}
                      </Td>
                      <Td align="right" className="num">
                        {row.maxConsecutiveLosses}
                      </Td>
                      <Td align="right">
                        <Link
                          href={`/backtest/${row.runId}`}
                          className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
                        >
                          View →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: 'right';
}) {
  return (
    <th
      className={`label-caps whitespace-nowrap px-3 py-2 !text-[9px] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
  style,
}: {
  children: React.ReactNode;
  align?: 'right';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 ${
        align === 'right' ? 'text-right tabular-nums' : ''
      } ${className ?? ''}`}
      style={style}
    >
      {children}
    </td>
  );
}
