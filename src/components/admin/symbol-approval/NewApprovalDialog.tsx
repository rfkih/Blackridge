'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateSymbolApproval, useAttachEvidence } from '@/hooks/useSymbolApprovals';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { useApprovalThresholds } from '@/hooks/useApprovalThresholds';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { BacktestRunPicker } from './BacktestRunPicker';
import type { GateFailureBody, SymbolApproval } from '@/types/symbolApproval';

/**
 * Approve a (symbol, code) pair, or attach evidence to a grandfathered
 * row. Same dialog covers both because the bottom half (run picker + notes
 * + 422 inline render) is identical; the top half differs only in which
 * fields are read-only.
 *
 * <p>The 422 GATE_FAILED body is rendered inline as a red bulleted list
 * with deltas so the operator sees exactly which threshold the run missed
 * — no toast, dialog stays open with the form preserved.
 */

interface NewApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog is in attach-evidence mode for this row. Symbol + code
   *  locked; PATCH /attach-evidence is sent instead of POST. */
  attachToRow?: SymbolApproval | null;
  /** When in create mode, locks the Symbol dropdown to this value (operator
   *  entered via the per-symbol chip). */
  presetSymbol?: string | null;
  /** Codes already actively approved for {@link presetSymbol} — filtered
   *  out of the strategy-code dropdown to prevent duplicate-pair errors. */
  alreadyApprovedCodes?: readonly string[];
}

export function NewApprovalDialog({
  open,
  onOpenChange,
  attachToRow,
  presetSymbol,
  alreadyApprovedCodes = [],
}: NewApprovalDialogProps) {
  const mode = attachToRow ? 'attach' : 'create';

  const [symbol, setSymbol] = useState<string>(presetSymbol ?? '');
  const [strategyCode, setStrategyCode] = useState<string>('');
  const [runId, setRunId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [gateFailure, setGateFailure] = useState<GateFailureBody | null>(null);

  const { data: definitions = [] } = useStrategyDefinitions();
  const { data: thresholds = [] } = useApprovalThresholds();
  const create = useCreateSymbolApproval();
  const attach = useAttachEvidence();

  const lockedSymbol = mode === 'attach' ? attachToRow!.symbol : (presetSymbol ?? null);
  const lockedCode = mode === 'attach' ? attachToRow!.strategyCode : null;

  useEffect(() => {
    if (!open) return;
    setSymbol(lockedSymbol ?? '');
    setStrategyCode(lockedCode ?? '');
    setRunId(null);
    setNotes('');
    setGateFailure(null);
    create.reset();
    attach.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachToRow?.id, presetSymbol]);

  const eligibleCodes = useMemo(
    () =>
      definitions
        .filter((d) => d.status === 'ACTIVE')
        .map((d) => d.strategyCode)
        .filter((c) => !alreadyApprovedCodes.includes(c))
        .sort((a, b) => a.localeCompare(b)),
    [definitions, alreadyApprovedCodes],
  );

  const threshold = useMemo(
    () => thresholds.find((t) => t.symbol === symbol),
    [thresholds, symbol],
  );

  const pending = create.isPending || attach.isPending;
  const canSubmit = !pending && Boolean(symbol) && Boolean(strategyCode) && Boolean(runId);

  async function handleSubmit() {
    setGateFailure(null);
    try {
      if (mode === 'attach') {
        await attach.mutateAsync({
          id: attachToRow!.id,
          payload: {
            backtestRunId: runId!,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
        });
        toast.success({
          title: 'Evidence attached',
          description: `${attachToRow!.symbol} · ${attachToRow!.strategyCode}`,
        });
      } else {
        await create.mutateAsync({
          symbol,
          strategyCode,
          backtestRunId: runId!,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        toast.success({
          title: 'Approval added',
          description: `${symbol} · ${strategyCode}`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      const ax = err as AxiosError<GateFailureBody>;
      if (ax.response?.status === 422 && ax.response.data?.error === 'GATE_FAILED') {
        setGateFailure(ax.response.data);
      } else {
        toast.error({
          title: mode === 'attach' ? 'Could not attach evidence' : 'Could not approve',
          description: normalizeError(err),
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-lg border-bd-subtle bg-bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <ShieldCheck size={14} className="text-profit" />
            {mode === 'attach' ? 'Attach evidence to approval' : 'Approve a strategy for a symbol'}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-secondary">
            {mode === 'attach'
              ? 'Attach a backtest run that clears the per-symbol thresholds — flips this row from grandfathered to approved.'
              : 'Approving a (symbol, strategy) pair unlocks it in the New Strategy picker. The backend gate enforces the per-symbol thresholds.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="label-caps !text-[9px]">Symbol</Label>
              {lockedSymbol ? (
                <div className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary">
                  {lockedSymbol}
                </div>
              ) : (
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue placeholder="Pick a symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {thresholds.map((t) => (
                      <SelectItem key={t.symbol} value={t.symbol} className="font-mono">
                        {t.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="label-caps !text-[9px]">Strategy code</Label>
              {lockedCode ? (
                <div className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary">
                  {lockedCode}
                </div>
              ) : (
                <Select
                  value={strategyCode}
                  onValueChange={setStrategyCode}
                  disabled={!symbol || eligibleCodes.length === 0}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue
                      placeholder={
                        !symbol
                          ? 'Pick symbol first'
                          : eligibleCodes.length === 0
                            ? 'Every code already approved'
                            : 'Pick a code'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCodes.map((c) => (
                      <SelectItem key={c} value={c} className="font-mono">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {threshold && (
            <div className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 font-mono text-[10px] text-text-secondary">
              Bar for {threshold.symbol}: CAGR ≥ {threshold.minCagrPct}% · cap ≥ $
              {threshold.minInitialCapitalUsd} · window ≥ {threshold.minWindowDays}d · trades ≥{' '}
              {threshold.minTrades}
            </div>
          )}

          {symbol && strategyCode && (
            <div className="space-y-1">
              <Label className="label-caps !text-[9px]">Backtest run (evidence)</Label>
              <BacktestRunPicker
                symbol={symbol}
                strategyCode={strategyCode}
                threshold={threshold}
                value={runId}
                onChange={setRunId}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="label-caps !text-[9px]">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. tuned 2026-05 on 4h"
              maxLength={500}
              className="h-8 text-[12px]"
            />
          </div>

          {gateFailure && <GateFailureCallout failure={gateFailure} />}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {pending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
            {mode === 'attach' ? 'Attach evidence' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GateFailureCallout({ failure }: { failure: GateFailureBody }) {
  return (
    <div className="border-[var(--color-loss)]/30 space-y-1 rounded-sm border bg-[var(--tint-loss)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-loss)]">
        <AlertCircle size={12} />
        Gate rejected this run — {failure.failedChecks.length} threshold
        {failure.failedChecks.length === 1 ? '' : 's'} not met
      </div>
      <ul className="space-y-0.5 pl-4 text-[11px] text-[var(--color-loss)]">
        {failure.failedChecks.map((c) => (
          <li key={c.name} className="font-mono">
            {humanizeCheckName(c.name)}: needed <span className="font-semibold">{c.threshold}</span>
            , got <span className="font-semibold">{c.actual}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanizeCheckName(name: string): string {
  switch (name) {
    case 'min_cagr_pct':
      return 'CAGR (%/yr)';
    case 'min_initial_capital_usd':
      return 'Initial capital ($)';
    case 'min_window_days':
      return 'Window (days)';
    case 'min_trades':
      return 'Trades';
    default:
      return name;
  }
}
