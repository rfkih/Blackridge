'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Play, Plus, X } from 'lucide-react';
import { useCreateSweep, useStrategyDefaults } from '@/hooks/useResearch';
import { useStrategies } from '@/hooks/useStrategies';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { AccountStrategy } from '@/types/strategy';
import type { ParamRange, SweepSpec } from '@/types/research';

/**
 * Research-mode backtest wizard. Instead of picking a single value per
 * parameter, you pick a range (min/max/step) and the number of rounds to
 * iterate. The backend expands round 1 from the ranges, runs every combo,
 * picks top {@code elitePct}, refines ±1 step around each elite, and repeats.
 *
 * <p>On submit, redirects to the existing sweep detail page which already
 * renders a leaderboard with round markers.
 */

interface RangeEntry {
  key: string;
  min: string;
  max: string;
  step: string;
}


const TODAY = new Date().toISOString().slice(0, 10);
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Curated starter dimensions per strategy. Three independent params each:
// one regime/threshold gate, one trigger-quality filter, one stop sizing.
// All keys MUST exist in the matching strategy's defaults — the form derives
// each row's min/max/step from the actual default value at runtime, so
// changing a default on the backend updates the starter ranges automatically.
const STARTER_KEYS_BY_CODE: Record<string, string[]> = {
  TPR: ['adxEntryMin', 'clvMin', 'stopAtrBuffer'],
  VCB: ['adxEntryMax', 'relVolBreakoutMin', 'stopAtrBuffer'],
  LSR: ['adxEntryMin', 'longSweepRsiMin', 'stopAtrBuffer'],
};

/** Strategies whose backend param service consumes BacktestParamOverrideContext.
 *  TPR does so through ResearchParamService + explicit setters; VCB/LSR through
 *  their param services' merge() paths. Kept in sync with the same Set on the
 *  backend validator. */
const RESEARCHABLE_CODES = new Set(['TPR', 'VCB', 'LSR']);

