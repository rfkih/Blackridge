'use client';

import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ParamsPopover } from '@/components/leaderboard/ParamsPopover';
import { useCreateSymbolApproval } from '@/hooks/useSymbolApprovals';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { GateFailureBody } from '@/types/symbolApproval';

/**
 * Shared "Request approval" confirmation dialog for explore-only candidates
 * (Backtest + Research-paper tabs). Wraps the V102 `createApproval` mutation.
 *
 * The 422 `GATE_FAILED` body is surfaced as a readable toast listing the
 * failed checks (the admin dialog renders it inline; here we keep it to a
 * toast since the candidate tables aren't an admin surface).
 */
export interface ApprovalTarget {
  symbol: string;
  strategyCode: string;
  interval: string;
  backtestRunId: string;
  /** Effective params for the run — shown read-only in the confirm dialog. */
  params: Record<string, unknown>;
}

interface RequestApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ApprovalTarget | null;
}

const GATE_CHECK_LABELS: Record<string, string> = {
  min_cagr_pct: 'CAGR (%/yr)',
  min_initial_capital_usd: 'Initial capital ($)',
  min_window_days: 'Window (days)',
  min_trades: 'Trades',
};

function describeGateFailure(body: GateFailureBody): string {
  return body.failedChecks
    .map((c) => {
      const label = GATE_CHECK_LABELS[c.name] ?? c.name;
      return `${label}: needed ${c.threshold}, got ${c.actual}`;
    })
    .join(' · ');
}

export function RequestApprovalDialog({ open, onOpenChange, target }: RequestApprovalDialogProps) {
  const [notes, setNotes] = useState('');
  const create = useCreateSymbolApproval();

  useEffect(() => {
    if (open) {
      setNotes('');
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.backtestRunId]);

  async function handleSubmit() {
    if (!target) return;
    try {
      await create.mutateAsync({
        symbol: target.symbol,
        strategyCode: target.strategyCode,
        backtestRunId: target.backtestRunId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success({
        title: 'Approval requested',
        description: `${target.symbol} · ${target.strategyCode}${
          target.interval ? ` · ${target.interval}` : ''
        }`,
      });
      onOpenChange(false);
    } catch (err) {
      const ax = err as AxiosError<GateFailureBody>;
      if (ax.response?.status === 422 && ax.response.data?.error === 'GATE_FAILED') {
        toast.error({
          title: 'Approval gate rejected this run',
          description: describeGateFailure(ax.response.data),
        });
      } else {
        toast.error({
          title: 'Could not request approval',
          description: normalizeError(err),
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <ShieldCheck size={14} className="text-[var(--color-profit)]" />
            Request approval
          </DialogTitle>
          <DialogDescription className="text-[12px] text-[var(--text-secondary)]">
            Submits this run to the V102 approval gate. The backend re-validates it against the
            per-symbol thresholds; if it clears, the (symbol, strategy) pair becomes deployable.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2">
              <Field label="Symbol" value={target.symbol} />
              <Field label="Strategy" value={target.strategyCode} />
              <Field label="Interval" value={target.interval || '—'} />
              <Field label="Backtest run" value={target.backtestRunId} mono />
            </div>

            <div className="space-y-1">
              <Label className="label-caps !text-[9px]">Effective parameters</Label>
              <ParamsPopover params={target.params} label="parameters" />
            </div>

            <div className="space-y-1">
              <Label className="label-caps !text-[9px]">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. promote 2026-05 sweep winner"
                maxLength={500}
                className="h-8 text-[12px]"
              />
            </div>

            <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                Requesting approval does not deploy anything — it only unlocks the pair for a later
                deploy from the Conviction tab.
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={create.isPending || !target}
          >
            {create.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
            Request approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`truncate text-[12px] text-[var(--text-primary)] ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
