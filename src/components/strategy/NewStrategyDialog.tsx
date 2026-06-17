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
import { Combobox } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALLOC_MAX_PCT, INTERVALS, strategyControlsRiskSizing } from '@/lib/constants';
import {
  SUPPORTED_SYMBOLS,
  DEFAULT_SYMBOL,
  hasSupportedStrategies,
  isStrategySupportedForSymbol,
} from '@/lib/symbols';
import { normalizeError } from '@/lib/api/client';
import { useCreateStrategy } from '@/hooks/useStrategies';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { useCompatibleStrategies } from '@/hooks/useCompatibleStrategies';
import { useSymbolApprovals } from '@/hooks/useSymbolApprovals';
import { useIsAdmin } from '@/hooks/useIsAdmin';
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
  /** V55 — risk-based sizing toggle. Defaults ON so new presets adopt the
   *  unified risk model; user can flip OFF to keep direct allocation sizing. */
  useRiskBasedSizing: boolean;
  /** V55 — per-trade risk as a percentage (UI scale: 0.01..20). Sent to the
   *  backend divided by 100 so the wire value is a fraction. */
  riskPct: string;
  /** V168 — opt-in min-notional floor. When true, a sub-minimum entry order is
   *  floored up to the exchange minimum (if affordable) instead of skipped. */
  minNotionalFloorEnabled: boolean;
}

