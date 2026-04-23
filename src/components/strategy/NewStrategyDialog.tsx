'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INTERVALS } from '@/lib/constants';
import { normalizeError } from '@/lib/api/client';
import { useCreateStrategy } from '@/hooks/useStrategies';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { toast } from '@/hooks/useToast';
import type { AccountSummary } from '@/types/account';

interface NewStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountSummary[];
  defaultAccountId?: string;
}

interface FormState {
  accountId: string;
  strategyCode: string;
  presetName: string;
  symbol: string;
  intervalName: string;
  allowLong: boolean;
  allowShort: boolean;
  maxOpenPositions: string;
  capitalAllocationPct: string;
  priorityOrder: string;
  enabled: boolean;
}

function initialState(defaultAccountId?: string): FormState {
  return {
    accountId: defaultAccountId ?? '',
    // Left blank — the effect below fills it from the live strategy-definitions
    // catalogue once loaded, so we never ship a hard-coded "LSR_V2" that could
    // be stale / deprecated / absent on a given instance.
    strategyCode: '',
    presetName: '',
    symbol: 'BTCUSDT',
    intervalName: '1h',
    allowLong: true,
    allowShort: false,
    maxOpenPositions: '1',
    capitalAllocationPct: '25',
    priorityOrder: '1',
    enabled: false,
  };
}

