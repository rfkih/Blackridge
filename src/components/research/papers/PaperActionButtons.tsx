'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2, Settings2, Zap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BacktestActivateStrategyDialog } from '@/components/backtest/BacktestActivateStrategyDialog';
import { useStrategies } from '@/hooks/useStrategies';
import { useCreateBacktestRun, useBacktestRun } from '@/hooks/useBacktest';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { createStrategyParam } from '@/lib/api/strategy-params';
import { buildBacktestPayload } from '@/lib/backtest/buildBacktestPayload';
import { ALLOC_OPTIONS } from '@/lib/constants';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { BestIteration, PaperDetail, PaperMetadata } from '@/types/papers';
import type { AccountStrategy } from '@/types/strategy';

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function twoYearsAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

/**
 * Best account-strategy to *bind* a paper replica to. The paper's own params
 * are applied as overrides regardless, so this binding only satisfies the
 * NOT-NULL account_strategy_id and the run's symbol-approval attribution —
 * prefer one whose symbol + interval already match the paper.
 */
function pickReplicaBinding(
  candidates: AccountStrategy[],
  instrument: string,
  intervalName: string,
): AccountStrategy | null {
  if (!candidates.length) return null;
  return (
    candidates.find((s) => s.symbol === instrument && s.interval === intervalName) ??
    candidates.find((s) => s.symbol === instrument) ??
    candidates[0]
  );
}

/**
 * The paper's backtest_period.start/end are ISO datetimes; the date inputs
 * want YYYY-MM-DD. Fall back when the paper carries no period (legacy papers).
 */
function paperDateOr(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback;
}

