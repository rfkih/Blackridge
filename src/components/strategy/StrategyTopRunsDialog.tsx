'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { annualizeReturnPct, useTopRunsForStrategy } from '@/hooks/useBacktest';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';
import type { BacktestRun } from '@/types/backtest';

interface StrategyTopRunsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
}

export function StrategyTopRunsDialog({
  open,
  onOpenChange,
  strategy,
}: StrategyTopRunsDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setExpandedId(null);
  }, [open]);

  const { topRuns, isLoading, isError } = useTopRunsForStrategy(
    strategy?.strategyCode ?? '',
    strategy?.symbol ?? '',
    strategy?.interval ?? '',
    { enabled: open && strategy != null },
  );

  if (!strategy) return null;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const cutoffLabel = format(twoYearsAgo, 'MMM yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-bd bg-bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-[15px]">Top backtest results</DialogTitle>
          <DialogDescription className="font-mono text-[14px]">
            {strategy.strategyCode} · {strategy.symbol} · {strategy.interval}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1">
          {isLoading && <LoadingRows />}

          {!isLoading && isError && (
            <p className="py-6 text-center text-[14px] text-[var(--color-loss)]">
              Could not load backtest history. Please try again.
            </p>
          )}

          {!isLoading && !isError && topRuns.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[14px] text-text-secondary">
                No completed backtests covering 2+ years found for{' '}
                <span className="font-mono text-text-primary">
                  {strategy.strategyCode} · {strategy.symbol} · {strategy.interval}
                </span>
                .
              </p>
              <p className="mt-1 text-[13px] text-text-muted">
                Run a backtest with a start date of {cutoffLabel} or earlier to build the ranking.
              </p>
            </div>
          )}

          {!isLoading && !isError && topRuns.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['#', 'Period', 'ag90/yr', 'Sharpe', 'PF', 'Max DD', 'Params', ''].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'pb-2 font-mono text-[12px] font-semibold uppercase tracking-wider text-text-muted',
                        h === 'ag90/yr' || h === 'Sharpe' || h === 'PF' || h === 'Max DD'
                          ? 'text-right'
                          : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRuns.map((run, idx) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    rank={idx + 1}
                    strategyCode={strategy.strategyCode}
                    expanded={expandedId === run.id}
                    onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function RunRow({
  run,
  rank,
  strategyCode,
  expanded,
  onToggle,
}: {
  run: BacktestRun;
  rank: number;
  strategyCode: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { metrics, fromDate, toDate, paramSnapshot } = run;
  const rawAg90 = metrics?.geometricReturnPctAtAlloc90 ?? null;
  const ag90 = rawAg90 !== null ? annualizeReturnPct(rawAg90, fromDate, toDate) : null;
  const sharpe = metrics?.sharpe ?? null;
  const pf = metrics?.profitFactor ?? null;
  const maxDD = metrics?.maxDrawdownPct ?? null;

  const overrides = (paramSnapshot?.[strategyCode] as Record<string, unknown>) ?? {};
  const overrideCount = Object.keys(overrides).length;

  const periodLabel = `${format(new Date(fromDate), 'MMM yyyy')} – ${format(new Date(toDate), 'MMM yyyy')}`;

  const ag90Color =
    ag90 === null
      ? 'var(--text-muted)'
      : ag90 >= 20
        ? 'var(--color-profit)'
        : ag90 < 0
          ? 'var(--color-loss)'
          : 'var(--text-primary)';

  return (
    <>
      <tr
        className="cursor-pointer border-b border-[var(--border-subtle)]/50 transition-colors hover:bg-[var(--bg-hover)]"
        onClick={onToggle}
      >
        <td className="py-3 pr-3 font-mono text-[13px] text-text-muted">#{rank}</td>
        <td className="py-3 pr-4 font-mono text-[13px] text-text-secondary">{periodLabel}</td>
        <td
          className="py-3 pr-3 text-right font-mono text-[13px] font-semibold tabular-nums"
          style={{ color: ag90Color }}
        >
          {ag90 !== null ? `${ag90 >= 0 ? '+' : ''}${ag90.toFixed(1)}%` : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums text-text-secondary">
          {sharpe !== null ? sharpe.toFixed(2) : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums text-text-secondary">
          {pf !== null ? pf.toFixed(2) : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[13px] tabular-nums text-text-secondary">
          {maxDD !== null ? `${maxDD.toFixed(0)}%` : '—'}
        </td>
        <td className="py-3 pr-3 font-mono text-[13px] text-text-muted">
          {overrideCount > 0
            ? `${overrideCount} override${overrideCount !== 1 ? 's' : ''}`
            : 'Defaults'}
        </td>
        <td className="py-3 text-text-muted">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="pb-3 pt-0">
            <ParamDetail overrides={overrides} />
          </td>
        </tr>
      )}
    </>
  );
}

function ParamDetail({ overrides }: { overrides: Record<string, unknown> }) {
  const entries = Object.entries(overrides);
  if (entries.length === 0) {
    return (
      <div className="rounded-md bg-[var(--bg-base)] px-4 py-3 text-[13px] text-text-muted">
        Default parameters — no overrides applied.
      </div>
    );
  }
  return (
    <div className="rounded-md bg-[var(--bg-base)] px-4 py-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="font-mono text-[13px] text-text-muted">{key}</span>
            <span className="font-mono text-[13px] tabular-nums text-text-primary">
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
