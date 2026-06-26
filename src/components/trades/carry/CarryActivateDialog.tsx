'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import {
  useCarryConfig,
  useExecuteCarryDeploy,
  useOpenableCarry,
  usePlanCarryDeploy,
  useSaveCarryConfig,
} from '@/hooks/useCarryPairs';
import type { CarryAllocationMode, CarryConfig, CarryDeployPlan } from '@/types/trading';

interface RiskTier {
  key: string;
  label: string;
  leverage: number;
}

const ALL_TIERS: RiskTier[] = [
  { key: 'conservative', label: 'Conservative', leverage: 1 },
  { key: 'balanced', label: 'Balanced', leverage: 2 },
  { key: 'aggressive', label: 'Aggressive', leverage: 3 },
];

/**
 * Activate the carry book for an account: set how much capital to commit (a % of balance or a USD
 * cap) and at what default leverage, save, then preview + deploy pairs to fill the allocation.
 * Sim-first; a real deploy requires the saved config to be Real AND an explicit acknowledgement.
 * Config is per-account — this resolves the active account (or the first TRADING / first account).
 */
export function CarryActivateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { activeAccount, accountsByType, accounts } = useActiveAccount();
  const account = activeAccount ?? accountsByType.TRADING[0] ?? accounts[0] ?? null;

  const { data: config, isLoading } = useCarryConfig(account?.id);
  const { data: roster } = useOpenableCarry();
  const cap = roster?.maxLeverage ?? 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Activate carry book</DialogTitle>
          <DialogDescription>
            Set how much capital the carry book commits and at what leverage, then deploy pairs to
            fill it. Sim-first — a real deploy is gated behind an explicit confirmation.
          </DialogDescription>
        </DialogHeader>
        {!account ? (
          <p className="text-[13px] text-text-muted">No account available to configure.</p>
        ) : isLoading || !config ? (
          <p className="text-[13px] text-text-muted">Loading config…</p>
        ) : (
          <ActivateForm
            accountId={account.id}
            accountLabel={account.label}
            cap={cap}
            config={config}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivateForm({
  accountId,
  accountLabel,
  cap,
  config,
  onClose,
}: {
  accountId: string;
  accountLabel: string;
  cap: number;
  config: CarryConfig;
  onClose: () => void;
}) {
  const formatCurrency = useCurrencyFormatter();
  const tiers = useMemo(() => ALL_TIERS.filter((t) => t.leverage <= cap), [cap]);

  const [enabled, setEnabled] = useState(config.enabled);
  const [mode, setMode] = useState<CarryAllocationMode>(config.allocationMode);
  const [pctInput, setPctInput] = useState(
    config.allocationPct != null ? String(config.allocationPct * 100) : '',
  );
  const [usdInput, setUsdInput] = useState(
    config.allocationUsd != null ? String(config.allocationUsd) : '',
  );
  const [leverage, setLeverage] = useState<number>(config.defaultLeverage || 1);
  const [maxPairs, setMaxPairs] = useState(String(config.maxPairs ?? 5));
  const [paper, setPaper] = useState(config.simulated);
  const [confirmReal, setConfirmReal] = useState(false);

  const saveMutation = useSaveCarryConfig();
  const planMutation = usePlanCarryDeploy();
  const executeMutation = useExecuteCarryDeploy();

  const pctNum = Number(pctInput);
  const usdNum = Number(usdInput);
  const maxPairsNum = Number(maxPairs);
  const allocationValid =
    mode === 'PCT'
      ? Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100
      : Number.isFinite(usdNum) && usdNum > 0;
  const settingsValid =
    (!enabled || allocationValid) && Number.isFinite(maxPairsNum) && maxPairsNum >= 1;

  const save = () => {
    saveMutation.mutate({
      accountId,
      req: {
        enabled,
        allocationMode: mode,
        allocationPct: mode === 'PCT' ? pctNum / 100 : null,
        allocationUsd: mode === 'USD' ? usdNum : null,
        defaultLeverage: leverage,
        maxPairs: Math.trunc(maxPairsNum),
        simulated: paper,
      },
    });
  };

  // Deploy executes the SAVED config server-side, so it's only safe once the form matches what's
  // persisted. Gate on a clean save (dirty) so the buttons can never act on stale/unsaved settings
  // (e.g. a Paper→Real switch that hasn't landed yet), and gate a REAL deploy on a fresh, explicit
  // acknowledgement keyed off the form's current intent.
  const savedPctStr = config.allocationPct != null ? String(config.allocationPct * 100) : '';
  const savedUsdStr = config.allocationUsd != null ? String(config.allocationUsd) : '';
  const dirty =
    enabled !== config.enabled ||
    mode !== config.allocationMode ||
    paper !== config.simulated ||
    leverage !== config.defaultLeverage ||
    (Number.isFinite(maxPairsNum) ? Math.trunc(maxPairsNum) : null) !== config.maxPairs ||
    (mode === 'PCT' ? pctInput !== savedPctStr : usdInput !== savedUsdStr);
  const realIntent = !paper;
  const deployBlocked = dirty || saveMutation.isPending || (realIntent && !confirmReal);
  const plan = planMutation.data;
  const result = executeMutation.data;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-text-muted">
        Account: <span className="text-text-secondary">{accountLabel}</span>
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-primary">Carry book enabled</span>
        <ModePill
          active={enabled}
          label={enabled ? 'On' : 'Off'}
          onClick={() => setEnabled(!enabled)}
        />
      </div>

      <Field label="Allocation">
        <div className="flex gap-1.5">
          <ModePill active={mode === 'PCT'} label="% of balance" onClick={() => setMode('PCT')} />
          <ModePill active={mode === 'USD'} label="USD amount" onClick={() => setMode('USD')} />
        </div>
        {mode === 'PCT' ? (
          <NumInput value={pctInput} onChange={setPctInput} placeholder="e.g. 30" suffix="%" />
        ) : (
          <NumInput value={usdInput} onChange={setUsdInput} placeholder="e.g. 200" suffix="USDT" />
        )}
      </Field>

      <Field label={`Default leverage (capped at ${cap}×)`}>
        <div className="flex flex-wrap gap-1.5">
          {tiers.map((t) => (
            <ModePill
              key={t.key}
              active={leverage === t.leverage}
              label={`${t.label} ${t.leverage}×`}
              onClick={() => setLeverage(t.leverage)}
            />
          ))}
        </div>
      </Field>

      <Field label="Max pairs">
        <NumInput value={maxPairs} onChange={setMaxPairs} placeholder="5" />
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
            onClick={() => {
              setPaper(false);
              setConfirmReal(false);
            }}
          />
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2">
        {saveMutation.isError ? (
          <span className="text-[12px]" style={{ color: 'var(--color-loss)' }}>
            Save failed — check the allocation value.
          </span>
        ) : null}
        {saveMutation.isSuccess ? (
          <span className="text-[12px]" style={{ color: 'var(--color-profit)' }}>
            Saved.
          </span>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={!settingsValid || saveMutation.isPending}
          className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent-primary)' }}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="h-px w-full" style={{ background: 'var(--border-default)' }} />

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
          Deploy — uses saved settings ({config.simulated ? 'Paper' : 'Real'})
        </span>
        {dirty ? (
          <p className="text-[12px]" style={{ color: 'var(--color-warning)' }}>
            Unsaved changes — Save settings to preview or deploy.
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => planMutation.mutate(accountId)}
            disabled={dirty || planMutation.isPending}
            className="h-9 rounded-md border border-[var(--border-default)] px-4 text-sm text-text-secondary disabled:opacity-50"
          >
            {planMutation.isPending ? 'Planning…' : 'Preview deploy'}
          </button>
          <button
            type="button"
            onClick={() => executeMutation.mutate(accountId)}
            disabled={deployBlocked || executeMutation.isPending}
            className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: paper ? 'var(--accent-primary)' : 'var(--color-loss)' }}
          >
            {executeMutation.isPending ? 'Deploying…' : paper ? 'Deploy (paper)' : 'Deploy (real)'}
          </button>
        </div>

        {realIntent ? (
          <label
            htmlFor="carry-deploy-confirm"
            className="flex items-center gap-2 text-[12px] text-text-primary"
          >
            <input
              id="carry-deploy-confirm"
              type="checkbox"
              checked={confirmReal}
              onChange={(e) => setConfirmReal(e.target.checked)}
            />
            I understand Deploy will open REAL positions to fill the allocation.
          </label>
        ) : null}

        {plan ? <PlanPreview plan={plan} formatCurrency={formatCurrency} /> : null}
        {result ? (
          <p className="text-[12px] text-text-secondary">
            Deployed: {result.opened} opened, {result.failed} failed of {result.requested}.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-md border border-[var(--border-default)] px-4 text-sm text-text-secondary"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PlanPreview({
  plan,
  formatCurrency,
}: {
  plan: CarryDeployPlan;
  formatCurrency: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[var(--border-default)] p-3">
      <p className="text-[12px] text-text-secondary">
        Budget {formatCurrency(plan.budgetUsd)} · {plan.items.length} pair(s) ·{' '}
        {formatCurrency(plan.perPairUsd)}/pair
      </p>
      {plan.items.map((i) => (
        <p key={i.symbol} className="font-mono text-[12px] tabular-nums text-text-primary">
          {i.symbol} · {i.targetBaseQty} @ {i.leverage}× · ≈{formatCurrency(i.estNotionalUsd)}
        </p>
      ))}
      {plan.items.length === 0 ? (
        <p className="text-[12px] text-text-muted">Nothing deployable with the current settings.</p>
      ) : null}
      {plan.notes.map((n) => (
        <p key={n} className="text-[11px] text-text-muted">
          • {n}
        </p>
      ))}
    </div>
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

function NumInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-[var(--border-default)] bg-transparent px-3 font-mono text-sm tabular-nums text-text-primary outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
      />
      {suffix ? <span className="text-[12px] text-text-muted">{suffix}</span> : null}
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
