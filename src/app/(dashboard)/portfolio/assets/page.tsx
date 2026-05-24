'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Play, RefreshCw, Save, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveAccount } from '@/hooks/useAccounts';
import { usePortfolio } from '@/hooks/usePortfolio';
import {
  useAssetPolicy,
  useAssetTargets,
  useComputeAssetRebalancePlan,
  useUpdateAssetPolicy,
  useUpsertAssetTargets,
} from '@/hooks/useAssetAllocation';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type {
  AssetDriftItem,
  AssetRebalancePlan,
  AssetRebalancePolicy,
  AssetTradeLeg,
} from '@/types/assetAllocation';
import type { PortfolioAsset } from '@/types/portfolio';

/**
 * Asset allocation — Layer-2 portfolio targets and rebalance plan generation.
 *
 * <p>Companion to the existing /portfolio page (current balance view). This page
 * controls TARGET weights per asset and computes drift-driven rebalance plans.
 * Phase 1: read-only execution — the "Generate plan" button proposes trades
 * but does NOT submit them; operator manually executes on Binance until the
 * Phase 4 execute path ships.
 */
export default function AssetAllocationPage() {
  const { scopedAccountId, accounts, isLoading: accountsLoading } = useActiveAccount();
  const accountId = scopedAccountId ?? accounts[0]?.id;

  const portfolio = usePortfolio();
  const targetsQ = useAssetTargets(accountId);
  const policyQ = useAssetPolicy(accountId);

  const upsertTargets = useUpsertAssetTargets();
  const updatePolicy = useUpdateAssetPolicy();
  const computePlan = useComputeAssetRebalancePlan();

  if (accountsLoading || !accountId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        loading={portfolio.isFetching}
        onRefresh={() => portfolio.refetch()}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CurrentMixPanel
          assets={portfolio.data?.assets ?? []}
          totalUsdt={portfolio.data?.totalUsdt ?? 0}
          loading={portfolio.isLoading}
        />
        <TargetsEditor
          accountId={accountId}
          targets={targetsQ.data ?? []}
          heldAssets={
            (portfolio.data?.assets ?? [])
              .filter((a) => a.usdtValue > 0)
              .map((a) => a.asset.toUpperCase())
          }
          loading={targetsQ.isLoading}
          saving={upsertTargets.isPending}
          onSave={async (items) => {
            await upsertTargets.mutateAsync({ accountId, items });
          }}
          saveError={upsertTargets.error?.message ?? null}
        />
      </div>

      <PolicyEditor
        accountId={accountId}
        policy={policyQ.data}
        loading={policyQ.isLoading}
        saving={updatePolicy.isPending}
        onSave={async (patch) => {
          await updatePolicy.mutateAsync({ accountId, ...patch });
        }}
      />

      <PlanSection
        running={computePlan.isPending}
        plan={computePlan.data}
        error={computePlan.error?.message ?? null}
        onGenerate={async (persist) => {
          await computePlan.mutateAsync({ accountId, persist });
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Header({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
          Asset Allocation
        </h1>
        <p className="mt-1 text-[12px] text-text-secondary">
          Layer-2 portfolio targets — what fraction of base inventory sits in each asset.
          Plans are generated on demand; execution is currently manual.
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
        disabled={loading}
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh balance
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Current mix (donut + table)

function CurrentMixPanel({
  assets,
  totalUsdt,
  loading,
}: {
  assets: PortfolioAsset[];
  totalUsdt: number;
  loading: boolean;
}) {
  const formatCurrency = useCurrencyFormatter();

  const rows = useMemo(() => {
    if (totalUsdt <= 0) return [];
    return [...assets]
      .map((a) => ({
        asset: a.asset,
        usdtValue: a.usdtValue,
        pct: (a.usdtValue / totalUsdt) * 100,
      }))
      .sort((a, b) => b.usdtValue - a.usdtValue);
  }, [assets, totalUsdt]);

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <Wallet size={14} className="text-text-muted" />
        <h2 className="font-display text-[14px] font-semibold text-text-primary">Current mix</h2>
        <span className="ml-auto font-mono text-[11px] text-text-muted">
          NAV {formatCurrency(totalUsdt)}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : rows.length === 0 ? (
        <p className="text-[12px] text-text-muted">No holdings.</p>
      ) : (
        <div className="grid grid-cols-[160px_1fr] gap-4">
          <Donut data={rows} />
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {rows.map((r) => (
                <tr key={r.asset} className="border-bd-subtle/60 border-t first:border-t-0">
                  <td className="py-1.5 text-text-primary">{r.asset}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-secondary">
                    {formatCurrency(r.usdtValue)}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-text-primary">
                    {r.pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DONUT_COLORS = [
  'var(--text-secondary)',
  '#6b7280',
  '#9ca3af',
  '#a8b0bd',
  '#c5ccd5',
  '#d8dde3',
];

function Donut({ data }: { data: Array<{ asset: string; pct: number }> }) {
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-default)" strokeWidth={18} />
      {data.map((d, i) => {
        const len = (d.pct / 100) * c;
        const dash = `${len} ${c - len}`;
        const offset = -acc;
        acc += len;
        return (
          <circle
            key={d.asset}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={18}
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Targets editor

interface TargetRow {
  asset: string;
  targetPct: string;
  minBandPp: string;
}

/**
 * Curated common-asset pick list. Expand as needed; the union with the
 * account's currently-held assets is the dropdown's actual option set so any
 * coin you already hold can be targeted even if it's not in this list.
 */
const COMMON_ASSETS = [
  'USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE',
];

function TargetsEditor({
  accountId,
  targets,
  heldAssets,
  loading,
  saving,
  onSave,
  saveError,
}: {
  accountId: string;
  targets: Array<{ asset: string; targetPct: number; minBandPp: number }>;
  heldAssets: string[];
  loading: boolean;
  saving: boolean;
  onSave: (items: Array<{ asset: string; targetPct: number; minBandPp: number }>) => Promise<void>;
  saveError: string | null;
}) {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) {
      setRows(
        targets.length
          ? targets.map((t) => ({
              asset: t.asset,
              targetPct: t.targetPct.toString(),
              minBandPp: t.minBandPp.toString(),
            }))
          : [{ asset: 'USDT', targetPct: '60', minBandPp: '5' }],
      );
    }
  }, [targets, touched]);

  const sum = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.targetPct) || 0), 0),
    [rows],
  );
  const sumOk = Math.abs(sum - 100) < 0.011;

  // Dropdown option set: curated common assets ∪ assets currently held.
  // Sorted with USDT first (most-likely target), then alphabetical.
  const allAssetOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of COMMON_ASSETS) set.add(a);
    for (const a of heldAssets) set.add(a.toUpperCase());
    return Array.from(set).sort((a, b) => {
      if (a === 'USDT') return -1;
      if (b === 'USDT') return 1;
      return a.localeCompare(b);
    });
  }, [heldAssets]);

  const update = (i: number, patch: Partial<TargetRow>) => {
    setTouched(true);
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setTouched(true);
    setRows((rs) => {
      const taken = new Set(rs.map((r) => r.asset).filter(Boolean));
      const firstFree = allAssetOptions.find((a) => !taken.has(a)) ?? '';
      return [...rs, { asset: firstFree, targetPct: '0', minBandPp: '5' }];
    });
  };

  const removeRow = (i: number) => {
    setTouched(true);
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!sumOk) return;
    const items = rows
      .filter((r) => r.asset.trim().length > 0)
      .map((r) => ({
        asset: r.asset.trim().toUpperCase(),
        targetPct: parseFloat(r.targetPct) || 0,
        minBandPp: parseFloat(r.minBandPp) || 5,
      }));
    await onSave(items);
    setTouched(false);
  };

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[14px] font-semibold text-text-primary">Targets</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">account {accountId.slice(0, 8)}</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: sumOk ? 'var(--tint-profit)' : 'var(--tint-loss)',
            color: sumOk ? 'var(--color-profit)' : 'var(--color-loss)',
          }}
        >
          Sum {sum.toFixed(2)}% {sumOk ? '✓' : '✗'}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_90px_90px_30px] gap-2 px-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">
              <span>Asset</span>
              <span className="text-right">Target %</span>
              <span className="text-right">Band pp</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const takenElsewhere = new Set(
                rows.filter((_, idx) => idx !== i).map((x) => x.asset).filter(Boolean),
              );
              return (
              <div key={i} className="grid grid-cols-[1fr_90px_90px_30px] items-center gap-2">
                <select
                  className="rounded border border-bd-subtle bg-bg-base px-2 py-1 text-[12px] uppercase text-text-primary focus:border-bd-focus focus:outline-none"
                  value={r.asset}
                  onChange={(e) => update(i, { asset: e.target.value })}
                >
                  {!r.asset && <option value="" disabled>Select asset</option>}
                  {/* If the current row's value isn't in the curated/held set (legacy row),
                      keep it selectable so we don't silently drop it on first edit. */}
                  {r.asset && !allAssetOptions.includes(r.asset) && (
                    <option value={r.asset}>{r.asset}</option>
                  )}
                  {allAssetOptions.map((a) => (
                    <option key={a} value={a} disabled={takenElsewhere.has(a)}>
                      {a}
                      {takenElsewhere.has(a) ? ' (used)' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="rounded border border-bd-subtle bg-bg-base px-2 py-1 text-right font-mono text-[12px] tabular-nums text-text-primary focus:border-bd-focus focus:outline-none"
                  value={r.targetPct}
                  onChange={(e) => update(i, { targetPct: e.target.value })}
                  step="0.1"
                  min="0"
                  max="100"
                />
                <input
                  type="number"
                  className="rounded border border-bd-subtle bg-bg-base px-2 py-1 text-right font-mono text-[12px] tabular-nums text-text-primary focus:border-bd-focus focus:outline-none"
                  value={r.minBandPp}
                  onChange={(e) => update(i, { minBandPp: e.target.value })}
                  step="0.5"
                  min="0.0001"
                  max="50"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Remove row"
                >
                  ×
                </button>
              </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 text-[11px] text-text-primary hover:bg-bg-hover"
            >
              + Add asset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!sumOk || saving || !touched}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: sumOk ? 'var(--color-profit)' : 'var(--bg-elevated)',
                color: sumOk ? 'var(--text-inverse)' : 'var(--text-muted)',
              }}
            >
              <Save size={12} /> Save targets
            </button>
          </div>
          {saveError && (
            <p className="mt-2 text-[11px] text-[var(--color-loss)]">{saveError}</p>
          )}
          {!sumOk && (
            <p className="mt-2 text-[11px] text-text-muted">
              Sum of target percentages must be exactly 100. Adjust any row to balance.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy editor

function PolicyEditor({
  accountId,
  policy,
  loading,
  saving,
  onSave,
}: {
  accountId: string;
  policy: AssetRebalancePolicy | undefined;
  loading: boolean;
  saving: boolean;
  onSave: (patch: Partial<AssetRebalancePolicy>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<AssetRebalancePolicy>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && policy) setForm(policy);
  }, [policy, touched]);

  if (loading) {
    return (
      <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
        <Skeleton className="h-[180px] w-full" />
      </section>
    );
  }

  const setNum = (k: keyof AssetRebalancePolicy) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    setForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));
  };
  const setBool = (k: keyof AssetRebalancePolicy) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    setForm((f) => ({ ...f, [k]: e.target.checked }));
  };

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[14px] font-semibold text-text-primary">Rebalance policy</h2>
        {!policy?.persisted && (
          <span className="rounded-full bg-bg-elevated px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Defaults — not yet saved
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PolicyField label="Calendar floor (days)" hint="Minimum days between successive rebalances.">
          <input type="number" min="1" className={INPUT_CLS} value={form.calendarMinDays ?? ''} onChange={setNum('calendarMinDays')} />
        </PolicyField>
        <PolicyField label="USDT reserve floor (%)" hint="Plan never reduces USDT below this share of NAV.">
          <input type="number" min="0" max="100" step="0.5" className={INPUT_CLS} value={form.usdtReserveFloorPct ?? ''} onChange={setNum('usdtReserveFloorPct')} />
        </PolicyField>
        <PolicyField label="Slippage assumed (bps)" hint="Per-leg slippage estimate fed into cost calc.">
          <input type="number" min="0" step="0.5" className={INPUT_CLS} value={form.slippageBpsAssumed ?? ''} onChange={setNum('slippageBpsAssumed')} />
        </PolicyField>
        <PolicyField label="Fee assumed (bps)" hint="Per-leg exchange fee estimate.">
          <input type="number" min="0" step="0.5" className={INPUT_CLS} value={form.feeBpsAssumed ?? ''} onChange={setNum('feeBpsAssumed')} />
        </PolicyField>
        <PolicyField label="Require manual approval" hint="When true, plans persist as PROPOSED and need an operator to execute.">
          <input type="checkbox" checked={!!form.requireManualApproval} onChange={setBool('requireManualApproval')} />
        </PolicyField>
        <PolicyField label="Enabled" hint="When false, plan generation returns SKIP_DISABLED.">
          <input type="checkbox" checked={!!form.enabled} onChange={setBool('enabled')} />
        </PolicyField>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            await onSave(form);
            setTouched(false);
          }}
          disabled={!touched || saving}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'var(--color-profit)', color: 'var(--text-inverse)' }}
        >
          <Save size={12} /> Save policy
        </button>
      </div>
    </section>
  );
}

