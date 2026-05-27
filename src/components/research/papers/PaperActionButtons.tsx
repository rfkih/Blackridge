'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2, Settings2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStrategies } from '@/hooks/useStrategies';
import { useCreateBacktestRun } from '@/hooks/useBacktest';
import { createStrategyParam } from '@/lib/api/strategy-params';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { BestIteration, PaperDetail } from '@/types/papers';
import type { AccountStrategy } from '@/types/strategy';
import type { BacktestRunPayload } from '@/types/backtest';

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

const TODAY = new Date().toISOString().slice(0, 10);
const TWO_YEARS_AGO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
})();

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

interface PaperActionButtonsProps {
  paper: PaperDetail;
}

export function PaperActionButtons({ paper }: PaperActionButtonsProps) {
  const [runOpen, setRunOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;

  if (!best) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setRunOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-info)] transition-colors hover:bg-[var(--color-info)]/20"
      >
        <FlaskConical size={13} strokeWidth={1.75} />
        Run backtest
      </button>
      <button
        type="button"
        onClick={() => setApplyOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <Settings2 size={13} strokeWidth={1.75} />
        Apply to strategy
      </button>

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
    </>
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
      <div
        className="h-9 animate-pulse rounded-sm"
        style={{ background: 'var(--bg-hover)' }}
      />
    );
  }

  if (!matching.length) {
    return (
      <p className="text-[11px] text-text-muted">
        No strategies with code{' '}
        <span className="font-mono">{strategyCode}</span> found. Create one on
        the Strategies page first.
      </p>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
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
  const { data: all = [] } = useStrategies();
  const { mutateAsync: createRun, isPending } = useCreateBacktestRun();

  const [strategyId, setStrategyId] = useState('');
  const [fromDate, setFromDate] = useState(TWO_YEARS_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [capital, setCapital] = useState('10000');

  async function handleSubmit() {
    const strategy = all.find((s) => s.id === strategyId);
    if (!strategy) {
      toast.error({ title: 'Pick a strategy first' });
      return;
    }
    const payload: BacktestRunPayload = {
      accountStrategyId: strategy.id,
      strategyAccountStrategyIds: { [meta.strategy_code]: strategy.id },
      strategyCodes: [meta.strategy_code],
      asset: meta.instrument,
      interval: meta.interval_name,
      startTime: `${fromDate}T00:00:00`,
      endTime: `${toDate}T00:00:00`,
      initialCapital: Number(capital) || 10_000,
      riskPerTradePct: 0.9,
      feeRate: 0.00075,
      slippageRate: 0,
      minNotional: 7,
      minQty: 0.000001,
      qtyStep: 0.000001,
      maxOpenPositions: 1,
      allowLong: strategy.allowLong,
      allowShort: strategy.allowShort,
      strategyParamOverrides: { [meta.strategy_code]: best.params },
    };
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
          <DialogTitle>Run backtest from paper</DialogTitle>
          <DialogDescription>
            Uses the best-iteration params from this paper as overrides.{' '}
            <span className="font-mono">
              {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
            </span>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Initial capital (USDT)">
            <input
              type="number"
              value={capital}
              min={100}
              step={100}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </Field>

          <div className="rounded-sm border border-bd-subtle bg-bg-base p-3">
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Param overrides ({Object.keys(best.params).length})
            </p>
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[10px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[10px] tabular-nums text-text-primary">
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
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-info)] hover:bg-[var(--color-info)]/20 disabled:opacity-50"
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
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Params to apply ({Object.keys(best.params).length})
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[10px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[10px] tabular-nums text-text-primary">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-text-muted">
            The selected strategy&apos;s current preset will be deactivated. You can re-activate the
            previous preset from the Strategies page at any time.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-profit)]/30 bg-[var(--color-profit)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-profit)] hover:bg-[var(--color-profit)]/20 disabled:opacity-50"
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
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
