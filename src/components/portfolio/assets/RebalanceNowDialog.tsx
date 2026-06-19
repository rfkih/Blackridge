'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Rocket, XCircle } from 'lucide-react';
import {
  useComputeAssetRebalancePlan,
  useExecuteRebalance,
  useUpdateAssetPolicy,
} from '@/hooks/useAssetAllocation';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import type {
  AssetRebalanceHistoryView,
  AssetRebalancePlan,
  AssetRebalancePolicy,
} from '@/types/assetAllocation';

const CAP_BUFFER_USDT = 5;
const DEFAULT_CAP_USDT = 50;
const DEFAULT_CALENDAR_MIN_DAYS = 7;

/**
 * One-shot "Rebalance now" dialog: previews a plan from the account's current
 * saved targets (no write), then on a typed-`EXECUTE` confirm runs
 * persist + execute back-to-back so no stale PROPOSED row is left to block
 * future plans. Handles the two real guards: the per-execute cap (prompt to
 * raise) and the calendar-floor cooldown (admin-only override via `force`).
 *
 * Self-contained — owns its own mutation instances so it never clashes with the
 * page's power-user PlanSection. Reuses the existing hooks/formatters/toast.
 */
export function RebalanceNowDialog({
  open,
  onOpenChange,
  accountId,
  policy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  policy: AssetRebalancePolicy | undefined;
}) {
  const computeMut = useComputeAssetRebalancePlan();
  const executeMut = useExecuteRebalance();
  const policyMut = useUpdateAssetPolicy();
  const formatCurrency = useCurrencyFormatter();
  const isAdmin = useIsAdmin();

  const [plan, setPlan] = useState<AssetRebalancePlan | null>(null);
  const [result, setResult] = useState<AssetRebalanceHistoryView | null>(null);
  const [typed, setTyped] = useState('');
  const [forced, setForced] = useState(false);
  const [localCap, setLocalCap] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Auto-preview on open / account change. Resets everything so a preview for
  // account A can never be executed against account B.
  useEffect(() => {
    if (!open) return undefined;
    setPlan(null);
    setResult(null);
    setTyped('');
    setForced(false);
    setLocalCap(null);
    setInlineError(null);
    let cancelled = false;
    computeMut
      .mutateAsync({ accountId, persist: false, force: false })
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err) => {
        if (!cancelled) setInlineError(normalizeError(err));
      });
    return () => {
      cancelled = true;
    };
    // computeMut.mutateAsync is a stable reference (TanStack Query).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  const cap = localCap ?? policy?.maxPerExecuteUsdt ?? DEFAULT_CAP_USDT;
  const calendarMinDays = policy?.calendarMinDays ?? DEFAULT_CALENDAR_MIN_DAYS;
  const totalNotional = useMemo(
    () => (plan?.tradePlan ?? []).reduce((s, l) => s + l.estQuoteQtyUsdt, 0),
    [plan],
  );
  const isProposed = !!plan && plan.status === 'PROPOSED' && plan.tradePlan.length > 0;
  const capExceeded = isProposed && totalNotional > cap;
  const suggestedCap = Math.ceil(totalNotional) + CAP_BUFFER_USDT;
  const cooldownEndsMs = plan?.lastRebalanceAt
    ? parseIsoUtc(plan.lastRebalanceAt) + calendarMinDays * 86_400_000
    : null;

  const busy = computeMut.isPending || executeMut.isPending || policyMut.isPending;
  const armed = typed.trim() === 'EXECUTE' && isProposed && !capExceeded && !busy;

  async function repreviewForced() {
    setInlineError(null);
    setResult(null);
    setTyped('');
    try {
      const p = await computeMut.mutateAsync({ accountId, persist: false, force: true });
      setPlan(p);
      setForced(true);
    } catch (err) {
      setInlineError(normalizeError(err));
    }
  }

  async function raiseCap() {
    setInlineError(null);
    try {
      const pol = await policyMut.mutateAsync({ accountId, maxPerExecuteUsdt: suggestedCap });
      setLocalCap(pol.maxPerExecuteUsdt);
    } catch (err) {
      setInlineError(normalizeError(err));
    }
  }

  async function submit() {
    setInlineError(null);
    try {
      // Persist + execute back-to-back so the PROPOSED row never lingers.
      const persisted = await computeMut.mutateAsync({ accountId, persist: true, force: forced });
      if (persisted.status !== 'PROPOSED' || !persisted.rebalanceId) {
        setPlan(persisted);
        setInlineError(
          `Plan changed before execution (status ${persisted.status}). Re-preview and try again.`,
        );
        return;
      }
      const res = await executeMut.mutateAsync({ rebalanceId: persisted.rebalanceId });
      setResult(res);
      if (res.status === 'COMPLETED') {
        toast.success({
          title: 'Rebalance executed',
          description: `${res.executionSummary?.succeeded ?? 0}/${res.executionSummary?.totalLegs ?? 0} legs filled`,
        });
      } else {
        toast.error({
          title: 'Rebalance failed',
          description: res.failedReason ?? 'See the execution details.',
        });
      }
    } catch (err) {
      setInlineError(normalizeError(err));
    }
  }

  if (!open) return null;

  const close = () => onOpenChange(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (!busy) close();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-bd-subtle bg-bg-surface p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Rocket size={16} className="text-[var(--color-loss)]" />
          <h3 className="font-display text-[15px] font-semibold text-text-primary">
            Rebalance now
          </h3>
          <span className="ml-auto font-mono text-[12px] uppercase tracking-wider text-text-muted">
            {accountId.slice(0, 8)}
          </span>
        </div>

        {inlineError && (
          <div className="mb-3 inline-flex w-full items-center gap-2 rounded-md border border-[rgba(229,72,77,0.4)] bg-[rgba(229,72,77,0.06)] px-3 py-2 text-[13px] text-[var(--color-loss)]">
            <AlertTriangle size={12} /> {inlineError}
          </div>
        )}

        {result ? (
          <ResultPanel result={result} formatCurrency={formatCurrency} />
        ) : !plan ? (
          <Centered>
            <Loader2 size={14} className="animate-spin" /> Computing plan…
          </Centered>
        ) : plan.status === 'SKIP_CALENDAR_FLOOR' ? (
          <CooldownPanel
            skipReason={plan.skipReason}
            cooldownEndsMs={cooldownEndsMs}
            isAdmin={isAdmin}
            busy={busy}
            onOverride={repreviewForced}
          />
        ) : !isProposed ? (
          <div className="rounded-md border border-bd-subtle bg-bg-elevated px-3 py-3 text-[14px] text-text-secondary">
            {plan.skipReason ?? 'No asset drifted outside its band — nothing to rebalance.'}
          </div>
        ) : (
          <ReadyPanel
            plan={plan}
            forced={forced}
            totalNotional={totalNotional}
            cap={cap}
            capExceeded={capExceeded}
            suggestedCap={suggestedCap}
            busy={busy}
            executing={executeMut.isPending}
            raisingCap={policyMut.isPending}
            typed={typed}
            setTyped={setTyped}
            armed={armed}
            onRaiseCap={raiseCap}
            onSubmit={submit}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-full border border-bd-subtle bg-bg-base px-4 py-1.5 text-[14px] text-text-primary hover:bg-bg-hover disabled:opacity-60"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-bd-subtle bg-bg-elevated px-3 py-6 text-[14px] text-text-secondary">
      {children}
    </div>
  );
}

function CooldownPanel({
  skipReason,
  cooldownEndsMs,
  isAdmin,
  busy,
  onOverride,
}: {
  skipReason: string | null;
  cooldownEndsMs: number | null;
  isAdmin: boolean;
  busy: boolean;
  onOverride: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="inline-flex w-full items-start gap-2 rounded-md border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.06)] px-3 py-2 text-[13px] text-[var(--color-warning)]">
        <Clock size={12} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Rebalance cooldown is active.</p>
          <p className="mt-0.5 text-text-secondary">
            {skipReason ?? 'A recent rebalance is still within the calendar floor.'}
            {cooldownEndsMs != null && (
              <>
                {' '}
                Next rebalance allowed ~
                <span className="font-mono text-text-primary">{formatDate(cooldownEndsMs)}</span>.
              </>
            )}
          </p>
        </div>
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={onOverride}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-semibold disabled:opacity-60"
          style={{ background: 'var(--color-warning)', color: 'var(--text-inverse)' }}
        >
          {busy && <Loader2 size={12} className="animate-spin" />} Override cooldown and rebalance
          now
        </button>
      ) : (
        <p className="text-[13px] text-text-muted">
          Ask an admin to override the cooldown, or wait until the date above.
        </p>
      )}
    </div>
  );
}