const INPUT_CLS =
  'rounded border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] tabular-nums text-text-primary focus:border-bd-focus focus:outline-none';

function PolicyField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      {children}
      <span className="text-[10px] text-text-muted">{hint}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan section

function PlanSection({
  running,
  plan,
  error,
  onGenerate,
}: {
  running: boolean;
  plan: AssetRebalancePlan | undefined;
  error: string | null;
  onGenerate: (persist: boolean) => Promise<void>;
}) {
  const formatCurrency = useCurrencyFormatter();

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">Rebalance plan</h2>
          <p className="text-[11px] text-text-muted">
            Computes drift vs targets and proposes trade legs. Execution is manual (Phase 4 wires the click-to-execute path).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onGenerate(false)}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full border border-bd-subtle bg-bg-base px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-hover disabled:opacity-60"
          >
            <Play size={12} /> Preview
          </button>
          <button
            type="button"
            onClick={() => onGenerate(true)}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-profit)', color: 'var(--text-inverse)' }}
          >
            <Play size={12} /> Generate + persist
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-[rgba(229,72,77,0.4)] bg-[rgba(229,72,77,0.06)] px-3 py-2 text-[11px] text-[var(--color-loss)]">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {plan ? (
        <PlanView plan={plan} formatCurrency={formatCurrency} />
      ) : (
        <p className="text-[12px] text-text-muted">
          {running ? 'Computing plan…' : 'No plan generated yet. Click Preview to see what would happen.'}
        </p>
      )}
    </section>
  );
}

