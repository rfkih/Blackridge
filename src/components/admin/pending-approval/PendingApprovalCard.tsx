'use client';

import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CheckCheck,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  /** Called with +1 when a dialog opens, -1 when it closes.
   *  PendingApprovalsSection uses this to pause polling while admin is mid-typing. */
  onDialogOpenChange?: (delta: 1 | -1) => void;
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
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[12px] font-semibold',
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

export function PendingApprovalCard({ row, onDialogOpenChange }: PendingApprovalCardProps) {
  const [citedBacktestRunId, setCitedBacktestRunId] = useState<string>(row.backtestRunId);
  const [approveOpen, setApproveOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [replicateConfirmOpen, setReplicateConfirmOpen] = useState(false);

  // E1: Reset citedBacktestRunId when the curator upserts the row in-place
  // (PR #1 PendingApprovalService.updateInPlace) with a new backtestRunId.
  useEffect(() => {
    setCitedBacktestRunId(row.backtestRunId);
  }, [row.backtestRunId]);

  const replicate = useReplicatePendingApproval();

  const handleReplicate = useCallback(() => {
    replicate.mutate(
      { id: row.id, request: {} },
      {
        onSuccess: (data) => {
          setReplicateConfirmOpen(false);
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

  const handleApproveOpen = useCallback(() => {
    setApproveOpen(true);
    onDialogOpenChange?.(1);
  }, [onDialogOpenChange]);

  const handleApproveOpenChange = useCallback(
    (open: boolean) => {
      setApproveOpen(open);
      if (!open) onDialogOpenChange?.(-1);
    },
    [onDialogOpenChange],
  );

  const handleDismissOpen = useCallback(() => {
    setDismissOpen(true);
    onDialogOpenChange?.(1);
  }, [onDialogOpenChange]);

  const handleDismissOpenChange = useCallback(
    (open: boolean) => {
      setDismissOpen(open);
      if (!open) onDialogOpenChange?.(-1);
    },
    [onDialogOpenChange],
  );

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
                'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[14px] font-bold uppercase tracking-wide',
                isPromote
                  ? 'bg-[var(--color-profit)] text-[var(--bg-base)]'
                  : 'bg-[var(--color-warning)] text-[var(--bg-base)]',
              )}
            >
              {isPromote ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {row.verdict}
            </span>

            {/* Identity */}
            <span className="font-mono text-[14px] font-semibold text-text-primary">
              {row.symbol}
            </span>
            <span className="text-[14px] text-text-muted">·</span>
            <span className="font-mono text-[14px] text-text-primary">{row.strategyCode}</span>
            <span className="text-[14px] text-text-muted">·</span>
            <span className="font-mono text-[14px] text-text-secondary">{row.interval}</span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-text-muted">
              {formatCreatedTime(row.createdTime)}
              {row.createdBy && <span className="text-text-tertiary ml-1">by {row.createdBy}</span>}
            </span>
            <a
              href={`/backtest/${row.backtestRunId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary"
              title="Open the cited backtest run"
              aria-label={`View backtest ${row.backtestRunId.slice(0, 8)}`}
            >
              <ExternalLink className="h-3 w-3" />
              backtest
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Evidence summary row */}
          <div className="flex flex-wrap items-center gap-4 text-[14px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-muted">ag90</span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatPct(row.evidenceSummary.ag90)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-muted">dsr</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.dsr.toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-muted">n_trades</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.n_trades}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-muted">pf_lo</span>
              <span className="font-mono tabular-nums text-text-primary">
                {row.evidenceSummary.pf_lo.toFixed(3)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-muted">WF</span>
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

          {/* Gate-checks row — failures pinned first for fast triage */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-text-muted">Gates:</span>
            {(
              [
                ['cagr', row.gateCheck.cagr],
                ['capital', row.gateCheck.capital],
                ['window', row.gateCheck.window],
                ['trades', row.gateCheck.trades],
              ] as [string, GateCheck | undefined][]
            )
              .filter((entry): entry is [string, GateCheck] => entry[1] !== undefined)
              .sort(([, a], [, b]) => Number(a.passed) - Number(b.passed))
              .map(([label, check]) => (
                <GateCheckCell key={label} label={label} check={check} />
              ))}
          </div>

          {/* E2: Always show a HOLD banner even when concerns=[] — HOLD means
              "promote with caveats" and a missing concerns list should not
              make the verdict invisible. ConcernsPanel returns null on empty. */}
          {row.verdict === 'HOLD' && row.concerns.length === 0 && (
            <div className="border-warning/30 bg-warning/5 rounded-lg border p-3 text-[14px] text-warning">
              <AlertTriangle className="inline h-3 w-3" /> HOLD verdict with no specific concerns
              recorded — curator soft-failed on V102 gate margin (see gate-check row above). Review
              the gap value before approving.
            </div>
          )}

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
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[14px] text-text-secondary hover:text-text-primary">
              <span className="mr-0.5 font-mono text-[12px] transition-transform group-open:rotate-90">
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
              onClick={() => setReplicateConfirmOpen(true)}
              disabled={replicate.isPending}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {replicate.isPending ? 'Queuing…' : 'Replicate'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismissOpen}
              className="gap-1.5 text-text-secondary hover:bg-[rgba(229,72,77,0.08)] hover:text-[var(--color-loss)]"
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

      <Dialog open={replicateConfirmOpen} onOpenChange={setReplicateConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Queue replication?</DialogTitle>
            <DialogDescription>
              This will kick off a fresh backtest run for{' '}
              <span className="font-mono font-semibold">{row.strategyCode}</span> ·{' '}
              <span className="font-mono">{row.symbol} {row.interval}</span>.
              Results appear in the Replications panel below when complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setReplicateConfirmOpen(false)}
              disabled={replicate.isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[14px] text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReplicate}
              disabled={replicate.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-1.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {replicate.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {replicate.isPending ? 'Queuing…' : 'Queue replication'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
