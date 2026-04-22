'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateStrategyDefinition,
  useUpdateStrategyDefinition,
} from '@/hooks/useStrategyDefinitions';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { StrategyDefinition } from '@/types/strategyDefinition';

interface StrategyDefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, the dialog is in edit mode — otherwise it's a create form. */
  existing?: StrategyDefinition | null;
}

interface FormState {
  strategyCode: string;
  strategyName: string;
  strategyType: string;
  description: string;
  status: string;
}

const EMPTY_STATE: FormState = {
  strategyCode: '',
  strategyName: '',
  strategyType: 'TREND',
  description: '',
  status: 'ACTIVE',
};

const STRATEGY_TYPE_OPTIONS = [
  'TREND',
  'MEAN_REVERSION',
  'BREAKOUT',
  'MOMENTUM',
  'ARBITRAGE',
  'MARKET_MAKING',
  'OTHER',
];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'DEPRECATED'];

// Mirrors the backend's @Pattern — surfaces the rule early instead of
// waiting for a 400 to reveal it.
const CODE_PATTERN = /^[A-Z0-9_]+$/;

export function StrategyDefinitionDialog({
  open,
  onOpenChange,
  existing,
}: StrategyDefinitionDialogProps) {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateStrategyDefinition();
  const updateMutation = useUpdateStrategyDefinition();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Reset whenever the dialog opens. In edit mode we hydrate from the row
  // the admin clicked; in create mode we start from empty.
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    if (existing) {
      setForm({
        strategyCode: existing.strategyCode,
        strategyName: existing.strategyName,
        strategyType: existing.strategyType || 'TREND',
        description: existing.description ?? '',
        status: existing.status,
      });
    } else {
      setForm(EMPTY_STATE);
    }
  }, [open, existing]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    const code = form.strategyCode.trim();
    if (!isEdit) {
      if (code.length < 2) e.strategyCode = 'At least 2 characters.';
      else if (code.length > 100) e.strategyCode = 'Max 100 characters.';
      else if (!CODE_PATTERN.test(code)) e.strategyCode = 'UPPER_SNAKE_CASE only (A–Z, 0–9, _).';
    }
    if (form.strategyName.trim().length < 2) e.strategyName = 'At least 2 characters.';
    if (form.strategyType.trim().length === 0) e.strategyType = 'Pick a type.';
    if (form.description.length > 4000) e.description = 'Max 4000 characters.';
    return e;
  }, [form, isEdit]);

  const canSubmit = Object.keys(errors).length === 0 && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(null);

    if (isEdit && existing) {
      updateMutation.mutate(
        {
          id: existing.id,
          payload: {
            strategyName: form.strategyName.trim(),
            strategyType: form.strategyType.trim(),
            description: form.description.trim() || undefined,
            status: form.status as never,
          },
        },
        {
          onSuccess: (updated) => {
            toast.success({
              title: 'Strategy updated',
              description: `${updated.strategyCode} · ${updated.status}`,
            });
            onOpenChange(false);
          },
          onError: (err) => setSubmitError(normalizeError(err)),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        strategyCode: form.strategyCode.trim(),
        strategyName: form.strategyName.trim(),
        strategyType: form.strategyType.trim(),
        description: form.description.trim() || undefined,
        status: form.status as never,
      },
      {
        onSuccess: (created) => {
          toast.success({
            title: 'Strategy registered',
            description: `${created.strategyCode} — ${created.strategyName}`,
          });
          onOpenChange(false);
        },
        onError: (err) => setSubmitError(normalizeError(err)),
      },
    );
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-sm"
              style={{
                background: 'var(--accent-glow)',
                color: 'var(--accent-primary)',
              }}
            >
              {isEdit ? <ShieldCheck size={14} /> : <Sparkles size={14} />}
            </span>
            <DialogTitle className="font-display text-lg">
              {isEdit ? 'Edit strategy definition' : 'Register a new strategy'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)]">
            {isEdit
              ? 'Update display metadata or status. The strategy code is immutable — downstream tables key on it.'
              : 'Add a new entry to the strategy catalogue. Codes are immutable once created, so choose carefully.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <FieldRow
            label="Strategy code"
            error={errors.strategyCode}
            hint={
              isEdit
                ? 'Immutable — deprecate and create a new row if you need to rename.'
                : 'UPPER_SNAKE_CASE. Used as the foreign-key string across the system.'
            }
            className="col-span-2"
          >
            <Input
              value={form.strategyCode}
              onChange={(e) => setField('strategyCode', e.target.value.toUpperCase())}
              placeholder="LSR_V3"
              className="font-mono"
              autoComplete="off"
              maxLength={100}
              disabled={isEdit}
              aria-invalid={Boolean(errors.strategyCode)}
            />
          </FieldRow>

          <FieldRow label="Display name" error={errors.strategyName} className="col-span-2">
            <Input
              value={form.strategyName}
              onChange={(e) => setField('strategyName', e.target.value)}
              placeholder="Long/Short Regime v3"
              maxLength={200}
              aria-invalid={Boolean(errors.strategyName)}
            />
          </FieldRow>

          <FieldRow label="Type" error={errors.strategyType}>
            <Select value={form.strategyType} onValueChange={(v) => setField('strategyType', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Status">
            <Select value={form.status} onValueChange={(v) => setField('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow
            label="Description"
            error={errors.description}
            hint="Short plain-text blurb. Appears on the strategy picker tooltip."
            className="col-span-2"
          >
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={4}
              maxLength={4000}
              className={cn(
                'w-full resize-y rounded-sm border border-bd-subtle bg-bg-base p-2 font-mono text-[12px] text-text-primary',
                'focus:border-bd focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
              )}
              placeholder="Long breakouts on sustained ADX > 25 with ATR-scaled stops…"
            />
          </FieldRow>

          {submitError && (
            <p
              role="alert"
              className="col-span-2 flex items-start gap-2 rounded-sm border px-3 py-2 text-xs"
              style={{
                borderColor: 'rgba(255,77,106,0.4)',
                backgroundColor: 'rgba(255,77,106,0.08)',
                color: 'var(--color-loss)',
              }}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isEdit ? 'Saving' : 'Registering'}
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Register strategy'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldRow({ label, error, hint, className, children }: FieldRowProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] text-[var(--color-loss)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