function PlanView({
  plan,
  formatCurrency,
}: {
  plan: AssetRebalancePlan;
  formatCurrency: (n: number) => string;
}) {
  const statusStyle = statusBadge(plan.status);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}
        >
          {plan.status}
        </span>
        <span className="text-text-muted">method {plan.method}</span>
        {plan.portfolioValueUsdt != null && (
          <span className="text-text-secondary">
            NAV <span className="font-mono text-text-primary">{formatCurrency(plan.portfolioValueUsdt)}</span>
          </span>
        )}
        {plan.estimatedCostUsdt != null && plan.estimatedCostUsdt > 0 && (
          <span className="text-text-secondary">
            est. cost <span className="font-mono text-text-primary">{formatCurrency(plan.estimatedCostUsdt)}</span>
          </span>
        )}
        {plan.estimatedBenefitUsdt != null && plan.estimatedBenefitUsdt > 0 && (
          <span className="text-text-secondary">
            notional <span className="font-mono text-text-primary">{formatCurrency(plan.estimatedBenefitUsdt)}</span>
          </span>
        )}
      </div>

      {plan.skipReason && (
        <p className="rounded-md border border-bd-subtle bg-bg-elevated px-3 py-2 text-[11px] text-text-secondary">
          {plan.skipReason}
        </p>
      )}

      <DriftTable items={plan.driftItems} formatCurrency={formatCurrency} />

      {plan.tradePlan.length > 0 && (
        <TradeList legs={plan.tradePlan} formatCurrency={formatCurrency} />
      )}
    </div>
  );
}

