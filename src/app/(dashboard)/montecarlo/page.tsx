'use client';

import { useMemo, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { AlertCircle, Dice5, Loader2, Percent, Play, Target, TrendingUp } from 'lucide-react';
import { z } from 'zod';
import { StatCard } from '@/components/shared/StatCard';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktestRuns } from '@/hooks/useBacktest';
import { useMonteCarlo } from '@/hooks/useMonteCarlo';
import { normalizeError } from '@/lib/api/client';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { MonteCarloResult, MonteCarloSimulationMode } from '@/types/montecarlo';

// Recharts is ~80kb gzipped — only ship it once the user has a result to
// render. The form + form schema still render without it.
const MonteCarloChart = nextDynamic(
  () => import('@/components/charts/MonteCarloChart').then((m) => m.MonteCarloChart),
  { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> },
);

const SIM_MODES: Array<{ value: MonteCarloSimulationMode; label: string; hint: string }> = [
  {
    value: 'BOOTSTRAP_RETURNS',
    label: 'Bootstrap Returns',
    hint: 'Draws N trades with replacement from the empirical distribution.',
  },
  {
    value: 'TRADE_SEQUENCE_SHUFFLE',
    label: 'Sequence Shuffle',
    hint: 'Keeps each trade P&L, reshuffles execution order per path.',
  },
];

const formSchema = z.object({
  backtestRunId: z.string().uuid('Pick a completed backtest run.'),
  simulationMode: z.enum(['BOOTSTRAP_RETURNS', 'TRADE_SEQUENCE_SHUFFLE']),
  initialCapital: z.number({ error: 'Initial capital is required.' }).positive('Must be positive.'),
  numberOfSimulations: z
    .number({ error: 'Number of simulations is required.' })
    .int('Must be a whole number.')
    .min(100, 'Minimum 100 simulations.')
    .max(100_000, 'Maximum 100,000 simulations.'),
  horizonTrades: z.number({ error: 'Horizon is required.' }).int().positive('Must be positive.'),
  ruinThresholdPct: z
    .number({ error: 'Ruin threshold is required.' })
    .min(1, 'Minimum 1%.')
    .max(99, 'Maximum 99%.'),
  maxAcceptableDrawdownPct: z
    .number({ error: 'Drawdown threshold is required.' })
    .min(1, 'Minimum 1%.')
    .max(99, 'Maximum 99%.'),
});

type FormValues = z.infer<typeof formSchema>;

interface FormState {
  backtestRunId: string;
  simulationMode: MonteCarloSimulationMode;
  initialCapital: string;
  numberOfSimulations: string;
  horizonTrades: string;
  ruinThresholdPct: string;
  maxAcceptableDrawdownPct: string;
}

const DEFAULT_FORM: FormState = {
  backtestRunId: '',
  simulationMode: 'BOOTSTRAP_RETURNS',
  initialCapital: '10000',
  numberOfSimulations: '1000',
  horizonTrades: '100',
  ruinThresholdPct: '30',
  maxAcceptableDrawdownPct: '20',
};

