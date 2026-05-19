'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
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
import { useUpsertApprovalThreshold } from '@/hooks/useApprovalThresholds';
import { useAdminSymbolApprovals } from '@/hooks/useSymbolApprovals';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { SymbolApproval, SymbolApprovalThreshold } from '@/types/symbolApproval';

/**
 * Two-step threshold editor. Step 1 lets the operator type new floors and
 * surfaces the stale-impact preview live. Step 2 is a confirm diff with
 * per-row before/after status so the operator sees exactly which approvals
 * the change reclassifies. No cascade-revoke — staling is reversible
 * (lower the floor back), revoking is not.
 *
 * <p>Stale-impact preview is computed client-side from the cached admin
 * list so there's no extra round-trip.
 */
interface EditThresholdsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold: SymbolApprovalThreshold | null;
}

type FormState = {
  minCagrPct: string;
  minInitialCapitalUsd: string;
  minWindowDays: string;
  minTrades: string;
};

export function EditThresholdsDialog({ open, onOpenChange, threshold }: EditThresholdsDialogProps) {
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [form, setForm] = useState<FormState>({
    minCagrPct: '',
    minInitialCapitalUsd: '',
    minWindowDays: '',
    minTrades: '',
  });
  const upsert = useUpsertApprovalThreshold();
  const { data: approvals = [] } = useAdminSymbolApprovals(false);

  useEffect(() => {
    if (!open || !threshold) return;
    setStep('input');
    setForm({
      minCagrPct: String(threshold.minCagrPct),
      minInitialCapitalUsd: String(threshold.minInitialCapitalUsd),
      minWindowDays: String(threshold.minWindowDays),
      minTrades: String(threshold.minTrades),
    });
    upsert.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threshold?.symbol]);

  const parsed = useMemo(() => parseForm(form), [form]);
  const formValid = parsed != null;

  const symbolApprovals = useMemo(
    () => (threshold ? approvals.filter((a) => a.symbol === threshold.symbol) : []),
    [approvals, threshold],
  );

  const impact = useMemo(() => {
    if (!parsed || !threshold) return [];
    return symbolApprovals.map((a) => ({
      approval: a,
      before: classify(a, threshold),
      after: classify(a, { ...threshold, ...parsed }),
    }));
  }, [parsed, threshold, symbolApprovals]);

  const willStaleCount = impact.filter((r) => r.before !== 'stale' && r.after === 'stale').length;

  if (!threshold) return null;

  async function handleApply() {
    if (!parsed || !threshold) return;
    try {
      await upsert.mutateAsync({ symbol: threshold.symbol, payload: parsed });
      toast.success({
        title: 'Thresholds updated',
        description: `${threshold.symbol} — ${willStaleCount} now stale`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error({ title: 'Could not save thresholds', description: normalizeError(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !upsert.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-md border-bd-subtle bg-bg-surface">
        <DialogHeader>
          <DialogTitle className="text-[14px]">
            {step === 'input'
              ? `Edit thresholds for ${threshold.symbol}`
              : 'Confirm threshold change'}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-secondary">
            {step === 'input'
              ? 'Raising any floor may flag existing approvals as stale. Approvals are never auto-revoked — staleness is the signal.'
              : `Applying this will mark ${willStaleCount} approval${willStaleCount === 1 ? '' : 's'} as stale.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <InputStep
            form={form}
            setForm={setForm}
            willStaleCount={willStaleCount}
            impactSize={impact.length}
            formValid={formValid}
          />
        ) : (
          <ConfirmStep
            threshold={threshold}
            parsed={parsed!}
            impact={impact}
          />
        )}

        <DialogFooter>
          {step === 'input' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!formValid}
              >
                Continue <ChevronRight size={12} className="ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                disabled={upsert.isPending}
              >
                Back
              </Button>
              <Button type="button" onClick={handleApply} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
                Apply{willStaleCount > 0 ? ` — ${willStaleCount} will stale` : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InputStep({
  form,
  setForm,
  willStaleCount,
  impactSize,
  formValid,
}: {
  form: FormState;
  setForm: (s: FormState) => void;
  willStaleCount: number;
  impactSize: number;
  formValid: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field
        label="Min CAGR (%/yr)"
        value={form.minCagrPct}
        onChange={(v) => setForm({ ...form, minCagrPct: v })}
      />
      <Field
        label="Min capital ($)"
        value={form.minInitialCapitalUsd}
        onChange={(v) => setForm({ ...form, minInitialCapitalUsd: v })}
      />
      <Field
        label="Min window (days)"
        value={form.minWindowDays}
        onChange={(v) => setForm({ ...form, minWindowDays: v })}
      />
      <Field
        label="Min trades"
        value={form.minTrades}
        onChange={(v) => setForm({ ...form, minTrades: v })}
      />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'col-span-2 rounded-sm px-3 py-2 text-[11px]',
          willStaleCount > 0
            ? 'border border-[var(--color-warning)]/30 bg-[var(--tint-warning)] text-[var(--color-warning)]'
            : 'border border-bd-subtle bg-bg-base text-text-muted',
        )}
      >
        {!formValid ? (
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle size={11} /> All four floors must be positive numbers.
          </span>
        ) : willStaleCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle size={11} />
            {willStaleCount} of {impactSize} existing approval
            {impactSize === 1 ? '' : 's'} would be flagged stale.
          </span>
        ) : (
          <>No existing approvals would be affected.</>
        )}
      </div>
    </div>
  );
}

function ConfirmStep({
  threshold,
  parsed,
  impact,
}: {
  threshold: SymbolApprovalThreshold;
  parsed: NonNullable<ReturnType<typeof parseForm>>;
  impact: { approval: SymbolApproval; before: ApprovalClassification; after: ApprovalClassification }[];
}) {
  const diffs: { label: string; from: string; to: string }[] = [];
  if (parsed.minCagrPct !== threshold.minCagrPct) {
    diffs.push({ label: 'CAGR', from: `${threshold.minCagrPct}%`, to: `${parsed.minCagrPct}%` });
  }
  if (parsed.minInitialCapitalUsd !== threshold.minInitialCapitalUsd) {
    diffs.push({
      label: 'Capital',
      from: `$${threshold.minInitialCapitalUsd}`,
      to: `$${parsed.minInitialCapitalUsd}`,
    });
  }
  if (parsed.minWindowDays !== threshold.minWindowDays) {
    diffs.push({
      label: 'Window',
      from: `${threshold.minWindowDays}d`,
      to: `${parsed.minWindowDays}d`,
    });
  }
  if (parsed.minTrades !== threshold.minTrades) {
    diffs.push({ label: 'Trades', from: String(threshold.minTrades), to: String(parsed.minTrades) });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[12px]">
        {diffs.length === 0 ? (
          <span className="font-mono text-text-muted">No changes.</span>
        ) : (
          diffs.map((d) => (
            <div key={d.label} className="flex items-center gap-2 font-mono">
              <span className="w-16 text-text-muted">{d.label}</span>
              <span className="text-text-secondary">{d.from}</span>
              <ChevronRight size={11} className="text-text-muted" />
              <span className="font-semibold text-text-primary">{d.to}</span>
            </div>
          ))
        )}
      </div>

      {impact.length > 0 && (
        <div className="space-y-1">
          <p className="label-caps !text-[9px]">Impact on existing approvals</p>
          <ul className="space-y-0.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 font-mono text-[11px]">
            {impact.map(({ approval, before, after }) => {
              const flipped = before !== after;
              return (
                <li
                  key={approval.id}
                  className={cn(
                    'flex items-center gap-2',
                    flipped && 'text-[var(--color-warning)]',
                  )}
                >
                  <span className="w-20">{approval.strategyCode}</span>
                  <span className="text-text-muted">{before}</span>
                  <ChevronRight size={10} className="text-text-muted" />
                  <span className={flipped ? 'font-semibold' : ''}>{after}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="label-caps !text-[9px]">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 font-mono text-[12px]"
      />
    </div>
  );
}

function parseForm(f: FormState):
  | { minCagrPct: number; minInitialCapitalUsd: number; minWindowDays: number; minTrades: number }
  | null {
  const cagr = Number(f.minCagrPct);
  const cap = Number(f.minInitialCapitalUsd);
  const win = Number(f.minWindowDays);
  const tr = Number(f.minTrades);
  if (!Number.isFinite(cagr) || cagr < 0) return null;
  if (!Number.isFinite(cap) || cap <= 0) return null;
  if (!Number.isFinite(win) || win <= 0) return null;
  if (!Number.isFinite(tr) || tr <= 0) return null;
  return {
    minCagrPct: cagr,
    minInitialCapitalUsd: cap,
    minWindowDays: Math.round(win),
    minTrades: Math.round(tr),
  };
}

type ApprovalClassification = 'approved' | 'grandfathered' | 'stale';

function classify(
  a: SymbolApproval,
  t: Pick<SymbolApprovalThreshold, 'minCagrPct' | 'minInitialCapitalUsd' | 'minWindowDays' | 'minTrades'>,
): ApprovalClassification {
  if (a.backtestRunId == null) return 'grandfathered';
  const cagrFail =
    a.evidenceCagrPct != null && a.evidenceCagrPct < t.minCagrPct;
  const capFail =
    a.evidenceCapitalUsd != null && a.evidenceCapitalUsd < t.minInitialCapitalUsd;
  const winFail =
    a.evidenceWindowDays != null && a.evidenceWindowDays < t.minWindowDays;
  const trFail =
    a.evidenceTrades != null && a.evidenceTrades < t.minTrades;
  return cagrFail || capFail || winFail || trFail ? 'stale' : 'approved';
}