export function NewStrategyDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
}: NewStrategyDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(defaultAccountId));
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateStrategy();
  const {
    data: strategyDefinitions = [],
    isLoading: isDefinitionsLoading,
  } = useStrategyDefinitions();

  useEffect(() => {
    if (open) {
      setForm(initialState(defaultAccountId));
      setError(null);
    }
  }, [open, defaultAccountId]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);

  /** Only ACTIVE strategy definitions qualify as choices — DEPRECATED / INACTIVE
   *  rows stay selectable in detail pages for historical attribution, but a
   *  fresh strategy should never be created against them. */
  const activeDefinitions = useMemo(
    () =>
      strategyDefinitions
        .filter((d) => d.status === 'ACTIVE')
        .sort((a, b) => a.strategyCode.localeCompare(b.strategyCode)),
    [strategyDefinitions],
  );

  // Auto-select the first ACTIVE strategy when the dialog opens and definitions
  // finish loading. If the user has already picked something, respect their
  // choice. If the previously-picked code has since been deprecated, fall back
  // to the first ACTIVE to avoid submitting a dead code.
  useEffect(() => {
    if (!open) return;
    if (activeDefinitions.length === 0) return;
    const codeStillValid = activeDefinitions.some((d) => d.strategyCode === form.strategyCode);
    if (!form.strategyCode || !codeStillValid) {
      setForm((s) => ({ ...s, strategyCode: activeDefinitions[0].strategyCode }));
    }
  }, [open, activeDefinitions, form.strategyCode]);

  const canSubmit =
    Boolean(form.accountId) &&
    Boolean(form.strategyCode) &&
    form.symbol.trim().length >= 3 &&
    Boolean(form.intervalName) &&
    Number(form.maxOpenPositions) >= 1 &&
    Number(form.capitalAllocationPct) > 0 &&
    Number(form.capitalAllocationPct) <= 100 &&
    Number(form.priorityOrder) >= 0 &&
    (form.allowLong || form.allowShort) &&
    !createMutation.isPending;

  const handleSubmit = () => {
    setError(null);
    const trimmedPreset = form.presetName.trim();
    createMutation.mutate(
      {
        accountId: form.accountId,
        strategyCode: form.strategyCode,
        presetName: trimmedPreset.length > 0 ? trimmedPreset : undefined,
        symbol: form.symbol.trim().toUpperCase(),
        intervalName: form.intervalName,
        allowLong: form.allowLong,
        allowShort: form.allowShort,
        maxOpenPositions: Number(form.maxOpenPositions),
        capitalAllocationPct: Number(form.capitalAllocationPct),
        priorityOrder: Number(form.priorityOrder),
        enabled: form.enabled,
      },
      {
        onSuccess: (strategy) => {
          toast.success({
            title: 'Strategy created',
            description: `${strategy.strategyCode} on ${strategy.symbol} ${strategy.interval}`,
          });
          onOpenChange(false);
        },
        onError: (err) => {
          setError(normalizeError(err));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">New Strategy</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Attach a strategy to one of your accounts. Strategies are created disabled by default —
            toggle on when you&apos;re ready to go live.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Account
            </Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => setForm((s) => ({ ...s, accountId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label} · {a.exchange}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Strategy
            </Label>
            <Select
              value={form.strategyCode}
              onValueChange={(v) => setForm((s) => ({ ...s, strategyCode: v }))}
              disabled={isDefinitionsLoading || activeDefinitions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isDefinitionsLoading
                      ? 'Loading strategies…'
                      : activeDefinitions.length === 0
                        ? 'No active strategies'
                        : 'Select a strategy'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {activeDefinitions.map((def) => (
                  <SelectItem key={def.id || def.strategyCode} value={def.strategyCode}>
                    <span className="flex flex-col">
                      <span className="font-mono text-xs">{def.strategyCode}</span>
                      {def.strategyName && def.strategyName !== def.strategyCode && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {def.strategyName}
                          {def.strategyType ? ` · ${def.strategyType}` : ''}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isDefinitionsLoading && activeDefinitions.length === 0 && (
              <p className="text-[10px] text-[var(--color-warning)]">
                No ACTIVE strategy definitions exist. Ask an admin to register one via
                the strategy catalogue before creating a preset.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Interval
            </Label>
            <Select
              value={form.intervalName}
              onValueChange={(v) => setForm((s) => ({ ...s, intervalName: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Symbol
            </Label>
            <Input
              value={form.symbol}
              onChange={(e) => setForm((s) => ({ ...s, symbol: e.target.value }))}
              className="font-mono"
              placeholder="BTCUSDT"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Preset name <span className="normal-case text-[var(--text-muted)]">(optional)</span>
            </Label>
            <Input
              value={form.presetName}
              onChange={(e) => setForm((s) => ({ ...s, presetName: e.target.value }))}
              maxLength={80}
              placeholder="e.g. Aggressive · Conservative · V2-tuned"
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              Multiple presets can share the same strategy + symbol + interval. Only one is
              active at a time. Leave blank to auto-name.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Capital allocation (%)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max="100"
              value={form.capitalAllocationPct}
              onChange={(e) => setForm((s) => ({ ...s, capitalAllocationPct: e.target.value }))}
              className="font-mono tabular-nums"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Max open positions
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={form.maxOpenPositions}
              onChange={(e) => setForm((s) => ({ ...s, maxOpenPositions: e.target.value }))}
              className="font-mono tabular-nums"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Priority order
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={form.priorityOrder}
              onChange={(e) => setForm((s) => ({ ...s, priorityOrder: e.target.value }))}
              className="font-mono tabular-nums"
            />
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.allowLong}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, allowLong: v }))}
                />
                <Label className="font-mono text-xs uppercase tracking-wider">Allow Long</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.allowShort}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, allowShort: v }))}
                />
                <Label className="font-mono text-xs uppercase tracking-wider">Allow Short</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((s) => ({ ...s, enabled: v }))}
              />
              <Label className="font-mono text-xs uppercase tracking-wider">Enable on create</Label>
            </div>
          </div>

          {!form.allowLong && !form.allowShort && (
            <p className="col-span-2 text-xs text-[var(--color-warning)]">
              At least one direction (long or short) must be enabled.
            </p>
          )}

          {error && (
            <p className="col-span-2 rounded border border-[rgba(255,77,106,0.3)] bg-[rgba(255,77,106,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create strategy'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