// Reused by every text/number input + select in the form. Defined here (above
// the page component) so the component body can reference it without tripping
// @typescript-eslint/no-use-before-define.
const inputClasses = cn(
  'h-9 rounded-sm border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary',
  'focus:border-bd focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

export default function MonteCarloPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pull a sized page of completed runs so the dropdown has a healthy set
  // without relying on the backend's default 20-row page.
  const runsQ = useBacktestRuns({ status: 'COMPLETED', size: 100 });
  const completedRuns = useMemo(
    () => (runsQ.data?.content ?? []).filter((r) => r.status === 'COMPLETED'),
    [runsQ.data?.content],
  );

  const mutation = useMonteCarlo();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const parsed = formSchema.safeParse({
      backtestRunId: form.backtestRunId,
      simulationMode: form.simulationMode,
      initialCapital: Number(form.initialCapital),
      numberOfSimulations: Number(form.numberOfSimulations),
      horizonTrades: Number(form.horizonTrades),
      ruinThresholdPct: Number(form.ruinThresholdPct),
      maxAcceptableDrawdownPct: Number(form.maxAcceptableDrawdownPct),
    });
    if (!parsed.success) {
      const next: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') next[key as keyof FormState] = issue.message;
      }
      setErrors(next);
      return;
    }
    const values: FormValues = parsed.data;

    try {
      await mutation.mutateAsync({
        backtestRunId: values.backtestRunId,
        simulationMode: values.simulationMode,
        initialCapital: values.initialCapital,
        numberOfSimulations: values.numberOfSimulations,
        horizonTrades: values.horizonTrades,
        ruinThresholdPct: values.ruinThresholdPct,
        maxAcceptableDrawdownPct: values.maxAcceptableDrawdownPct,
      });
    } catch (err) {
      setSubmitError(normalizeError(err));
    }
  };

  const result = mutation.data;

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps">Monte Carlo</p>
        <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
          Simulation
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Bootstrap or shuffle trades from a completed backtest to project forward equity
          distributions.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-md border border-bd-subtle bg-bg-surface p-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <Field label="Source Backtest" error={errors.backtestRunId} hint="Must be a COMPLETED run.">
          <select
            value={form.backtestRunId}
            onChange={(e) => updateField('backtestRunId', e.target.value)}
            className={inputClasses}
          >
            <option value="" disabled>
              {runsQ.isLoading
                ? 'Loading runs…'
                : completedRuns.length === 0
                  ? 'No completed runs'
                  : 'Select a run'}
            </option>
            {completedRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.strategyCode || r.strategyName} · {r.symbol} · {r.interval} ·{' '}
                {(r.metrics?.totalReturnPct ?? 0).toFixed(1)}%
              </option>
            ))}
          </select>
        </Field>

        <Field label="Simulation Mode" error={errors.simulationMode}>
          <select
            value={form.simulationMode}
            onChange={(e) =>
              updateField('simulationMode', e.target.value as MonteCarloSimulationMode)
            }
            className={inputClasses}
          >
            {SIM_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-text-muted">
            {SIM_MODES.find((m) => m.value === form.simulationMode)?.hint}
          </p>
        </Field>

        <Field label="Initial Capital (USDT)" error={errors.initialCapital}>
          <NumberInput
            value={form.initialCapital}
            onChange={(v) => updateField('initialCapital', v)}
            step="100"
            min="0"
          />
        </Field>

        <Field label="Number of Simulations" error={errors.numberOfSimulations}>
          <NumberInput
            value={form.numberOfSimulations}
            onChange={(v) => updateField('numberOfSimulations', v)}
            step="100"
            min="100"
            max="100000"
          />
        </Field>

        <Field label="Horizon (Trades)" error={errors.horizonTrades}>
          <NumberInput
            value={form.horizonTrades}
            onChange={(v) => updateField('horizonTrades', v)}
            step="10"
            min="1"
          />
        </Field>

        <Field label="Ruin Threshold (%)" error={errors.ruinThresholdPct}>
          <NumberInput
            value={form.ruinThresholdPct}
            onChange={(v) => updateField('ruinThresholdPct', v)}
            step="1"
            min="1"
            max="99"
          />
        </Field>

        <Field label="Max Acceptable Drawdown (%)" error={errors.maxAcceptableDrawdownPct}>
          <NumberInput
            value={form.maxAcceptableDrawdownPct}
            onChange={(v) => updateField('maxAcceptableDrawdownPct', v)}
            step="1"
            min="1"
            max="99"
          />
        </Field>

        <div className="flex items-end justify-end lg:col-span-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm bg-profit px-4 py-2 text-[13px] font-semibold text-text-inverse',
              'transition-opacity duration-fast hover:opacity-90',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Running…
              </>
            ) : (
              <>
                <Play size={14} /> Run Simulation
              </>
            )}
          </button>
        </div>

        {submitError && (
          <div className="border-[var(--color-loss)]/40 bg-[var(--color-loss)]/10 col-span-full flex items-center gap-2 rounded-sm border px-3 py-2 text-[12px] text-[var(--color-loss)]">
            <AlertCircle size={14} /> {submitError}
          </div>
        )}
      </form>

      {mutation.isPending && <RunningSkeleton />}

      {result && !mutation.isPending && <Results result={result} />}
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function Results({ result }: { result: MonteCarloResult }) {
  const p10 = result.finalEquityPercentiles.P10 ?? null;
  const p50 = result.finalEquityPercentiles.P50 ?? result.medianFinalEquity;
  const p90 = result.finalEquityPercentiles.P90 ?? null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-[13px] font-semibold text-text-primary">
            Simulated Equity Paths
          </h3>
          <span className="font-mono text-[11px] text-text-muted">
            {result.numberOfSimulations.toLocaleString()} paths · {result.tradesUsed} trades each
          </span>
        </div>
        <div className="p-3">
          <ErrorBoundary label="Monte Carlo chart">
            <MonteCarloChart result={result} />
          </ErrorBoundary>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Expected Return"
          value={`${result.meanTotalReturnPct >= 0 ? '+' : ''}${result.meanTotalReturnPct.toFixed(
            2,
          )}%`}
          valueColor={result.meanTotalReturnPct >= 0 ? 'profit' : 'loss'}
          sub={`Mean final: $${formatPrice(result.meanFinalEquity)}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Risk of Ruin"
          value={`${(result.probabilityOfRuin * 100).toFixed(2)}%`}
          valueColor={
            result.probabilityOfRuin >= 0.05
              ? 'loss'
              : result.probabilityOfRuin >= 0.01
                ? 'warning'
                : 'profit'
          }
          sub={`Threshold: ${result.ruinThresholdPct}%`}
          icon={Target}
        />
        <StatCard
          label="P(Drawdown > threshold)"
          value={`${(result.probabilityOfDrawdownBreach * 100).toFixed(2)}%`}
          valueColor={result.probabilityOfDrawdownBreach >= 0.1 ? 'loss' : 'warning'}
          sub={`Max acceptable: ${result.maxAcceptableDrawdownPct}%`}
          icon={Percent}
        />
        <StatCard
          label="P(Profit)"
          value={`${(result.probabilityOfProfit * 100).toFixed(2)}%`}
          valueColor={result.probabilityOfProfit >= 0.5 ? 'profit' : 'loss'}
          sub={`Median return: ${result.medianTotalReturnPct.toFixed(2)}%`}
          icon={Dice5}
        />
      </div>

      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <div className="border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-[13px] font-semibold text-text-primary">
            Final Equity Distribution
          </h3>
        </div>
        <div className="grid grid-cols-3 divide-x divide-bd-subtle">
          <PercentileStat label="P10 (pessimistic)" value={p10} tone="loss" />
          <PercentileStat label="P50 (median)" value={p50} tone="info" />
          <PercentileStat label="P90 (optimistic)" value={p90} tone="profit" />
        </div>
      </section>
    </div>
  );
}

function PercentileStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: 'profit' | 'loss' | 'info';
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--color-info)';
  return (
    <div className="px-4 py-3">
      <p className="label-caps">{label}</p>
      <p
        className="mt-1 font-display text-lg font-semibold tabular-nums"
        style={{ color: value == null ? 'var(--text-muted)' : color }}
      >
        {value == null ? '—' : `$${formatPrice(value)}`}
      </p>
    </div>
  );
}

// ─── Form primitives ─────────────────────────────────────────────────────────

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // The label wraps the caption + the passed-in control, which is a valid
    // nested association — eslint-plugin-jsx-a11y doesn't detect it through
    // arbitrary children, so we disable the rule here.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] text-[var(--color-loss)]">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step={step}
      min={min}
      max={max}
      className={inputClasses}
    />
  );
}

function RunningSkeleton() {
  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
          <span className="font-mono text-[12px] text-text-secondary">Running simulation…</span>
        </div>
        <span className="font-mono text-[11px] text-text-muted">Paths can take a few seconds</span>
      </div>
      <div className="p-3">
        <Skeleton className="h-[320px] w-full" />
      </div>
    </section>
  );
}
