'use client';

import { useMemo } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type {
  EvidenceSummary,
  Replication,
  ReplicationMetricsSummary,
  ReplicationStatus,
} from '@/types/pendingApproval';

interface ReplicationsPanelProps {
  replications: Replication[];
  /** The original cited backtest's headline metrics -- shown for side-by-side compare. */
  originalEvidence: EvidenceSummary;
  /** The original backtest_run_id (always cite-able). */
  originalBacktestRunId: string;
  /** Currently selected cited backtestRunId in the ConfirmApproveDialog. */
  selectedCitedId: string;
  onSelectCite: (backtestRunId: string) => void;
}

const STATUS_ICON: Record<ReplicationStatus, React.ReactNode> = {
  QUEUED: <Clock className="h-3 w-3" />,
  RUNNING: <Loader2 className="h-3 w-3 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
};

const STATUS_CLASS: Record<ReplicationStatus, string> = {
  QUEUED: 'text-text-tertiary',
  RUNNING: 'text-info',
  COMPLETED: 'text-success',
  FAILED: 'text-danger',
};

/**
 * Color-code per spec § 7.1: green if replicated metric within ±5% of
 * original, yellow if ±5-20%, red if > 20%. Computed per metric.
 */
function deviationClass(original: number, replicated: number | undefined | null): string {
  if (replicated === undefined || replicated === null || original === 0)
    return 'text-text-secondary';
  const pct = Math.abs((replicated - original) / original);
  if (pct <= 0.05) return 'text-success';
  if (pct <= 0.2) return 'text-warning';
  return 'text-danger';
}

function renderMetric(
  label: string,
  originalValue: number,
  replicatedValue: number | undefined | null,
) {
  return (
    <div className="flex items-baseline gap-1 text-[11px]">
      <span className="text-text-tertiary">{label}=</span>
      <span
        className={cn('font-mono tabular-nums', deviationClass(originalValue, replicatedValue))}
      >
        {replicatedValue ?? '—'}
      </span>
    </div>
  );
}

function formatRequestedAt(iso: string | null): string {
  if (!iso) return 'unknown';
  try {
    return format(new Date(iso), 'MMM d HH:mm');
  } catch {
    return iso;
  }
}

export function ReplicationsPanel({
  replications,
  originalEvidence,
  originalBacktestRunId,
  selectedCitedId,
  onSelectCite,
}: ReplicationsPanelProps) {
  // Row 0 is always the original backtest -- the admin should be able to
  // pick "cite original" too. Subsequent rows are user-triggered replicas.
  const rows = useMemo(
    () => [
      {
        backtestRunId: originalBacktestRunId,
        requestedAt: null,
        requestedBy: 'curator (original)',
        status: 'COMPLETED' as ReplicationStatus,
        metricsSummary: {
          ag90: originalEvidence.ag90,
          n_trades: originalEvidence.n_trades,
        } satisfies ReplicationMetricsSummary,
        error: null,
        isOriginal: true,
      },
      ...replications.map((r) => ({ ...r, isOriginal: false })),
    ],
    [replications, originalEvidence, originalBacktestRunId],
  );

  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-semibold text-text-secondary">
        Backtest runs (cite one before Approve)
      </div>
      <ul className="space-y-1">
        {rows.map((row) => {
          const isSelected = selectedCitedId === row.backtestRunId;
          const isCompleted = row.status === 'COMPLETED';
          return (
            <li
              key={row.backtestRunId}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded border px-2 py-1.5 text-[12px]',
                isSelected ? 'border-accent bg-accent/5' : 'bg-bg-surface-2 border-bd-subtle',
                !isCompleted && !row.isOriginal && 'opacity-70',
              )}
            >
              <label htmlFor={`cite-${row.backtestRunId}`} className="flex items-center gap-2">
                <input
                  id={`cite-${row.backtestRunId}`}
                  type="radio"
                  name={`cite-${originalBacktestRunId}`}
                  checked={isSelected}
                  disabled={!isCompleted}
                  onChange={() => onSelectCite(row.backtestRunId)}
                  className="cursor-pointer"
                  aria-label={isCompleted ? `Cite this run` : `Pending — cite when COMPLETED`}
                />
                <span className={cn('flex items-center gap-1', STATUS_CLASS[row.status])}>
                  {STATUS_ICON[row.status]}
                  {row.status}
                </span>
              </label>
              <span className="text-text-tertiary truncate font-mono" title={row.backtestRunId}>
                {row.backtestRunId.slice(0, 8)}…
              </span>
              <span className="text-text-tertiary">{formatRequestedAt(row.requestedAt)}</span>
              {row.requestedBy && <span className="text-text-tertiary">{row.requestedBy}</span>}
              <div className="ml-auto flex items-center gap-3">
                {renderMetric('ag90', originalEvidence.ag90, row.metricsSummary?.ag90)}
                {renderMetric('n_trades', originalEvidence.n_trades, row.metricsSummary?.n_trades)}
                {/* psr + profit_factor on replications are intentionally NOT shown side-by-side here:
                    EvidenceSummary (the original curator metrics) doesn't carry them, so we can't
                    color-code deviation. Operator who needs raw values can click "View backtest" on
                    the strategy-detail page once the V102 row is created. */}
                {row.error && (
                  <span className="text-danger text-[11px]" title={row.error}>
                    error
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