function DriftTable({
  items,
  formatCurrency,
}: {
  items: AssetDriftItem[];
  formatCurrency: (n: number) => string;
}) {
  if (!items.length) return null;
  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="bg-bg-elevated text-text-muted">
            <th className="px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider">Asset</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Value</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Current</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Target</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Drift</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Band</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.asset} className="border-bd-subtle/60 border-t">
              <td className="px-3 py-1.5 text-text-primary">{d.asset}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">{formatCurrency(d.currentUsdtValue)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-primary">{d.currentPct.toFixed(2)}%</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">{d.targetPct.toFixed(2)}%</td>
              <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: driftColor(d.driftPp, d.withinBand) }}>
                {d.driftPp > 0 ? '+' : ''}
                {d.driftPp.toFixed(2)} pp
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-muted">
                {d.withinBand ? 'within' : 'out'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeList({
  legs,
  formatCurrency,
}: {
  legs: AssetTradeLeg[];
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="bg-bg-elevated text-text-muted">
            <th className="px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider">Action</th>
            <th className="px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider">Asset</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">USDT</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Base qty</th>
            <th className="px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider">Ref price</th>
            <th className="px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider">Reason</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((l, i) => (
            <tr key={`${l.asset}-${i}`} className="border-bd-subtle/60 border-t">
              <td className="px-3 py-1.5 font-semibold" style={{ color: l.action === 'SELL' ? 'var(--color-loss)' : 'var(--color-profit)' }}>
                {l.action}
              </td>
              <td className="px-3 py-1.5 text-text-primary">{l.asset}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-primary">{formatCurrency(l.estQuoteQtyUsdt)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">
                {l.estBaseQty == null ? '—' : l.estBaseQty.toFixed(6)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">
                {l.referencePrice == null ? '—' : formatCurrency(l.referencePrice)}
              </td>
              <td className="px-3 py-1.5 text-text-muted">{l.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function driftColor(driftPp: number, withinBand: boolean): string {
  if (withinBand) return 'var(--text-muted)';
  return driftPp > 0 ? 'var(--color-loss)' : 'var(--color-profit)';
}

function statusBadge(status: string): { bg: string; fg: string } {
  if (status === 'PROPOSED') return { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' };
  if (status === 'COMPLETED') return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)' };
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED')
    return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)' };
  return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' };
}