export default function ResearchPage() {
  const router = useRouter();
  // Sweep needs an AccountStrategy id (backtest_run.account_strategy_id is NOT NULL).
  // We narrow the dropdown to AccountStrategy rows whose code is (a) registered
  // in the StrategyDefinition catalogue with status=ACTIVE, and (b) in the
  // research-capable allow-list. This matches the "only registered strategies
  // in research" rule — an AccountStrategy pointing at a code that never got
  // registered (or got DEPRECATED) won't appear here.
  const strategiesQ = useStrategies();
  const definitionsQ = useStrategyDefinitions();
  const activeDefCodes = new Set(
    (definitionsQ.data ?? [])
      .filter((d) => (d.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((d) => d.strategyCode),
  );
  const eligibleStrategies: AccountStrategy[] = (strategiesQ.data ?? []).filter(
    (s) => activeDefCodes.has(s.strategyCode) && RESEARCHABLE_CODES.has(s.strategyCode),
  );

  const [asset, setAsset] = useState('BTCUSDT');
  const [interval, setIntervalValue] = useState('1h');
  const [fromDate, setFromDate] = useState(ONE_YEAR_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [initialCapital, setInitialCapital] = useState('10000');
  const [accountStrategyId, setAccountStrategyId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [rounds, setRounds] = useState('3');
  const [elitePct, setElitePct] = useState('0.25');
  const [rankMetric, setRankMetric] =
    useState<NonNullable<SweepSpec['rankMetric']>>('avgR');
  const [ranges, setRanges] = useState<RangeEntry[]>([]);
  // Pinned overrides — keyed map of {paramName → user-typed value}. Every
  // available param is rendered in the editor pre-populated with its default;
  // this map only tracks the user's edits. On submit we only ship entries
  // whose typed value actually differs from the default (sending defaults
  // would just be noise on the wire and in the persisted spec).
  const [pinValues, setPinValues] = useState<Record<string, string>>({});
  const [pinFilter, setPinFilter] = useState('');
  // Section collapsed by default — most users never need to override a
  // single param off its default. Opens on demand.
  const [pinOpen, setPinOpen] = useState(false);

  // Resolve the strategyCode of the currently picked AccountStrategy. The
  // defaults loader keys off this; switching strategies refetches.
  const selectedStrategy = eligibleStrategies.find((s) => s.id === accountStrategyId);
  const selectedCode = selectedStrategy?.strategyCode ?? null;
  const defaultsQ = useStrategyDefaults(selectedCode);
  const defaults = defaultsQ.data ?? {};
  const availableKeys = Object.keys(defaults).sort();

  // When the selected strategy changes, pre-fill the form with that
  // strategy's curated starter dimensions, with each row's min/max/step
  // derived from the *actual default value* of that key. Only auto-rebuilds
  // when the form is empty or matches the previous strategy's auto-build,
  // so manual edits survive switching.
  const prevAutoRef = useRef<RangeEntry[] | null>(null);
  useEffect(() => {
    if (!selectedCode || !defaultsQ.data) return;
    const starters = STARTER_KEYS_BY_CODE[selectedCode] ?? [];
    const built: RangeEntry[] = starters
      .filter((k) => Number.isFinite(defaults[k]))
      .map((k) => ({ key: k, ...deriveRangeFromDefault(defaults[k]) }));

    const formIsEmpty = ranges.length === 0;
    const matchesPrevAuto =
      prevAutoRef.current && rangesEqual(ranges, prevAutoRef.current);

    if (formIsEmpty || matchesPrevAuto) {
      setRanges(built);
      prevAutoRef.current = built;
    }
    // We deliberately exclude `ranges` from deps — we only react to strategy /
    // defaults changes, not user typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, defaultsQ.data]);

  // Reset pinned overrides whenever the user picks a different strategy —
  // a TPR-tuned value would be meaningless under VCB's param schema.
  useEffect(() => {
    setPinValues({});
    setPinFilter('');
  }, [selectedCode]);

  const create = useCreateSweep();

  const round1Combos = estimateRound1Combos(ranges);

  const onSubmit = async () => {
    if (!accountStrategyId) {
      toast.error({ title: 'Pick an account strategy' });
      return;
    }
    const selected = eligibleStrategies.find((s) => s.id === accountStrategyId);
    if (!selected) {
      toast.error({ title: 'Selected account strategy is not in the eligible list' });
      return;
    }
    const paramRanges: Record<string, ParamRange> = {};
    for (const r of ranges) {
      const key = r.key.trim();
      const min = Number(r.min);
      const max = Number(r.max);
      const step = Number(r.step);
      if (!key || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
        continue;
      }
      paramRanges[key] = { min, max, step };
    }
    if (Object.keys(paramRanges).length === 0) {
      toast.error({ title: 'Define at least one parameter range' });
      return;
    }

    // Build pinned overrides — only include entries whose typed value parses
    // to a valid number AND differs from the default. Skip swept keys; the
    // sweep value would clobber the pin anyway.
    const fixedParams: Record<string, number> = {};
    for (const [key, raw] of Object.entries(pinValues)) {
      if (paramRanges[key]) continue;
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      const v = Number(trimmed);
      if (!Number.isFinite(v)) {
        toast.error({ title: `Pinned value for "${key}" is not a number` });
        return;
      }
      const def = defaults[key];
      if (Number.isFinite(def) && Math.abs(v - def) < 1e-9) continue;
      fixedParams[key] = v;
    }

    const roundsN = Math.max(2, Math.min(5, Number(rounds) || 3));
    const spec: SweepSpec = {
      strategyCode: selected.strategyCode,
      accountStrategyId,
      asset,
      interval,
      fromDate: `${fromDate}T00:00:00`,
      toDate: `${toDate}T00:00:00`,
      initialCapital: Number(initialCapital),
      label: label || undefined,
      paramRanges,
      fixedParams: Object.keys(fixedParams).length > 0 ? fixedParams : undefined,
      rounds: roundsN,
      elitePct: Number(elitePct) || 0.25,
      rankMetric,
    };

    try {
      const state = await create.mutateAsync(spec);
      toast.success({
        title: 'Research session started',
        description: `${state.totalCombos} combos queued in round 1 of ${roundsN}`,
      });
      router.push(`/research/sweeps/${state.sweepId}`);
    } catch (err) {
      toast.error({ title: 'Could not start research', description: normalizeError(err) });
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/backtest"
            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
          >
            <ArrowLeft size={12} /> Back to backtests
          </Link>
          <div className="mt-1 label-caps">BACKTEST · RESEARCH MODE</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Iterative research sweep
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] text-text-muted">
            Define a <strong>range</strong> per parameter (min / max / step) and a number of
            rounds. The system runs round 1 across the full grid, keeps the top{' '}
            <strong>{Math.round(Number(elitePct || 0.25) * 100)}%</strong> by {rankMetric}, refines
            around each elite, and repeats. Losing param combinations get eliminated automatically.
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-md border border-bd-subtle bg-bg-surface p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Asset">
            <input className="mm-input" value={asset} onChange={(e) => setAsset(e.target.value)} />
          </Field>
          <Field label="Interval">
            <input
              className="mm-input"
              value={interval}
              onChange={(e) => setIntervalValue(e.target.value)}
            />
          </Field>
          <Field label="Account strategy (registered + researchable)">
            <select
              className="mm-input"
              value={accountStrategyId}
              onChange={(e) => setAccountStrategyId(e.target.value)}
            >
              <option value="">— pick one —</option>
              {eligibleStrategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.strategyCode} · {s.symbol} {s.interval}
                  {s.presetName ? ` · ${s.presetName}` : ''}
                </option>
              ))}
            </select>
            {eligibleStrategies.length === 0 && (
              <span className="mt-1 text-[11px] text-[var(--color-warning)]">
                No eligible strategies. You need an AccountStrategy whose
                strategyCode is both registered (ACTIVE in /admin/strategies)
                and research-capable (TPR today).
              </span>
            )}
          </Field>
          <Field label="From date">
            <DatePicker value={fromDate} onChange={setFromDate} max={toDate} />
          </Field>
          <Field label="To date">
            <DatePicker value={toDate} onChange={setToDate} min={fromDate} />
          </Field>
          <Field label="Initial capital (USDT)">
            <input
              type="number"
              className="mm-input"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
            />
          </Field>
          <Field label="Rounds (2–5)">
            <input
              type="number"
              min={2}
              max={5}
              className="mm-input"
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
            />
          </Field>
          <Field label="Elite fraction (0..1)">
            <input
              type="number"
              step={0.05}
              min={0.05}
              max={1}
              className="mm-input"
              value={elitePct}
              onChange={(e) => setElitePct(e.target.value)}
            />
          </Field>
          <Field label="Rank metric">
            <select
              className="mm-input"
              value={rankMetric}
              onChange={(e) =>
                setRankMetric(e.target.value as NonNullable<SweepSpec['rankMetric']>)
              }
            >
              <option value="avgR">avg R</option>
              <option value="profitFactor">profit factor</option>
              <option value="netPnl">net PnL</option>
              <option value="winRate">win rate</option>
            </select>
          </Field>
          <Field label="Label (optional)">
            <input
              className="mm-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. trend-filter-hunt"
            />
          </Field>
        </div>

        <div>
          <div className="label-caps">Parameter ranges</div>
          <p className="text-[11px] text-text-muted">
            Round 1 expands every range into a grid. Each subsequent round picks the elite combos,
            builds a ±1-step neighbourhood in every dimension, and re-runs. Per-round cap: 256.
          </p>
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              <div>param</div>
              <div>min</div>
              <div>max</div>
              <div>step</div>
              <div />
            </div>
            {ranges.map((r, idx) => {
              const usedElsewhere = new Set(
                ranges.filter((_, i) => i !== idx).map((x) => x.key).filter(Boolean),
              );
              const def = Number.isFinite(defaults[r.key]) ? defaults[r.key] : null;
              return (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
                  <div className="flex flex-col">
                    <select
                      className="mm-input font-mono"
                      value={r.key}
                      disabled={!selectedCode || availableKeys.length === 0}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        const dv = Number.isFinite(defaults[newKey])
                          ? defaults[newKey]
                          : null;
                        setRanges((prev) =>
                          prev.map((x, i) => {
                            if (i !== idx) return x;
                            // Auto-derive min/max/step on key change so the
                            // user always starts from a sensible window.
                            if (dv != null) {
                              return { key: newKey, ...deriveRangeFromDefault(dv) };
                            }
                            return { ...x, key: newKey };
                          }),
                        );
                      }}
                    >
                      <option value="">— pick param —</option>
                      {availableKeys
                        .filter((k) => !usedElsewhere.has(k) || k === r.key)
                        .map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                    </select>
                    {def != null && (
                      <span className="mt-0.5 font-mono text-[10px] text-text-muted">
                        default {formatDefault(def)}
                      </span>
                    )}
                  </div>
                  <input
                    className="mm-input font-mono"
                    value={r.min}
                    onChange={(e) =>
                      setRanges((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, min: e.target.value } : x)),
                      )
                    }
                  />
                  <input
                    className="mm-input font-mono"
                    value={r.max}
                    onChange={(e) =>
                      setRanges((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, max: e.target.value } : x)),
                      )
                    }
                  />
                  <input
                    className="mm-input font-mono"
                    value={r.step}
                    onChange={(e) =>
                      setRanges((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, step: e.target.value } : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setRanges((prev) => prev.filter((_, i) => i !== idx))}
                    className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[12px] text-text-secondary hover:bg-bg-hover"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!selectedCode || defaultsQ.isLoading}
            onClick={() =>
              setRanges((prev) => [...prev, { key: '', min: '', max: '', step: '' }])
            }
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:opacity-50"
          >
            <Plus size={12} /> Add param
          </button>
          {selectedCode && defaultsQ.isLoading && (
            <div className="mt-2 text-[11px] text-text-muted">
              Loading {selectedCode} defaults…
            </div>
          )}
          {selectedCode && defaultsQ.isError && (
            <div className="mt-2 text-[11px] text-[var(--color-loss)]">
              Could not load defaults for {selectedCode}. Param dropdown will be empty.
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setPinOpen((v) => !v)}
            disabled={!selectedCode}
            className="group flex w-full items-center justify-between gap-3 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2 text-left transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center gap-2">
              {pinOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="label-caps !text-[10px]">
                Pinned overrides (optional)
              </span>
              {Object.keys(pinValues).filter((k) => {
                const typed = pinValues[k];
                if (typed === undefined || typed.trim() === '') return false;
                const v = Number(typed);
                const def = defaults[k];
                return Number.isFinite(v) && Number.isFinite(def) && Math.abs(v - def) > 1e-9;
              }).length > 0 && (
                <span
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[10px]"
                  style={{
                    background: 'rgba(245,166,35,0.12)',
                    color: 'var(--color-warning)',
                  }}
                >
                  {Object.keys(pinValues).filter((k) => {
                    const typed = pinValues[k];
                    if (typed === undefined || typed.trim() === '') return false;
                    const v = Number(typed);
                    const def = defaults[k];
                    return Number.isFinite(v) && Number.isFinite(def) && Math.abs(v - def) > 1e-9;
                  }).length} overridden
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-text-muted">
              {selectedCode
                ? pinOpen
                  ? 'collapse'
                  : 'expand to pin params'
                : 'pick a strategy first'}
            </span>
          </button>

          {pinOpen && (
            <div className="mt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-text-muted">
                Every param starts at its strategy default. Edit any value to
                pin it across all combos. Untouched params stay at default.
                Swept params are hidden (sweep value would override the pin).
              </p>
            </div>
            {Object.keys(pinValues).length > 0 && (
              <button
                type="button"
                onClick={() => setPinValues({})}
                className="text-[11px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
              >
                reset all to defaults
              </button>
            )}
          </div>

          {selectedCode && availableKeys.length > 0 && (
            <input
              className="mm-input font-mono mt-2 w-full md:w-72"
              placeholder="filter params…"
              value={pinFilter}
              onChange={(e) => setPinFilter(e.target.value)}
            />
          )}

          <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
            {(() => {
              const swept = new Set(ranges.map((r) => r.key).filter(Boolean));
              const filter = pinFilter.trim().toLowerCase();
              const visible = availableKeys
                .filter((k) => !swept.has(k))
                .filter((k) => !filter || k.toLowerCase().includes(filter));
              if (selectedCode && visible.length === 0) {
                return (
                  <div className="text-[11px] text-text-muted">
                    No params match the filter.
                  </div>
                );
              }
              return visible.map((k) => {
                const def = defaults[k];
                const typed = pinValues[k];
                const numeric = typed === undefined ? def : Number(typed);
                const dirty =
                  typed !== undefined &&
                  typed.trim() !== '' &&
                  Number.isFinite(numeric) &&
                  Math.abs(numeric - def) > 1e-9;
                return (
                  <div
                    key={k}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {dirty && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: 'var(--color-warning)' }}
                          title="overridden"
                        />
                      )}
                      <span className="truncate font-mono text-[12px] text-text-primary">
                        {k}
                      </span>
                    </div>
                    <input
                      className="mm-input font-mono w-24 text-right"
                      value={typed ?? formatDefault(def)}
                      onChange={(e) =>
                        setPinValues((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                      placeholder={formatDefault(def)}
                    />
                    {dirty ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPinValues((prev) => {
                            const next = { ...prev };
                            delete next[k];
                            return next;
                          })
                        }
                        className="text-[10px] text-text-muted hover:text-text-primary"
                        title="reset to default"
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <span className="w-3" />
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {selectedCode && defaultsQ.isLoading && (
            <div className="mt-2 text-[11px] text-text-muted">
              Loading {selectedCode} defaults…
            </div>
          )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-bd-subtle pt-3">
          <div className="text-[12px] text-text-muted">
            Round 1 size:{' '}
            <span className="font-mono text-text-primary">{round1Combos}</span>
            {round1Combos > 128 && round1Combos <= 256 && (
              <span className="ml-2 text-[var(--color-warning)]">
                big grid — expect ~{Math.round((round1Combos * 30) / 60)} min for round 1
              </span>
            )}
            {round1Combos > 256 && (
              <span className="ml-2 text-[var(--color-loss)]">exceeds 256 per-round cap</span>
            )}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={create.isPending || round1Combos > 256 || round1Combos === 0}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Start research session
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Build a sweep-friendly range centered on a parameter's default value:
 * ±20% with four steps. Precision is chosen by the value's magnitude so
 * integer-feeling defaults (RSI=35) get integer min/max/step and small
 * decimal defaults (clvMin=0.65) keep two decimals. The window is
 * intentionally narrow — the user is supposed to widen it explicitly when
 * they want to explore further from the current operating point.
 */
function deriveRangeFromDefault(value: number): {
  min: string;
  max: string;
  step: string;
} {
  if (!Number.isFinite(value) || value === 0) {
    return { min: '0', max: '1', step: '0.25' };
  }
  const abs = Math.abs(value);
  const decimals = abs >= 50 ? 0 : abs >= 5 ? 1 : abs >= 1 ? 2 : 3;
  const lo = value * 0.8;
  const hi = value * 1.2;
  const step = Math.max((hi - lo) / 4, Math.pow(10, -decimals));
  return {
    min: lo.toFixed(decimals),
    max: hi.toFixed(decimals),
    step: step.toFixed(decimals),
  };
}

function formatDefault(v: number): string {
  const abs = Math.abs(v);
  const decimals = abs >= 50 ? 0 : abs >= 5 ? 1 : abs >= 1 ? 2 : 3;
  return v.toFixed(decimals);
}

function rangesEqual(a: RangeEntry[], b: RangeEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false;
    if (a[i].min !== b[i].min) return false;
    if (a[i].max !== b[i].max) return false;
    if (a[i].step !== b[i].step) return false;
  }
  return true;
}

function estimateRound1Combos(ranges: RangeEntry[]): number {
  let product = 1;
  for (const r of ranges) {
    const min = Number(r.min);
    const max = Number(r.max);
    const step = Number(r.step);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
      return 0;
    }
    const n = Math.max(1, Math.floor((max - min) / step) + 1);
    product *= n;
    if (product > 10_000) return product;
  }
  return product;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      {children}
    </label>
  );
}
