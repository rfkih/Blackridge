'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { AxiosError } from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApprovePendingApproval } from '@/hooks/usePendingApprovals';
import { useToast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/errorMap';
import type { PendingApproval } from '@/types/pendingApproval';
import type { GateFailureBody } from '@/types/symbolApproval';

/** The literal the admin must type verbatim before approval is enabled. */
const CONFIRM_TOKEN = 'CONFIRM';

interface CitedMetrics {
  ag90: number;
  n_trades: number;
}

/**
 * Resolve the headline metrics for the run the admin intends to cite.
 * Falls back to the original evidence when no citedId is given or the
 * replication cannot be found (e.g. still QUEUED/RUNNING).
 */
function resolveCitedMetrics(
  row: PendingApproval,
  citedId: string,
): { metrics: CitedMetrics; isReplicated: boolean } {
  const original: CitedMetrics = {
    ag90: row.evidenceSummary.ag90,
    n_trades: row.evidenceSummary.n_trades,
  };

  if (!citedId || citedId === row.backtestRunId) {
    return { metrics: original, isReplicated: false };
  }

  const replication = row.replications.find((r) => r.backtestRunId === citedId);
  if (
    replication?.status === 'COMPLETED' &&
    replication.metricsSummary?.ag90 !== undefined &&
    replication.metricsSummary?.n_trades !== undefined
  ) {
    return {
      metrics: {
        ag90: replication.metricsSummary.ag90 as number,
        n_trades: replication.metricsSummary.n_trades as number,
      },
      isReplicated: true,
    };
  }

  // Replication found but not yet COMPLETED — fall back to original evidence
  return { metrics: original, isReplicated: false };
}

function formatAg90(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

interface ConfirmApproveDialogProps {
  /** When non-null the dialog is open. */
  row: PendingApproval | null;
  /**
   * The backtestRunId the admin has selected in ReplicationsPanel.
   * Defaults to row.backtestRunId when the panel hasn't been touched.
   */
  citedBacktestRunId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmApproveDialog({
  row,
  citedBacktestRunId,
  onOpenChange,
}: ConfirmApproveDialogProps) {
  const [typed, setTyped] = useState('');
  const [gateFailure, setGateFailure] = useState<GateFailureBody | null>(null);
  const toast = useToast();
  const approve = useApprovePendingApproval();

  const open = row !== null;

  // Reset typed confirmation and gate-failure state whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setTyped('');
      setGateFailure(null);
    }
  }, [open]);

  const effectiveCitedId = citedBacktestRunId ?? row?.backtestRunId ?? '';
  const { metrics, isReplicated } = row
    ? resolveCitedMetrics(row, effectiveCitedId)
    : { metrics: { ag90: 0, n_trades: 0 }, isReplicated: false };

  const isConfirmed = typed === CONFIRM_TOKEN;
  const isHoldWithConcerns = row !== null && row.verdict === 'HOLD' && row.concerns.length > 0;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleTypedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTyped(e.target.value);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!row || !isConfirmed) return;

    setGateFailure(null);
    try {
      await approve.mutateAsync({
        id: row.id,
        request: {
          citedBacktestRunId: effectiveCitedId || undefined,
        },
      });
      toast.success({
        title: 'Approved',
        description: `${row.strategyCode} / ${row.symbol} approved and surfaced to public picker.`,
      });
      handleOpenChange(false);
    } catch (err) {
      const ax = err as AxiosError<GateFailureBody>;
      if (ax.response?.status === 422 && ax.response.data?.error === 'GATE_FAILED') {
        // Render per-check failures inline — do NOT show a toast.
        setGateFailure(ax.response.data);
      } else {
        toast.error({
          title: 'Approval failed',
          description: normalizeError(err),
        });
      }
    }
  }, [row, isConfirmed, approve, effectiveCitedId, toast, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm approval</DialogTitle>
          <DialogDescription>
            {row ? `${row.strategyCode} · ${row.symbol} · ${row.interval}` : 'No item selected.'}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="flex flex-col gap-4">
            {/* Cited backtest metrics */}
            <div className="bg-bg-surface-2 rounded-lg border border-bd-subtle p-3 text-[14px]">
              <div className="mb-1.5 text-[14px] font-semibold text-text-secondary">
                Cited backtest
              </div>
              <div className="text-text-tertiary mb-2 font-mono text-[13px]">
                {effectiveCitedId || row.backtestRunId}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-tertiary text-[13px]">ag90</span>
                  <span className="font-mono tabular-nums text-text-primary">
                    {formatAg90(metrics.ag90)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-tertiary text-[13px]">n_trades</span>
                  <span className="font-mono tabular-nums text-text-primary">
                    {metrics.n_trades}
                  </span>
                </div>
              </div>
              {isReplicated && (
                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-info">
                  <Info className="h-3 w-3 shrink-0" />
                  Using a replicated run — metrics may differ from original evidence.
                </div>
              )}
            </div>

            {/* Concerns — shown for HOLD rows */}
            {isHoldWithConcerns && (
              <div className="border-warning/30 bg-warning/5 rounded-lg border p-3">
                <div className="mb-2 text-[14px] font-semibold text-warning">
                  Curator concerns (verdict: HOLD)
                </div>
                <ul className="space-y-2 text-[14px]">
                  {row.concerns.map((c, i) => (
                    <li
                      key={`${c.source}-${i}`}
                      className="border-warning/40 flex flex-col gap-0.5 border-l-2 pl-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-text-secondary">{c.source}</span>
                        <span className="text-warning">{c.severity}</span>
                      </div>
                      <p className="text-text-primary">{c.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 422 GATE_FAILED inline render — mirrors V102 NewApprovalDialog pattern */}
            {gateFailure && (
              <div className="border-warning/30 bg-warning/5 space-y-1 rounded-sm border px-3 py-2">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-warning">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Gate rejected this approval — {gateFailure.failedChecks.length} threshold
                  {gateFailure.failedChecks.length === 1 ? '' : 's'} not met
                </div>
                <ul className="space-y-0.5 pl-4 text-[13px] text-warning">
                  {gateFailure.failedChecks.map((c) => (
                    <li key={c.name} className="font-mono">
                      {c.name}: threshold <span className="font-semibold">{c.threshold}</span> &gt;
                      actual <span className="font-semibold">{c.actual}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Type-CONFIRM gate */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-token">
                Type <span className="font-mono text-text-primary">{CONFIRM_TOKEN}</span> to proceed
              </Label>
              <Input
                id="confirm-token"
                placeholder={CONFIRM_TOKEN}
                value={typed}
                onChange={handleTypedChange}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={approve.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!isConfirmed || approve.isPending}>
            {approve.isPending ? 'Approving…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