/** Initial-capital default from the paper, clamped to the dialog's floor. */
function paperCapital(meta: PaperMetadata): string {
  return meta.initial_capital != null && meta.initial_capital >= 100
    ? String(meta.initial_capital)
    : '10000';
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

interface PaperActionButtonsProps {
  paper: PaperDetail;
}

export function PaperActionButtons({ paper }: PaperActionButtonsProps) {
  const [runOpen, setRunOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;

  if (!best) return null;

  // Activation replays the paper's best-iteration backtest run, so it needs a
  // run to point at. Legacy papers whose iteration predates run-linkage have a
  // null backtest_run_id and can't be activated this way.
  const canActivate = !!best.backtest_run_id;

  return (
    <>
      <button
        type="button"
        onClick={() => setRunOpen(true)}
        className="border-[var(--color-info)]/30 bg-[var(--color-info)]/10 hover:bg-[var(--color-info)]/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[14px] font-semibold text-[var(--color-info)] transition-colors"
      >
        <FlaskConical size={13} strokeWidth={1.75} />
        Run backtest
      </button>
      <button
        type="button"
        onClick={() => setApplyOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[14px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <Settings2 size={13} strokeWidth={1.75} />
        Apply to strategy
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setActivateOpen(true)}
          disabled={!canActivate}
          title={
            canActivate
              ? "Activate this paper's parameters on one of your strategies"
              : 'This paper has no linked backtest run to activate from'
          }
          className="border-[var(--color-profit)]/30 bg-[var(--color-profit)]/10 hover:bg-[var(--color-profit)]/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[14px] font-semibold text-[var(--color-profit)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap size={13} strokeWidth={1.75} />
          Activate strategy
        </button>
      )}

      <RunBacktestDialog
        open={runOpen}
        paper={paper}
        best={best}
        onClose={() => setRunOpen(false)}
      />
      <ApplyParamsDialog
        open={applyOpen}
        paper={paper}
        best={best}
        onClose={() => setApplyOpen(false)}
      />
      {isAdmin && (
        <ActivateFromPaperDialog
          open={activateOpen}
          backtestRunId={best.backtest_run_id}
          onClose={() => setActivateOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Activate-strategy dialog (admin) — bridges the paper to the canonical
// backtest activation flow. We fetch the paper's best-iteration backtest run
// and hand it to BacktestActivateStrategyDialog, which activates a strategy
// from that run's effective_params_snapshot — i.e. the paper's parameters.
// ---------------------------------------------------------------------------

interface ActivateFromPaperDialogProps {
  open: boolean;
  backtestRunId: string | null;
  onClose: () => void;
}

function ActivateFromPaperDialog({ open, backtestRunId, onClose }: ActivateFromPaperDialogProps) {
  const {
    data: run,
    isLoading,
    isError,
  } = useBacktestRun(open && backtestRunId ? backtestRunId : undefined);

  // Activation resolves params from the run's effective_params_snapshot (V104+).
  // Pre-V104 runs lack it; the backend then falls back to config-snapshot deltas,
  // which can drift from the paper if code defaults changed since the run. Refuse
  // to activate those rather than silently activate the wrong parameters.
  const reproducible =
    !!run && !!run.effectiveParamsSnapshot && Object.keys(run.effectiveParamsSnapshot).length > 0;

  // Run is ready and faithfully replayable — defer entirely to the canonical dialog.
  if (open && run && run.status === 'COMPLETED' && reproducible) {
    return <BacktestActivateStrategyDialog run={run} open onClose={onClose} />;
  }

  if (!open) return null;

  const message = isLoading
    ? "Loading the paper's backtest run…"
    : isError || !run
      ? 'Could not load the backtest run linked to this paper. It may have been pruned.'
      : run.status !== 'COMPLETED'
        ? `The linked backtest run is ${run.status}, not COMPLETED — it cannot be activated.`
        : "This paper's backtest predates parameter snapshotting (pre-V104), so activating it can't faithfully reproduce its parameters. Re-run the backtest from this paper, then activate from the fresh run.";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <Zap size={14} strokeWidth={2} className="text-[var(--color-profit)]" />
            Activate strategy
          </DialogTitle>
          <DialogDescription className="text-[14px] text-text-secondary">
            {message}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-2">
          {isLoading && <Loader2 size={14} className="animate-spin text-text-muted" />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared: strategy selector (filters by strategyCode)
// ---------------------------------------------------------------------------

interface StrategySelectorProps {
  strategyCode: string;
  value: string;
  onChange: (id: string) => void;
}

function StrategySelector({ strategyCode, value, onChange }: StrategySelectorProps) {
  const { data: all = [], isLoading } = useStrategies();
  const matching: AccountStrategy[] = all.filter((s) => s.strategyCode === strategyCode);

  if (isLoading) {
    return (
      <div className="h-9 animate-pulse rounded-sm" style={{ background: 'var(--bg-hover)' }} />
    );
  }

  if (!matching.length) {
    return (
      <p className="text-[13px] text-text-muted">
        No strategies with code <span className="font-mono">{strategyCode}</span> found. Create one
        on the Strategies page first.
      </p>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
    >
      <option value="">Pick a strategy…</option>
      {matching.map((s) => (
        <option key={s.id} value={s.id}>
          {s.presetName} — {s.symbol} {s.interval}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Run backtest dialog
// ---------------------------------------------------------------------------

interface RunBacktestDialogProps {
  open: boolean;
  paper: PaperDetail;
  best: BestIteration;
  onClose: () => void;
}

function RunBacktestDialog({ open, paper, best, onClose }: RunBacktestDialogProps) {
  const router = useRouter();
  const meta = paper.metadata;
  const { data: all = [], isLoading: strategiesLoading } = useStrategies();
  const { mutateAsync: createRun, isPending } = useCreateBacktestRun();

  // Account-strategies that can carry this paper's strategy code. Any of them
  // works as a binding — the paper supplies the params either way.
  const matching = useMemo(
    () => all.filter((s) => s.strategyCode === meta.strategy_code),
    [all, meta.strategy_code],
  );

  const [strategyId, setStrategyId] = useState('');
  const [fromDate, setFromDate] = useState(() =>
    paperDateOr(meta.backtest_period.start, twoYearsAgoIso()),
  );
  const [toDate, setToDate] = useState(() => paperDateOr(meta.backtest_period.end, todayIso()));
  const [capital, setCapital] = useState(() => paperCapital(meta));
  // '' = Auto (fall back to the bound account-strategy's saved allocation).
  const [allocationPct, setAllocationPct] = useState('');

  // Reset every field to the paper's own values whenever the dialog reopens so
  // a previous (cancelled) edit doesn't carry over and the next open faithfully
  // reflects this paper.
  useEffect(() => {
    if (!open) {
      setStrategyId('');
      setFromDate(paperDateOr(meta.backtest_period.start, twoYearsAgoIso()));
      setToDate(paperDateOr(meta.backtest_period.end, todayIso()));
      setCapital(paperCapital(meta));
      setAllocationPct('');
    }
  }, [open, meta]);

  // Auto-pick the binding once the strategies have loaded — the user shouldn't
  // have to know which preset corresponds to the paper.
  useEffect(() => {
    if (!open || strategyId || strategiesLoading) return;
    const pick = pickReplicaBinding(matching, meta.instrument, meta.interval_name);
    if (pick) setStrategyId(pick.id);
  }, [open, strategyId, strategiesLoading, matching, meta.instrument, meta.interval_name]);

  async function handleSubmit() {
    const strategy = all.find((s) => s.id === strategyId);
    if (!strategy) {
      toast.error({ title: 'No matching strategy to bind' });
      return;
    }
    if (!fromDate || !toDate || fromDate >= toDate) {
      toast.error({
        title: 'Invalid date range',
        description: 'From-date must be before to-date.',
      });
      return;
    }
    const capitalNum = Number(capital);
    if (!Number.isFinite(capitalNum) || capitalNum < 100) {
      toast.error({
        title: 'Invalid capital',
        description: 'Initial capital must be at least 100 USDT.',
      });
      return;
    }

    const allocNum = Number(allocationPct);
    const strategyAllocations =
      allocationPct && Number.isFinite(allocNum) && allocNum > 0
        ? { [meta.strategy_code]: allocNum }
        : undefined;

    let payload;
    try {
      payload = buildBacktestPayload(
        {
          symbol: meta.instrument,
          interval: meta.interval_name,
          fromDate,
          toDate,
          initialCapital: capitalNum,
          strategyCodes: [meta.strategy_code],
          strategyAccountStrategyIds: { [meta.strategy_code]: strategy.id },
          allowLong: strategy.allowLong,
          allowShort: strategy.allowShort,
          ...(strategyAllocations ? { strategyAllocations } : {}),
        },
        { [meta.strategy_code]: best.params },
        {},
      );
    } catch (err) {
      toast.error({ title: 'Could not build payload', description: normalizeError(err) });
      return;
    }

    try {
      await createRun(payload);
      toast.success({ title: 'Backtest queued', description: 'Redirecting to backtest list…' });
      onClose();
      router.push('/backtest');
    } catch (err) {
      toast.error({ title: 'Launch failed', description: normalizeError(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replicate backtest from paper</DialogTitle>
          <DialogDescription>
            Pre-filled to reproduce the paper — its window, capital, and parameters are applied
            automatically.{' '}
            <span className="font-mono">
              {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field label="Account binding (auto-selected)">
            {strategiesLoading ? (
              <div
                className="h-9 animate-pulse rounded-sm"
                style={{ background: 'var(--bg-hover)' }}
              />
            ) : matching.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No account-strategy with code{' '}
                <span className="font-mono">{meta.strategy_code}</span> exists in your account yet.
                Create one on the Strategies page first — the run needs a binding even though the
                paper supplies its own parameters.
              </p>
            ) : (
              <select
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              >
                {matching.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.presetName} — {s.symbol} {s.interval}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[12px] text-text-muted">
              Only attributes the run to one of your strategies — the paper&apos;s parameters below
              are applied regardless of which preset is bound.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Initial capital (USDT)">
              <input
                type="number"
                value={capital}
                min={100}
                step={100}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
            <Field label="Asset allocation">
              <select
                value={allocationPct}
                onChange={(e) => setAllocationPct(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[13px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              >
                <option value="">Auto (account default)</option>
                {ALLOC_OPTIONS.map((v) => (
                  <option key={v} value={String(v)}>
                    {v}% of capital
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-sm border border-bd-subtle bg-bg-base p-3">
            <p className="mb-1.5 font-mono text-[12px] font-semibold uppercase tracking-widest text-text-muted">
              Paper parameters · applied automatically ({Object.keys(best.params).length})
            </p>
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[12px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[12px] tabular-nums text-text-primary">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="border-[var(--color-info)]/30 bg-[var(--color-info)]/10 hover:bg-[var(--color-info)]/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[14px] font-semibold text-[var(--color-info)] disabled:opacity-50"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Queue backtest
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Apply params dialog
// ---------------------------------------------------------------------------

interface ApplyParamsDialogProps {
  open: boolean;
  paper: PaperDetail;
  best: BestIteration;
  onClose: () => void;
}

function ApplyParamsDialog({ open, paper, best, onClose }: ApplyParamsDialogProps) {
  const meta = paper.metadata;
  const queryClient = useQueryClient();
  const [strategyId, setStrategyId] = useState('');

  // Reset on every open/close transition so the Radix exit-animation race
  // (open→close→open within ~150ms) can never reuse a stale selection.
  useEffect(() => {
    if (!open) setStrategyId('');
  }, [open]);

  const { mutate: applyParams, isPending } = useMutation({
    mutationFn: (accountStrategyId: string) =>
      createStrategyParam({
        accountStrategyId,
        name: `Paper ${paper.paper_id.slice(0, 8)} — best params`,
        overrides: best.params,
        activate: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success({
        title: 'Params applied',
        description: 'Best-iteration params saved and activated as a new preset.',
      });
      onClose();
    },
    onError: (err) => {
      toast.error({ title: 'Apply failed', description: normalizeError(err) });
    },
  });

  function handleSubmit() {
    if (!strategyId) {
      toast.error({ title: 'Pick a strategy first' });
      return;
    }
    applyParams(strategyId);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply params to strategy</DialogTitle>
          <DialogDescription>
            Creates a new param preset from the best-iteration params and activates it on the
            selected strategy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field label="Account strategy">
            <StrategySelector
              strategyCode={meta.strategy_code}
              value={strategyId}
              onChange={setStrategyId}
            />
          </Field>

          <div className="rounded-sm border border-bd-subtle bg-bg-base p-3">
            <p className="mb-1.5 font-mono text-[12px] font-semibold uppercase tracking-widest text-text-muted">
              Params to apply ({Object.keys(best.params).length})
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[12px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[12px] tabular-nums text-text-primary">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[13px] text-text-muted">
            The selected strategy&apos;s current preset will be deactivated. You can re-activate the
            previous preset from the Strategies page at any time.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="border-[var(--color-profit)]/30 bg-[var(--color-profit)]/10 hover:bg-[var(--color-profit)]/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[14px] font-semibold text-[var(--color-profit)] disabled:opacity-50"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Apply params
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Field layout helper
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[12px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
