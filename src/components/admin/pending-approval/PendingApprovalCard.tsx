'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, RefreshCw, CheckCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConcernsPanel } from './ConcernsPanel';
import { ReplicationsPanel } from './ReplicationsPanel';
import { ParametersPanel } from './ParametersPanel';
import { ConfirmApproveDialog } from './ConfirmApproveDialog';
import { DismissDialog } from './DismissDialog';
import { useReplicatePendingApproval } from '@/hooks/usePendingApprovals';
import { normalizeError } from '@/lib/api/errorMap';
import { toast } from '@/hooks/useToast';
import type { PendingApproval, GateCheck } from '@/types/pendingApproval';

interface PendingApprovalCardProps {
  row: PendingApproval;
}

function formatCreatedTime(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm');
  } catch {
    return iso;
  }
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function GateCheckCell({ label, check }: { label: string; check: GateCheck }) {
  const gapPct = check.passed ? null : `gap ${(check.gap * 100).toFixed(1)}%`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold',
        check.passed
          ? 'bg-[var(--tint-profit)] text-[var(--color-profit)]'
          : 'bg-[var(--tint-loss)] text-[var(--color-loss)]',
      )}
      title={
        gapPct
          ? `${label}: actual ${check.actual}, threshold ${check.threshold} — ${gapPct}`
          : `${label}: actual ${check.actual}, threshold ${check.threshold} — passed`
      }
    >
      {check.passed ? (
        <CheckCircle2 className="h-2.5 w-2.5" />
      ) : (
        <XCircle className="h-2.5 w-2.5" />
      )}
      {label}
      {!check.passed && gapPct && <span className="ml-0.5 opacity-80">{gapPct}</span>}
    </span>
  );
}

export function PendingApprovalCard({ row }: PendingApprovalCardProps) {
  const [citedBacktestRunId, setCitedBacktestRunId] = useState<string>(row.backtestRunId);
  const [approveOpen, setApproveOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);

  const replicate = useReplicatePendingApproval();

  const handleReplicate = useCallback(() => {
    replicate.mutate(
      { id: row.id, request: { actor: '' } },
      {
        onSuccess: (data) => {
          toast.success({
            title: data.reused ? 'Replication already queued' : 'Replication queued',
            description: `Run ${data.backtestRunId.slice(0, 8)}… — results will appear below.`,
          });
        },
        onError: (err) => {
          toast.error({ title: 'Could not queue replication', description: normalizeError(err) });
        },
      },
    );
  }, [row.id, replicate]);

  const handleApproveOpen = useCallback(() => setApproveOpen(true), []);
  const handleApproveOpenChange = useCallback((open: boolean) => setApproveOpen(open), []);

  const handleDismissOpen = useCallback(() => setDismissOpen(true), []);
  const handleDismissOpenChange = useCallback((open: boolean) => setDismissOpen(open), []);

  const isPromote = row.verdict === 'PROMOTE';

  return (
    <>
      <div
        className={cn(
          'rounded-xl border bg-bg-surface',
          isPromote ? 'border-[var(--color-profit)]/40' : 'border-[var(--color-warning)]/40',
        )}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bd-subtle px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Verdict badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
                isPromote
                  ? 'bg-[var(--tint-profit)] text-[var(--color-profit)]'
                  : 'bg-[var(--tint-warning)] text-[var(--color-warning)]',
              )}
            >
              {isPromote ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <AlertTriangle className="h-2.5 w-2.5" />
              )}
              {row.verdict}
            </span>

            {/* Identity */}
            <span className="font-mono text-[12px] font-semibold text-text-primary">
              {row.symbol}
            </span>
            <span className="text-[12px] text-text-muted">·</span>
            <span className="font-mono text-[12px] text-text-primary">{row.strategyCode}</span>
            <span className="text-[12px] text-text-muted">·</span>
            <span className="font-mono text-[12px] text-text-secondary">{row.interval}</span>
          </div>

          <span className="shrink-0 font-mono text-[11px] text-text-muted">
            {formatCreatedTime(row.createdTime)}
            {row.createdBy && <span className="text-text-tertiary ml-1">by {row.createdBy}</span>}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Evidence summary row */}
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted">ag90</span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatPct(row.evidenceSummary.ag90)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted">dsr</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.dsr.toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted">n_trades</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.n_trades}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted">pf_lo</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.pf_lo.toFixed(3)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted">WF</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  row.evidenceSummary.wf_stability === 'ROBUST'
                    ? 'text-[var(--color-profit)]'
                    : row.evidenceSummary.wf_stability === 'MARGINAL'
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-loss)]',
                )}
              >
                {row.evidenceSummary.wf_stability}
              </span>
            </div>
          </div>

          {/* Gate-checks row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-text-muted">Gates:</span>
            <GateCheckCell label="cagr" check={row.gateCheck.cagr} />
            <GateCheckCell label="capital" check={row.gateCheck.capital} />
            <GateCheckCell label="window" check={row.gateCheck.window} />
            <GateCheckCell label="trades" check={row.gateCheck.trades} />
          </div>

          {/* Concerns — default-open on HOLD */}
          <ConcernsPanel concerns={row.concerns} defaultOpen={row.verdict === 'HOLD'} />

          {/* Replications panel */}
          <ReplicationsPanel
            replications={row.replications}
            originalEvidence={row.evidenceSummary}
            originalBacktestRunId={row.backtestRunId}
            selectedCitedId={citedBacktestRunId}
            onSelectCite={setCitedBacktestRunId}
          />

          {/* Parameters (collapsed by default — operator clicks to expand) */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary">
              <span className="mr-0.5 font-mono text-[10px] transition-transform group-open:rotate-90">
                ▶
              </span>
              Effective parameters ({Object.keys(row.effectiveParams).length})
            </summary>
            <div className="mt-2">
              <ParametersPanel params={row.effectiveParams} />
            </div>
          </details>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-bd-subtle pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReplicate}
              disabled={replicate.isPending}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {replicate.isPending ? 'Queuing…' : 'Replicate'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismissOpen}
              className="gap-1.5 text-[var(--color-loss)] hover:bg-[rgba(229,72,77,0.12)] hover:text-[var(--color-loss)]"
            >
              <XCircle className="h-3.5 w-3.5" />
              Dismiss
            </Button>
            <Button type="button" size="sm" onClick={handleApproveOpen} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        </div>
      </div>

      <ConfirmApproveDialog
        row={approveOpen ? row : null}
        citedBacktestRunId={citedBacktestRunId}
        onOpenChange={handleApproveOpenChange}
      />

      <DismissDialog row={dismissOpen ? row : null} onOpenChange={handleDismissOpenChange} />
    </>
  );
}
