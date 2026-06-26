'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOpenCarryPair, useOpenableCarry } from '@/hooks/useCarryPairs';
import type { CarryOpenableStrategy } from '@/types/trading';

interface RiskTier {
  key: string;
  label: string;
  leverage: number;
  blurb: string;
}

/** Tiers are filtered to ≤ the server cap, so the UI can never offer more than the backend accepts. */
const ALL_TIERS: RiskTier[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    leverage: 1,
    blurb: 'Fully collateralised — the perp short is 1:1 backed. Lowest liquidation risk.',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    leverage: 2,
    blurb: '~2× funding yield on equity. Moderate basis / liquidation risk.',
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    leverage: 3,
    blurb:
      'Highest funding yield on equity — but a basis blow-up moves toward liquidation fastest.',
  },
];

/**
 * Open a delta-neutral carry pair with a user-chosen risk tier. SIM-FIRST: the mode
 * defaults to Paper; a real open requires switching to "Real capital" AND ticking the
 * acknowledgement. The leverage tiers are bounded by the server cap from the roster, and
 * the backend re-clamps + can still return FAILED (e.g. non-positive funding) — surfaced here.
 */
export function CarryOpenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: roster, isLoading } = useOpenableCarry();
  const openMutation = useOpenCarryPair();

  const cap = roster?.maxLeverage ?? 3;
  const tiers = useMemo(() => ALL_TIERS.filter((t) => t.leverage <= cap), [cap]);
  const strategies = roster?.strategies ?? [];

  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('');
  const [tierKey, setTierKey] = useState('conservative');
  const [paper, setPaper] = useState(true);
  const [confirmReal, setConfirmReal] = useState(false);

  const selected: CarryOpenableStrategy | undefined = strategies.find((s) => s.symbol === symbol);
  const tier = tiers.find((t) => t.key === tierKey) ?? tiers[0];
  const qtyNum = Number(qty);
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
  const realBlocked = !paper && !confirmReal;
  const failed = openMutation.data?.status === 'FAILED';

  const canSubmit =
    Boolean(selected) &&
    !selected?.hasOpenPair &&
    qtyValid &&
    Boolean(tier) &&
    !realBlocked &&
    !openMutation.isPending;

  const resetForm = () => {
    setSymbol('');
    setQty('');
    setTierKey('conservative');
    setPaper(true);
    setConfirmReal(false);
    openMutation.reset();
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) resetForm();
  };

  const submit = () => {
    if (!selected || !tier || !qtyValid) return;
    openMutation.mutate(
      {
        accountStrategyId: selected.accountStrategyId,
        symbol: selected.symbol,
        targetBaseQty: qtyNum,
        leverage: tier.leverage,
        simulated: paper,
      },
      {
        onSuccess: (res) => {
          // The backend can return 200 + FAILED (non-positive funding / leg issue); only a true
          // OPEN closes the dialog. A FAILED result keeps it open and renders the notice below.
          if (res.status === 'OPEN') handleOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open carry pair</DialogTitle>
          <DialogDescription>
            Opens a delta-neutral pair (long spot + short perp). Choose your leverage tier — higher
            leverage lifts funding yield on equity but raises basis / liquidation risk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label="Symbol">
            <Select value={symbol} onValueChange={setSymbol} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Loading…' : 'Select a carry symbol'} />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol} disabled={s.hasOpenPair}>
                    {s.symbol}
                    {s.hasOpenPair ? ' · already open' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {strategies.length === 0 && !isLoading ? (
              <p className="text-[12px] text-text-muted">
                No FCARRY strategies are seeded for your account.
              </p>
            ) : null}
          </Field>

          <Field label="Target quantity (base units)">
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 0.97"
              className="h-9 w-full rounded-md border border-[var(--border-default)] bg-transparent px-3 font-mono text-sm tabular-nums text-text-primary outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
            />
            <p className="text-[12px] text-text-muted">
              Both legs trade this many base units (floored to the futures step).
            </p>
          </Field>

          <Field label={`Leverage tier (capped at ${cap}× by the server)`}>
            <div className="flex flex-col gap-2">
              {tiers.map((t) => {
                const active = tier?.key === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTierKey(t.key)}
                    aria-pressed={active}
                    className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                      background: active ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-text-primary">{t.label}</span>
                      <span className="font-mono text-[13px] tabular-nums text-text-secondary">
                        {t.leverage}×
                      </span>
                    </span>
                    <span className="text-[12px] text-text-muted">{t.blurb}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Mode">
            <div className="flex gap-1.5">
              <ModePill
                active={paper}
                label="Paper (sim)"
                onClick={() => {
                  setPaper(true);
                  setConfirmReal(false);
                }}
              />
              <ModePill
                active={!paper}
                label="Real capital"
                tone="danger"
                onClick={() => setPaper(false)}
              />
            </div>
          </Field>

          {!paper ? (
            <div
              className="flex flex-col gap-2 rounded-md border p-3"
              style={{ borderColor: 'var(--color-warning)', background: 'var(--tint-warning)' }}
            >
              <p className="text-[12px] text-text-primary">
                This places <strong>real orders</strong>. Carry is delta-neutral but not risk-free:
                basis can drift, the perp leg can be liquidated under stress, and only
                positive-funding symbols pay. {tier?.leverage ?? 1}× leverage amplifies that risk.
              </p>
              <label
                htmlFor="carry-confirm-real"
                className="flex items-center gap-2 text-[12px] text-text-primary"
              >
                <input
                  id="carry-confirm-real"
                  type="checkbox"
                  checked={confirmReal}
                  onChange={(e) => setConfirmReal(e.target.checked)}
                />
                I understand and want to open a real position.
              </label>
            </div>
          ) : null}

          {failed ? (
            <p className="text-[12px]" style={{ color: 'var(--color-loss)' }}>
              Open returned FAILED — usually non-positive funding or a leg / margin issue. Check the
              symbol&apos;s funding and your futures balance, then retry.
            </p>
          ) : null}
          {openMutation.isError ? (
            <p className="text-[12px]" style={{ color: 'var(--color-loss)' }}>
              Open request failed. Check your connection / inputs and retry.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="h-9 rounded-md border border-[var(--border-default)] px-4 text-sm text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: paper ? 'var(--accent-primary)' : 'var(--color-loss)' }}
            >
              {openMutation.isPending ? 'Opening…' : paper ? 'Open paper pair' : 'Open real pair'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
    </div>
  );
}

function ModePill({
  active,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-md border px-3 py-1.5 text-[13px] font-medium"
      style={{
        borderColor: active
          ? tone === 'danger'
            ? 'var(--color-loss)'
            : 'var(--accent-primary)'
          : 'var(--border-default)',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-elevated)' : 'transparent',
      }}
    >
      {label}
    </button>
  );
}
