'use client';

import { useMemo, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { AlertCircle, Download, Loader2, Play } from 'lucide-react';
import { z } from 'zod';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktestRuns } from '@/hooks/useBacktest';
import { useMonteCarlo } from '@/hooks/useMonteCarlo';
import { normalizeError } from '@/lib/api/client';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
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
    label: 'Bootstrap returns',
    hint: 'Draws N trades with replacement from the empirical distribution.',
  },
  {
    value: 'TRADE_SEQUENCE_SHUFFLE',
    label: 'Sequence shuffle',
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

export default function MonteCarloPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const runsQ = useBacktestRuns({ status: 'COMPLETED', size: 100 });
  const completedRuns = runsQ.data?.content ?? [];
  const totalCompleted = runsQ.data?.total ?? completedRuns.length;
  const isDropdownTruncated = totalCompleted > completedRuns.length;

  const mutation = useMonteCarlo();
  const result = mutation.data;

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

  // Copy for the header pill — "5,000 SIMULATIONS" from the latest result,
  // falling back to the currently-configured value in the form so the header
  // reads meaningfully even before a run fires.
  const simsForKicker = (
    result?.numberOfSimulations ?? (Number(form.numberOfSimulations) || 1000)
  ).toLocaleString();
  const horizonForChip = result?.tradesUsed ?? (Number(form.horizonTrades) || 100);

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Header — mirrors design pack 09 Monte Carlo ─── */}
      <section
        className="mm-card"
        style={{
          padding: '22px 28px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="mm-kicker">
            MONTE CARLO · {simsForKicker} SIMULATIONS
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            <h1
              className="font-display"
              style={{ fontSize: 32, letterSpacing: '-0.03em', lineHeight: 1 }}
            >
              Forward projection
            </h1>
            <span
              className="mm-chip"
              style={{
                background: 'var(--mm-mint-soft)',
                color: 'var(--mm-mint)',
                padding: '3px 10px',
                fontSize: 11,
                letterSpacing: '0.12em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {horizonForChip} TRADE HORIZON
            </span>
          </div>
          <div style={{ color: 'var(--mm-ink-2)', fontSize: 13, marginTop: 4 }}>
            {result
              ? `Bootstrapped from ${result.tradesUsed} trades · ${formatMode(result.simulationMode)} · seed ${result.effectiveSeed}`
              : 'Bootstrap or shuffle trades from a completed backtest to project forward equity distributions.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="mm-btn"
            disabled={!result}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={12} strokeWidth={1.75} /> Export paths
          </button>
          <button
            type="button"
            className="mm-btn mm-btn-mint"
            disabled={mutation.isPending || !form.backtestRunId}
            onClick={handleSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Running…
              </>
            ) : (
              <>
                <Play size={12} strokeWidth={2} /> Re-run ·{' '}
                {Number(form.numberOfSimulations).toLocaleString()}
              </>
            )}
          </button>
        </div>
      </section>

      {/* ─── Config form — compact; opens under the header like an inspector ─── */}
      <form
        onSubmit={handleSubmit}
        className="mm-card"
        style={{
          padding: '16px 22px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <Field
          label="Source backtest"
          error={errors.backtestRunId}
          hint={
            isDropdownTruncated
              ? `Showing 100 of ${totalCompleted} completed runs — older hidden.`
              : undefined
          }
        >
          <select
            value={form.backtestRunId}
            onChange={(e) => updateField('backtestRunId', e.target.value)}
            className="mm-input"
            style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}
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

        <Field label="Mode" error={errors.simulationMode}>
          <select
            value={form.simulationMode}
            onChange={(e) =>
              updateField('simulationMode', e.target.value as MonteCarloSimulationMode)
            }
            className="mm-input"
            style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            {SIM_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Initial capital (USDT)" error={errors.initialCapital}>
          <MmNumber
            value={form.initialCapital}
            onChange={(v) => updateField('initialCapital', v)}
            step="100"
            min="0"
          />
        </Field>

        <Field label="Simulations" error={errors.numberOfSimulations}>
          <MmNumber
            value={form.numberOfSimulations}
            onChange={(v) => updateField('numberOfSimulations', v)}
            step="100"
            min="100"
            max="100000"
          />
        </Field>

        <Field label="Horizon · trades" error={errors.horizonTrades}>
          <MmNumber
            value={form.horizonTrades}
            onChange={(v) => updateField('horizonTrades', v)}
            step="10"
            min="1"
          />
        </Field>

        <Field label="Ruin threshold %" error={errors.ruinThresholdPct}>
          <MmNumber
            value={form.ruinThresholdPct}
            onChange={(v) => updateField('ruinThresholdPct', v)}
            step="1"
            min="1"
            max="99"
          />
        </Field>

        <Field label="Max acceptable DD %" error={errors.maxAcceptableDrawdownPct}>
          <MmNumber
            value={form.maxAcceptableDrawdownPct}
            onChange={(v) => updateField('maxAcceptableDrawdownPct', v)}
            step="1"
            min="1"
            max="99"
          />
        </Field>

        {submitError && (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,122,122,0.4)',
              background: 'rgba(255,122,122,0.08)',
              color: 'var(--color-loss)',
              fontSize: 12,
            }}
          >
            <AlertCircle size={14} strokeWidth={1.75} /> {submitError}
          </div>
        )}
      </form>

      {/* ─── Results or running state ─── */}
      {mutation.isPending && <RunningSkeleton />}
      {result && !mutation.isPending && <Results result={result} />}
    </div>
  );
}

// ─── Results ────────────────────────────────────────────────────────────────

function Results({ result }: { result: MonteCarloResult }) {
  const formatCurrency = useCurrencyFormatter();
  return (
    <>
      {/* Paths chart — big card */}
      <section className="mm-card" style={{ padding: '26px 30px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div className="mm-kicker">
              PATHS · {formatCurrency(result.initialCapital)} INITIAL
            </div>
            <h2
              className="font-display"
              style={{ fontSize: 22, marginTop: 4, letterSpacing: '-0.02em' }}
            >
              Distribution of outcomes
            </h2>
          </div>
          <div
            className="font-mono"
            style={{
              display: 'flex',
              gap: 14,
              fontSize: 10,
              color: 'var(--mm-ink-3)',
              letterSpacing: '0.1em',
              flexWrap: 'wrap',
            }}
          >
            <span>— MEDIAN</span>
            <span style={{ color: 'var(--mm-mint)' }}>━ P90</span>
            <span style={{ color: 'var(--mm-dn)' }}>━ P10</span>
            <span>· {result.numberOfSimulations.toLocaleString()} PATHS</span>
          </div>
        </div>
        <ErrorBoundary label="Monte Carlo chart">
          <MonteCarloChart result={result} />
        </ErrorBoundary>
      </section>

      {/* Percentiles + histogram side-by-side */}
      <section
        className="grid gap-5"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}
      >
        <PercentileLedger result={result} />
        <TerminalDistribution result={result} />
      </section>
    </>
  );
}

// ─── Percentile ledger ──────────────────────────────────────────────────────

interface PercentileRow {
  label: string;
  value: number | null;
  /** Return % vs. initial capital (signed). */
  pct: number | null;
  /** Explicit color for the return %; falls back to profit/loss by sign. */
  color?: string;
  highlight?: boolean;
}

function PercentileLedger({ result }: { result: MonteCarloResult }) {
  const p = result.finalEquityPercentiles;
  const initial = result.initialCapital || 1;
  const formatCurrency = useCurrencyFormatter();

  // Pack wants P99/90/75/50/25/10/01 — backend may only return 5/10/25/50/75/90/95.
  // We take what we have and fall back cleanly; rows with no data render "—".
  const rows: PercentileRow[] = useMemo(() => {
    const readPct = (key: string) => {
      const v = p[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      return ((v - initial) / initial) * 100;
    };
    const read = (key: string) => (typeof p[key] === 'number' ? p[key] : null);
    return [
      { label: 'P99', value: read('P99'), pct: readPct('P99') },
      { label: 'P95', value: read('P95'), pct: readPct('P95') },
      { label: 'P90', value: read('P90'), pct: readPct('P90') },
      { label: 'P75', value: read('P75'), pct: readPct('P75') },
      {
        label: 'P50 · MEDIAN',
        value: read('P50') ?? result.medianFinalEquity,
        pct: result.medianTotalReturnPct,
        color: 'var(--mm-ink-0)',
        highlight: true,
      },
      { label: 'P25', value: read('P25'), pct: readPct('P25') },
      { label: 'P10', value: read('P10'), pct: readPct('P10') },
      { label: 'P05', value: read('P5'), pct: readPct('P5') },
      { label: 'P01', value: read('P1'), pct: readPct('P1') },
    ];
  }, [p, initial, result.medianFinalEquity, result.medianTotalReturnPct]);

  return (
    <div className="mm-card" style={{ padding: '22px 26px' }}>
      <div className="mm-kicker">PERCENTILES</div>
      <h2
        className="font-display"
        style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}
      >
        At +{result.tradesUsed} trades
      </h2>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 1fr',
              gap: 10,
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 8,
              background: r.highlight ? 'var(--mm-surface-2)' : 'transparent',
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                color: 'var(--mm-ink-3)',
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-num)',
                fontSize: 15,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {r.value == null ? '—' : formatCurrency(r.value)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-num)',
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                color:
                  r.color ??
                  (r.pct == null
                    ? 'var(--mm-ink-3)'
                    : r.pct >= 0
                      ? 'var(--mm-up)'
                      : 'var(--mm-dn)'),
              }}
            >
              {r.pct == null
                ? '—'
                : `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Terminal distribution (histogram) + 3-stat grid ───────────────────────

function TerminalDistribution({ result }: { result: MonteCarloResult }) {
  const { bars, axisLabels, medianIndex, firstLossIndex } = useMemo(
    () => buildHistogram(result),
    [result],
  );

  const cagr = useMemo(() => {
    // Horizon is trades, not years — the design's "Exp. CAGR" is a stretch
    // here because Monte Carlo projects a path in trade space, not calendar
    // space. We surface the mean total return as a CAGR-proxy to match the
    // design's labelling, with the understanding that users will read it in
    // context ("return over the horizon") rather than annualized.
    const r = result.meanTotalReturnPct;
    return `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
  }, [result.meanTotalReturnPct]);

  return (
    <div className="mm-card" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column' }}>
      <div className="mm-kicker">TERMINAL DISTRIBUTION</div>
      <h2
        className="font-display"
        style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}
      >
        Histogram of final equity
      </h2>

      {/* Bars */}
      <div
        role="img"
        aria-label="Histogram of simulated final equity"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          paddingTop: 20,
          minHeight: 160,
        }}
      >
        {bars.map((h, i) => {
          const isMedian = i === medianIndex;
          const isLoss = i < firstLossIndex;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                background: isMedian
                  ? 'var(--mm-mint)'
                  : isLoss
                    ? 'var(--mm-dn)'
                    : 'var(--mm-ink-2)',
                opacity: isMedian ? 1 : 0.55,
                borderRadius: '2px 2px 0 0',
                transition: 'height 120ms ease-out',
              }}
            />
          );
        })}
      </div>

      {/* Axis labels */}
      <div
        className="font-mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--mm-ink-3)',
          letterSpacing: '0.1em',
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--mm-hair)',
        }}
      >
        {axisLabels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>

      {/* Stat triplet */}
      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <MiniStat
          label="Prob. of profit"
          value={`${(result.probabilityOfProfit * 100).toFixed(1)}%`}
          color="var(--mm-up)"
        />
        <MiniStat
          label="Prob. of ruin"
          value={`${(result.probabilityOfRuin * 100).toFixed(1)}%`}
          color="var(--mm-dn)"
        />
        <MiniStat label="Exp. return" value={cagr} color="var(--mm-mint)" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--mm-surface-2)' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--mm-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-num)',
          fontSize: 17,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Bucket the percentile ladder into a 20-bar histogram. Mass between adjacent
 * percentiles is known exactly (e.g. P25→P50 carries 25% of samples); we slice
 * that mass into the equity buckets it covers. Bars are percent-of-total so
 * the tallest bar is ~100 regardless of sample count.
 */