function initialState(defaultAccountId?: string): FormState {
  return {
    accountId: defaultAccountId ?? '',

    strategyCode: '',
    presetName: '',
    symbol: DEFAULT_SYMBOL,
    intervalName: '1h',
    allowLong: true,
    allowShort: false,
    maxOpenPositions: '1',
    capitalAllocationPct: '25',
    priorityOrder: '1',
    enabled: false,
    useRiskBasedSizing: true,
    riskPct: '5',
    minNotionalFloorEnabled: false,
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
  const { data: strategyDefinitions = [], isLoading: isDefinitionsLoading } =
    useStrategyDefinitions();
  // Kind-filtered catalogue for the active account (HEDGING accounts only ever
  // see hedging strategies; the backend enforces the same at bind time).
  const { data: compatibleDefinitions } = useCompatibleStrategies();
  const { data: approvals = [], isLoading: isApprovalsLoading } = useSymbolApprovals();
  const isAdmin = useIsAdmin();

  /** A HEDGING account binds spot allocation strategies (BTC/USDT). These are
   *  not symbol-approval-gated — the approval table only covers directional
   *  TRADING strategies — so the picker is sourced from the kind-filtered
   *  catalogue and the per-symbol gate is skipped entirely. TRADING accounts
   *  keep the existing approval-gated behaviour untouched.
   *
   *  This tracks the SELECTED account in the dialog's own dropdown — NOT the
   *  globally-active account context. The dialog can bind a strategy to any
   *  account the operator picks, so the hedging/trading split must follow
   *  `form.accountId`; reading the active account would mis-gate a hedging bind
   *  whenever the hedging account is not the active one (and vice-versa). */
  const isHedging = useMemo(
    () => accounts.find((a) => a.id === form.accountId)?.accountType === 'HEDGING',
    [accounts, form.accountId],
  );

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
      (isHedging ? (compatibleDefinitions ?? []) : strategyDefinitions)
        .filter((d) => d.status === 'ACTIVE')
        .sort((a, b) => a.strategyCode.localeCompare(b.strategyCode)),
    [isHedging, compatibleDefinitions, strategyDefinitions],
  );

  /**
   * Per-symbol validation gate. A strategy is offered for selection only if
   * the {@code (symbol, code)} pair has an active row in
   * `symbol_strategy_approval`. Approvals are read at runtime via
   * {@link useSymbolApprovals}; admins manage them in `/admin/strategies`.
   * When the operator switches symbol mid-flow, the strategy field
   * auto-clears if it falls out of the allowlist.
   */
  // HEDGING bypasses the per-symbol approval gate (spot BTC/USDT strategies are
  // not in the approval table); TRADING keeps the existing gate verbatim.
  const symbolHasStrategies = isHedging || hasSupportedStrategies(form.symbol, approvals);
  const validDefinitions = useMemo(
    () =>
      isHedging
        ? activeDefinitions
        : activeDefinitions.filter((d) =>
            isStrategySupportedForSymbol(d.strategyCode, form.symbol, approvals),
          ),
    [isHedging, activeDefinitions, form.symbol, approvals],
  );

  useEffect(() => {
    if (!open) return;
    if (validDefinitions.length === 0) {
      if (form.strategyCode) setForm((s) => ({ ...s, strategyCode: '' }));
      return;
    }
    const codeStillValid = validDefinitions.some((d) => d.strategyCode === form.strategyCode);
    if (!form.strategyCode || !codeStillValid) {
      setForm((s) => ({ ...s, strategyCode: validDefinitions[0].strategyCode }));
    }
  }, [open, validDefinitions, form.strategyCode]);

  const riskSizingApplies = form.strategyCode
    ? strategyControlsRiskSizing(form.strategyCode)
    : false;

  const riskPctNum = Number(form.riskPct);
  const riskPctValid =
    !riskSizingApplies ||
    !form.useRiskBasedSizing ||
    (Number.isFinite(riskPctNum) && riskPctNum > 0 && riskPctNum <= 20);

  const canSubmit =
    Boolean(form.accountId) &&
    Boolean(form.strategyCode) &&
    form.symbol.trim().length >= 3 &&
    (isHedging || isStrategySupportedForSymbol(form.strategyCode, form.symbol, approvals)) &&
    Boolean(form.intervalName) &&
    Number(form.maxOpenPositions) >= 1 &&
    Number(form.capitalAllocationPct) > 0 &&
    Number(form.capitalAllocationPct) <= ALLOC_MAX_PCT &&
    Number(form.priorityOrder) >= 0 &&
    (form.allowLong || form.allowShort) &&
    riskPctValid &&
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

        useRiskBasedSizing: riskSizingApplies ? form.useRiskBasedSizing : undefined,

        riskPct:
          riskSizingApplies && form.useRiskBasedSizing ? Number(form.riskPct) / 100 : undefined,

        minNotionalFloorEnabled: form.minNotionalFloorEnabled,
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
              Symbol
            </Label>
            <Combobox
              value={form.symbol}
              onChange={(v) => setForm((s) => ({ ...s, symbol: v }))}
              options={SUPPORTED_SYMBOLS as readonly string[]}
              ariaLabel="Symbol"
              searchPlaceholder="Search symbol…"
              fullWidth
              triggerClassName="font-mono"
            />
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

          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Strategy
            </Label>
            <Select
              value={form.strategyCode}
              onValueChange={(v) => setForm((s) => ({ ...s, strategyCode: v }))}
              disabled={
                isDefinitionsLoading ||
                activeDefinitions.length === 0 ||
                validDefinitions.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isDefinitionsLoading
                      ? 'Loading strategies…'
                      : activeDefinitions.length === 0
                        ? 'No active strategies'
                        : validDefinitions.length === 0
                          ? `No strategies validated for ${form.symbol} yet`
                          : 'Select a strategy'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {validDefinitions.map((def) => (
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
            {!isDefinitionsLoading && activeDefinitions.length === 0 ? (
              <p className="text-[10px] text-[var(--color-warning)]">
                No ACTIVE strategy definitions exist. Ask an admin to register one via the strategy
                catalogue before creating a preset.
              </p>
            ) : isApprovalsLoading ? (
              <p className="text-[10px] text-[var(--text-muted)]">Loading approvals…</p>
            ) : !symbolHasStrategies ? (
              <p className="text-[10px] text-[var(--color-warning)]">
                No strategies are validated for {form.symbol} yet. Run a backtest sweep and confirm
                walk-forward gates before this symbol can host a live preset.
                {isAdmin && (
                  <>
                    {' '}
                    <a
                      href={`/admin/strategies?symbol=${form.symbol}#approvals`}
                      className="underline underline-offset-2 hover:text-[var(--text-primary)]"
                    >
                      Manage approvals →
                    </a>
                  </>
                )}
              </p>
            ) : validDefinitions.length === 0 ? (
              <p className="text-[10px] text-[var(--color-warning)]">
                None of the active strategies are validated for {form.symbol}. Validate one via
                /research first, or pick a different symbol.
              </p>
            ) : null}
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
              Multiple presets can share the same strategy + symbol + interval. Only one is active
              at a time. Leave blank to auto-name.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Position size cap (% of cash)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={String(ALLOC_MAX_PCT)}
              value={form.capitalAllocationPct}
              onChange={(e) => setForm((s) => ({ ...s, capitalAllocationPct: e.target.value }))}
              className="font-mono tabular-nums"
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              {!riskSizingApplies
                ? 'Notional cap on trade size (% of cash).'
                : form.useRiskBasedSizing
                  ? 'Maximum position size when risk-based sizing hits the cap.'
                  : 'Direct trade size (no risk-based override).'}
            </p>
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

          {riskSizingApplies ? (
            <div className="col-span-2 flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Label className="font-mono text-xs uppercase tracking-wider">
                    Risk-based sizing
                  </Label>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Sizes both LONG and SHORT entries off Max risk per trade; allocation above
                    becomes the position cap. Off = allocation is the trade size directly (legacy
                    behaviour).
                  </p>
                </div>
                <Switch
                  checked={form.useRiskBasedSizing}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, useRiskBasedSizing: v }))}
                />
              </div>
              {form.useRiskBasedSizing && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    Max risk per trade (%)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0.01"
                    max="20"
                    value={form.riskPct}
                    onChange={(e) => setForm((s) => ({ ...s, riskPct: e.target.value }))}
                    className="font-mono tabular-nums"
                  />
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Loss target if the stop is hit, as a fraction of cash. Applied symmetrically to
                    LONG (USDT notional) and SHORT (BTC qty). Range 0.01–20%. Strategy-specific
                    multipliers (e.g. LSR continuation 0.85×, premium short 0.70×) further shrink
                    the per-trade risk on those setups.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="col-span-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
              <p className="text-[11px] text-[var(--text-secondary)]">
                Sizing for this strategy is controlled by its spec parameters. The Position-size cap
                above still acts as a notional ceiling.
              </p>
            </div>
          )}

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

          <div className="col-span-2 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
            <div className="flex flex-col">
              <Label className="font-mono text-xs uppercase tracking-wider">
                Min-notional floor
              </Label>
              <p className="text-[10px] text-[var(--text-muted)]">
                Sizes a sub-minimum order up to the exchange minimum (if affordable) instead of
                skipping it.
              </p>
            </div>
            <Switch
              checked={form.minNotionalFloorEnabled}
              onCheckedChange={(v) => setForm((s) => ({ ...s, minNotionalFloorEnabled: v }))}
            />
          </div>

          {form.useRiskBasedSizing && !riskPctValid && (
            <p className="col-span-2 text-xs text-[var(--color-warning)]">
              Max risk per trade must be between 0.01% and 20%.
            </p>
          )}

          {!form.allowLong && !form.allowShort && (
            <p className="col-span-2 text-xs text-[var(--color-warning)]">
              At least one direction (long or short) must be enabled.
            </p>
          )}

          {error && (
            <p className="col-span-2 rounded border border-[rgba(229,72,77,0.3)] bg-[rgba(229,72,77,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
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