function ReadyPanel({
  plan,
  forced,
  totalNotional,
  cap,
  capExceeded,
  suggestedCap,
  busy,
  executing,
  raisingCap,
  typed,
  setTyped,
  armed,
  onRaiseCap,
  onSubmit,
  formatCurrency,
}: {
  plan: AssetRebalancePlan;
  forced: boolean;
  totalNotional: number;
  cap: number;
  capExceeded: boolean;
  suggestedCap: number;
  busy: boolean;
  executing: boolean;
  raisingCap: boolean;
  typed: string;
  setTyped: (v: string) => void;
  armed: boolean;
  onRaiseCap: () => void;
  onSubmit: () => void;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-text-secondary">
        About to submit{' '}
        <span className="font-semibold text-text-primary">{plan.tradePlan.length}</span> trade
        {plan.tradePlan.length === 1 ? '' : 's'} for a total notional of{' '}
        <span className="font-mono text-text-primary">{formatCurrency(totalNotional)}</span>
        {plan.estimatedCostUsdt != null && plan.estimatedCostUsdt > 0 && (
          <>
            {' '}
            (est. cost{' '}
            <span className="font-mono text-text-primary">
              {formatCurrency(plan.estimatedCostUsdt)}
            </span>
            )
          </>
        )}{' '}
        on your live Binance account.
        {forced && <span className="text-[var(--color-warning)]"> Cooldown overridden.</span>}
      </p>

      <ul className="space-y-1 rounded-md border border-bd-subtle bg-bg-base p-2 font-mono text-[13px]">
        {plan.tradePlan.map((l, i) => (
          <li key={`${l.asset}-${i}`} className="flex items-center justify-between gap-3">
            <span
              style={{ color: l.action === 'SELL' ? 'var(--color-loss)' : 'var(--color-profit)' }}
            >
              {l.action}
            </span>
            <span className="flex-1 text-text-primary">{l.asset}</span>
            <span className="tabular-nums text-text-secondary">
              {formatCurrency(l.estQuoteQtyUsdt)}
            </span>
          </li>
        ))}
      </ul>

      {capExceeded && (
        <div className="space-y-2 rounded-md border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.06)] px-3 py-2 text-[13px]">
          <p className="text-[var(--color-warning)]">
            This plan trades <span className="font-mono">{formatCurrency(totalNotional)}</span>,
            above your per-execute cap of <span className="font-mono">{formatCurrency(cap)}</span>.
          </p>
          <button
            type="button"
            onClick={onRaiseCap}
            disabled={raisingCap}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-warning)', color: 'var(--text-inverse)' }}
          >
            {raisingCap && <Loader2 size={11} className="animate-spin" />}
            Raise cap to {formatCurrency(suggestedCap)} and continue
          </button>
        </div>
      )}

      <div className={capExceeded ? 'pointer-events-none opacity-50' : ''}>
        <label className="block text-[13px] text-text-muted">
          Type <span className="font-mono font-bold text-text-primary">EXECUTE</span> to confirm:
        </label>
        <input
          type="text"
          aria-label="confirm-execute"
          className="focus:border-bd-focus mt-1 w-full rounded border border-bd-subtle bg-bg-base px-2 py-1.5 font-mono text-[14px] uppercase tracking-wider text-text-primary focus:outline-none"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={capExceeded || busy}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!armed}
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--color-loss)', color: 'var(--text-inverse)' }}
          >
            {executing && <Loader2 size={12} className="animate-spin" />}
            {executing ? 'Submitting…' : 'Submit trades'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  formatCurrency,
}: {
  result: AssetRebalanceHistoryView;
  formatCurrency: (n: number) => string;
}) {
  const sum = result.executionSummary;
  const success = result.status === 'COMPLETED';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[14px]">
        {success ? (
          <span className="inline-flex items-center gap-1 text-[var(--color-profit)]">
            <CheckCircle2 size={14} /> Trades submitted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[var(--color-loss)]">
            <XCircle size={14} /> {result.status}
          </span>
        )}
        {sum && (
          <span className="text-text-secondary">
            {sum.succeeded}/{sum.totalLegs} legs · actual notional{' '}
            <span className="font-mono text-text-primary">
              {formatCurrency(sum.actualNotionalUsdt)}
            </span>
          </span>
        )}
      </div>
      {result.failedReason && (
        <p className="rounded-md border border-[rgba(229,72,77,0.4)] bg-[rgba(229,72,77,0.06)] px-3 py-2 text-[13px] text-[var(--color-loss)]">
          {result.failedReason}
        </p>
      )}
      {sum && sum.legs.length > 0 && (
        <ul className="space-y-1 rounded-md border border-bd-subtle bg-bg-base p-2 font-mono text-[13px]">
          {sum.legs.map((l, i) => (
            <li key={`${l.asset}-${i}`} className="flex items-center justify-between gap-3">
              <span
                style={{ color: l.action === 'SELL' ? 'var(--color-loss)' : 'var(--color-profit)' }}
              >
                {l.action}
              </span>
              <span className="flex-1 text-text-primary">{l.asset}</span>
              <span className="tabular-nums text-text-secondary">
                {l.filledQuoteUsdt == null ? '—' : formatCurrency(l.filledQuoteUsdt)}
              </span>
              <span
                className={l.succeeded ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}
              >
                {l.succeeded ? (l.binanceStatus ?? 'OK') : (l.errorMessage ?? 'FAILED')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