function buildHistogram(result: MonteCarloResult): {
  bars: number[];
  axisLabels: string[];
  medianIndex: number;
  firstLossIndex: number;
} {
  const p = result.finalEquityPercentiles;
  // Ordered percentile anchors — only ones with a real numeric value make it in.
  const CANDIDATES: Array<[number, string[]]> = [
    [0.01, ['P1']],
    [0.05, ['P5']],
    [0.1, ['P10']],
    [0.25, ['P25']],
    [0.5, ['P50']],
    [0.75, ['P75']],
    [0.9, ['P90']],
    [0.95, ['P95']],
    [0.99, ['P99']],
  ];
  const anchors: Array<{ q: number; v: number }> = [];
  for (const [q, keys] of CANDIDATES) {
    for (const key of keys) {
      const v = p[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        anchors.push({ q, v });
        break;
      }
    }
  }
  // Add min/max so the axis covers the full range observed.
  if (anchors.length > 0) {
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (first && last) {
      if (first.q > 0 && Number.isFinite(result.minFinalEquity)) {
        anchors.unshift({ q: 0, v: Math.min(result.minFinalEquity, first.v) });
      }
      if (last.q < 1 && Number.isFinite(result.maxFinalEquity)) {
        anchors.push({ q: 1, v: Math.max(result.maxFinalEquity, last.v) });
      }
    }
  }

  const N_BARS = 20;
  const bars = new Array<number>(N_BARS).fill(0);

  const min = anchors[0]?.v ?? result.initialCapital * 0.5;
  const max = anchors[anchors.length - 1]?.v ?? result.initialCapital * 1.5;
  const range = Math.max(1e-9, max - min);

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (!a || !b) continue;
    const mass = b.q - a.q;
    const startFrac = (a.v - min) / range;
    const endFrac = (b.v - min) / range;
    const startIdx = Math.max(0, Math.min(N_BARS - 1, Math.floor(startFrac * N_BARS)));
    const endIdx = Math.max(0, Math.min(N_BARS - 1, Math.floor(endFrac * N_BARS)));
    const span = Math.max(1, endIdx - startIdx);
    const perBar = mass / span;
    for (let j = startIdx; j <= endIdx; j++) {
      bars[j] = (bars[j] ?? 0) + perBar;
    }
  }

  const maxBar = Math.max(...bars) || 1;
  const normalised = bars.map((b) => Math.round((b / maxBar) * 100));

  const medianEquity = p.P50 ?? result.medianFinalEquity;
  const medianIndex = Math.max(
    0,
    Math.min(N_BARS - 1, Math.floor(((medianEquity - min) / range) * N_BARS)),
  );
  const firstLossIndex = Math.max(
    0,
    Math.min(N_BARS - 1, Math.floor(((result.initialCapital - min) / range) * N_BARS)),
  );

  // Five evenly-spaced axis labels: min, q1, q2, q3, max.
  const axisLabels = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const v = min + range * frac;
    return `$${abbreviate(v)}`;
  });

  return { bars: normalised, axisLabels, medianIndex, firstLossIndex };
}

function abbreviate(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return value.toFixed(0);
}

function formatMode(mode: MonteCarloSimulationMode): string {
  if (mode === 'BOOTSTRAP_RETURNS') return 'bootstrap returns';
  if (mode === 'TRADE_SEQUENCE_SHUFFLE') return 'sequence shuffle';
  return mode;
}

// ─── Form primitives ────────────────────────────────────────────────────────

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
    // Nested association — the <label> wraps the control via children.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="flex flex-col gap-1">
      <span className="mm-label">{label}</span>
      {children}
      {error ? (
        <span style={{ fontSize: 11, color: 'var(--color-loss)' }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 11, color: 'var(--mm-ink-3)' }}>{hint}</span>
      ) : null}
    </label>
  );
}

function MmNumber({
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
      className="mm-input"
      style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-num)' }}
    />
  );
}

function RunningSkeleton() {
  return (
    <section className="mm-card" style={{ padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--mm-mint)' }} />
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--mm-ink-2)',
          }}
        >
          Running simulation · paths can take a few seconds
        </span>
      </div>
      <div style={{ marginTop: 16 }}>
        <Skeleton className="h-[320px] w-full" />
      </div>
    </section>
  );
}
