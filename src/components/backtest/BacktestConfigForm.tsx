'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertTriangle, Check, ChevronDown, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { BACKTEST_INTERVALS as INTERVALS, BACKTEST_INTERVAL_REGEX_SOURCE } from '@/lib/constants';
import { useAccountStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { BACKTEST_MIN_NOTIONAL_USDT } from '@/lib/backtest/buildBacktestPayload';
import { cn } from '@/lib/utils';
import type { BacktestWizardConfig } from '@/types/backtest';
import type { AccountStrategy } from '@/types/strategy';

const COMMON_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT'];

/** Sentinel for the per-strategy interval Select's "use primary" option.
 *  Radix's Select.Item rejects value="" because that string is reserved
 *  for "show placeholder / clear selection" — we use a non-empty token
 *  internally and translate it back to '' before storing in state. */
const INHERIT_PRIMARY = '__inherit_primary__';

const configSchema = z
  .object({
    symbol: z.string().trim().min(3, 'Symbol is required'),
    interval: z.string().min(1, 'Interval is required'),
    fromDate: z.string().min(1, 'From date is required'),
    toDate: z.string().min(1, 'To date is required'),
    initialCapital: z
      .number({ error: 'Initial capital is required' })
      .min(100, 'Minimum $100 USDT'),
    strategyCodes: z.array(z.string()).min(1, 'Select at least one strategy'),
    strategyAccountStrategyIds: z.record(z.string(), z.string()),
    maxConcurrentStrategies: z
      .number()
      .int()
      .min(1, 'Must allow at least 1 concurrent strategy')
      .max(20, 'Cap is 20 concurrent strategies')
      .optional(),
    strategyAllocations: z.record(z.string(), z.number().positive().max(100)).optional(),
    strategyIntervals: z
      .record(
        z.string(),
        z
          .string()
          .regex(
            new RegExp(BACKTEST_INTERVAL_REGEX_SOURCE),
            'interval must be 5m or coarser (backtest monitor tick is 5m)',
          ),
      )
      .optional(),
    evaluationMode: z.enum(['single', 'multi']).optional(),
    allowLong: z.boolean(),
    allowShort: z.boolean(),
  })
  .refine((d) => d.toDate > d.fromDate, {
    message: 'To date must be after From date',
    path: ['toDate'],
  })
  .refine((d) => d.strategyCodes.every((code) => Boolean(d.strategyAccountStrategyIds[code])), {
    message: 'Every selected strategy needs an account-strategy',
    path: ['strategyAccountStrategyIds'],
  })
  .refine((d) => d.allowLong || d.allowShort, {
    message: 'At least one direction (long or short) must be allowed',
    path: ['allowLong'],
  });

type FormErrors = Partial<Record<string, string>>;

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickDefaultAccountStrategy(
  candidates: AccountStrategy[],
  scopedAccountId: string | undefined,
): AccountStrategy | null {
  if (candidates.length === 0) return null;
  if (scopedAccountId) {
    const scoped = candidates.find((c) => c.accountId === scopedAccountId);
    if (scoped) return scoped;
  }
  return candidates[0];
}

export function BacktestConfigForm() {
  const router = useRouter();
  const savedConfig = useBacktestParamStore((s) => s.config);
  const setConfig = useBacktestParamStore((s) => s.setConfig);
  const { data: strategies = [], isLoading: strategiesLoading } = useAccountStrategies();
  const { data: definitions = [], isLoading: definitionsLoading } = useStrategyDefinitions();
  const { scopedAccountId } = useActiveAccount();

  // Source of truth for which strategies the user can pick is the
  // strategy_definition catalogue, filtered to ACTIVE rows. DEPRECATED /
  // INACTIVE definitions are hidden from the picker but remain valid in
  // historical backtest_run rows.
  const activeDefinitions = useMemo(
    () =>
      definitions
        .filter((d) => d.status === 'ACTIVE')
        .slice()
        .sort((a, b) => a.strategyCode.localeCompare(b.strategyCode)),
    [definitions],
  );

  const [symbol, setSymbol] = useState<string>(savedConfig?.symbol ?? 'BTCUSDT');
  const [interval, setInterval] = useState<string>(savedConfig?.interval ?? '1h');
  const [fromDate, setFromDate] = useState<string>(savedConfig?.fromDate ?? defaultFromDate());
  const [toDate, setToDate] = useState<string>(savedConfig?.toDate ?? defaultToDate());
  const [initialCapital, setInitialCapital] = useState<string>(
    savedConfig ? String(savedConfig.initialCapital) : '10000',
  );
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(
    savedConfig?.strategyCodes ?? [],
  );
  const [strategyAccountStrategyIds, setStrategyAccountStrategyIds] = useState<
    Record<string, string>
  >(savedConfig?.strategyAccountStrategyIds ?? {});
  // Phase A — multi-strategy controls.
  const [maxConcurrentStrategies, setMaxConcurrentStrategies] = useState<string>(
    savedConfig?.maxConcurrentStrategies != null
      ? String(savedConfig.maxConcurrentStrategies)
      : '1',
  );
  const [strategyAllocations, setStrategyAllocations] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(savedConfig?.strategyAllocations ?? {}).map(([code, pct]) => [
        code,
        String(pct),
      ]),
    ),
  );
  // Per-strategy interval. Blank string = "use primary interval".
  const [strategyIntervals, setStrategyIntervals] = useState<Record<string, string>>(
    savedConfig?.strategyIntervals ?? {},
  );
  // 'single': all strategies share the primary interval.
  // 'multi': each strategy's interval is auto-filled from its AccountStrategy,
  // making interval mismatch impossible by construction.
  const [evaluationMode, setEvaluationMode] = useState<'single' | 'multi'>(
    savedConfig?.evaluationMode ?? 'single',
  );
  // Direction toggles. Default long-only — most strategies in the book are
  // long-favored on BTC's structural bull regime, and the backend's null
  // → TRUE default would silently allow shorts on a strategy not validated
  // for them. Explicit user choice from the form is the safe default.
  const [allowLong, setAllowLong] = useState<boolean>(savedConfig?.allowLong ?? true);
  const [allowShort, setAllowShort] = useState<boolean>(savedConfig?.allowShort ?? false);
  const [errors, setErrors] = useState<FormErrors>({});

  const strategyOptionsByCode = useMemo(() => {
    const map = new Map<string, AccountStrategy[]>();
    for (const def of activeDefinitions) map.set(def.strategyCode, []);
    for (const s of strategies) {
      if (!map.has(s.strategyCode)) map.set(s.strategyCode, []);
      map.get(s.strategyCode)!.push(s);
    }
    return map;
  }, [activeDefinitions, strategies]);

  // When the user ticks a strategy, auto-pick the best-matching AccountStrategy
  // (scoped account first, then any). When unticked, drop its id.
  const toggleStrategy = useCallback(
    (code: string) => {
      setSelectedStrategies((prev) => {
        if (prev.includes(code)) {
          setStrategyAccountStrategyIds((ids) => {
            const next = { ...ids };
            delete next[code];
            return next;
          });
          return prev.filter((c) => c !== code);
        }
        const candidates = strategyOptionsByCode.get(code) ?? [];
        const pick = pickDefaultAccountStrategy(candidates, scopedAccountId);
        if (pick) {
          setStrategyAccountStrategyIds((ids) => ({ ...ids, [code]: pick.id }));
        }
        return [...prev, code];
      });
    },
    [strategyOptionsByCode, scopedAccountId],
  );

  const setStrategyAccountStrategyId = useCallback((code: string, id: string) => {
    setStrategyAccountStrategyIds((ids) => ({ ...ids, [code]: id }));
  }, []);

  // Map every assigned account-strategy back to its interval so we can flag
  // mismatches. Result type is `Array<{ code, interval }>` for the strategies
  // that don't agree with the form's interval.
  const strategyById = useMemo(() => {
    const m = new Map<string, AccountStrategy>();
    for (const s of strategies) m.set(s.id, s);
    return m;
  }, [strategies]);

  // Phase B2 — track manual overrides so we can restore them when the
  // user toggles multi → single. Multi mode auto-fills strategyIntervals
  // from the registered AccountStrategy, but those auto-fills shouldn't
  // persist as silent "manual overrides" once the user switches back.
  const intervalsBeforeMultiRef = useRef<Record<string, string>>({});
  const prevModeRef = useRef<'single' | 'multi'>(evaluationMode);

  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev !== 'multi' && evaluationMode === 'multi') {
      // single → multi: snapshot user's manual overrides BEFORE the
      // auto-fill effect mutates them.
      intervalsBeforeMultiRef.current = { ...strategyIntervals };
    } else if (prev === 'multi' && evaluationMode === 'single') {
      // multi → single: drop the auto-filled overrides; restore the
      // manual overrides that were active before entering multi.
      setStrategyIntervals(intervalsBeforeMultiRef.current);
    }
    prevModeRef.current = evaluationMode;
    // strategyIntervals intentionally excluded from deps — we only want
    // to react to mode transitions, not to value updates within a mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationMode]);

  // Phase B2 — when the user picks 'multi' mode, auto-populate
  // strategyIntervals from each strategy's registered AccountStrategy
  // interval. This keeps effective interval == registered for every
  // strategy by construction, so the mismatch warning never has anything
  // to flag. Re-runs whenever selection or AccountStrategy picks change.
  useEffect(() => {
    if (evaluationMode !== 'multi') return;
    setStrategyIntervals((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const code of selectedStrategies) {
        const id = strategyAccountStrategyIds[code];
        const accStrat = id ? strategyById.get(id) : null;
        if (accStrat && accStrat.interval && next[code] !== accStrat.interval) {
          next[code] = accStrat.interval;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [evaluationMode, selectedStrategies, strategyAccountStrategyIds, strategyById]);

  // Phase B2 — a strategy's "effective interval" is its per-strategy
  // override when set, otherwise the wizard's primary interval. Mismatch
  // exists when the assigned account-strategy is registered on a
  // different timeframe than its effective interval. In 'multi' mode
  // mismatches are impossible by construction (effect above), so we
  // short-circuit to an empty list.
  const intervalMismatches = useMemo(() => {
    if (evaluationMode === 'multi') return [];
    const out: Array<{ code: string; registered: string; effective: string }> = [];
    for (const code of selectedStrategies) {
      const id = strategyAccountStrategyIds[code];
      if (!id) continue;
      const accStrat = strategyById.get(id);
      if (!accStrat || !accStrat.interval) continue;
      const effective = strategyIntervals[code] || interval;
      if (accStrat.interval !== effective) {
        out.push({ code, registered: accStrat.interval, effective });
      }
    }
    return out;
  }, [
    evaluationMode,
    selectedStrategies,
    strategyAccountStrategyIds,
    strategyById,
    interval,
    strategyIntervals,
  ]);

  // Phase A — sum of allocations across selected strategies. > 100 is
  // legal at the API level (backend canonicaliseAllocations doesn't
  // enforce a sum cap), but every strategy after the first to hit the
  // balance ceiling silently fails its order. Surface the over-allocation
  // up-front so the user understands what'll happen at runtime.
  const allocationSumPct = useMemo(() => {
    let total = 0;
    for (const code of selectedStrategies) {
      const raw = strategyAllocations[code];
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) total += n;
    }
    return total;
  }, [selectedStrategies, strategyAllocations]);

  // Phase A — flag strategies whose allocated capital is below the
  // backtest's default min notional ($7). Without this guard the executor
  // floors the order to min-notional, which inflates the strategy's real
  // exposure above the user's intended slice — multi-strategy runs on
  // small balances over-allocate the book. We use the same DEFAULT_SIZING
  // floor the payload uses so the warning matches what'll happen.
  const tinyAllocationCodes = useMemo(() => {
    const capital = Number(initialCapital);
    if (!Number.isFinite(capital) || capital <= 0) return [];
    const out: Array<{ code: string; pct: number; sliceUsdt: number }> = [];
    for (const code of selectedStrategies) {
      const raw = strategyAllocations[code];
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) continue; // blank = falls back to AccountStrategy default — skip
      const slice = (capital * n) / 100;
      if (slice < BACKTEST_MIN_NOTIONAL_USDT) {
        out.push({ code, pct: n, sliceUsdt: slice });
      }
    }
    return out;
  }, [selectedStrategies, strategyAllocations, initialCapital]);

  // The shared-fix button (sets the wizard's primary interval) only
  // makes sense when every mismatched strategy is registered on the same
  // timeframe AND none of them already have a per-strategy override.
  const sharedRegisteredInterval = useMemo(() => {
    if (intervalMismatches.length === 0) return null;
    const first = intervalMismatches[0].registered;
    const allSame = intervalMismatches.every((m) => m.registered === first);
    const noOverrides = intervalMismatches.every((m) => !strategyIntervals[m.code]);
    return allSame && noOverrides ? first : null;
  }, [intervalMismatches, strategyIntervals]);

  const handleSubmit = useCallback(() => {
    // Trim allocations to only the strategies actually selected — drops
    // stale entries left from earlier ticks of the form.
    const allocs: Record<string, number> = {};
    for (const code of selectedStrategies) {
      const raw = strategyAllocations[code];
      if (raw == null || raw === '') continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0 && n <= 100) {
        allocs[code] = n;
      }
    }

    // Same trim for per-strategy intervals: only carry entries for
    // currently-selected strategies, drop blanks (= "use primary").
    const intervals: Record<string, string> = {};
    for (const code of selectedStrategies) {
      const v = strategyIntervals[code];
      if (typeof v === 'string' && v.trim() !== '') intervals[code] = v.trim();
    }

    const parsed = configSchema.safeParse({
      symbol: symbol.trim().toUpperCase(),
      interval,
      fromDate,
      toDate,
      initialCapital: Number(initialCapital),
      strategyCodes: selectedStrategies,
      strategyAccountStrategyIds,
      maxConcurrentStrategies: Number(maxConcurrentStrategies) || undefined,
      strategyAllocations: Object.keys(allocs).length ? allocs : undefined,
      strategyIntervals: Object.keys(intervals).length ? intervals : undefined,
      evaluationMode,
      allowLong,
      allowShort,
    });

    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    const config: BacktestWizardConfig = parsed.data;
    setConfig(config);
    setErrors({});
    router.push('/backtest/new/params');
  }, [
    symbol,
    interval,
    fromDate,
    toDate,
    initialCapital,
    selectedStrategies,
    strategyAccountStrategyIds,
    maxConcurrentStrategies,
    strategyAllocations,
    strategyIntervals,
    evaluationMode,
    allowLong,
    allowShort,
    setConfig,
    router,
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mm-mint)',
              fontFamily: 'var(--mm-mono)',
            }}
          >
            New backtest
          </div>
          <h1
            className="mm-display"
            style={{
              marginTop: 6,
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              fontWeight: 800,
              color: 'var(--mm-ink-0)',
            }}
          >
            Configure run
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: 'var(--mm-ink-2)' }}>
            Step 1 of 2. Review parameters on the next screen before submitting.
          </p>
        </div>
        <WizardBreadcrumb current="config" />
      </header>

      <section className="rounded-xl border border-bd-subtle bg-bg-surface">
        <SectionHeader title="Market & Range" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Symbol" error={errors.symbol}>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="h-9 font-mono"
              list="bt-symbols"
              placeholder="BTCUSDT"
            />
            <datalist id="bt-symbols">
              {COMMON_SYMBOLS.map((s) => (
                // Datalist options are not user-facing controls themselves —
                // eslint's control-has-associated-label rule doesn't know that.
                // eslint-disable-next-line jsx-a11y/control-has-associated-label
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field
            label="Interval"
            error={errors.interval}
            hint="Must match the interval of every selected account-strategy."
          >
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="h-9 font-mono">
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
          </Field>

          <Field label="From Date" error={errors.fromDate}>
            <DatePicker value={fromDate} onChange={setFromDate} max={toDate} className="h-9" />
          </Field>

          <Field label="To Date" error={errors.toDate}>
            <DatePicker value={toDate} onChange={setToDate} min={fromDate} className="h-9" />
          </Field>

          <Field label="Initial Capital (USDT)" error={errors.initialCapital}>
            <Input
              type="number"
              inputMode="decimal"
              step="100"
              min="100"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              className="num h-9"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-bd-subtle bg-bg-surface">
        <SectionHeader
          title="Direction"
          hint={
            allowLong && allowShort
              ? 'Long + short'
              : allowLong
                ? 'Long-only'
                : allowShort
                  ? 'Short-only'
                  : 'No direction selected'
          }
        />
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={allowLong} onCheckedChange={setAllowLong} />
              <Label className="font-mono text-xs uppercase tracking-wider">Allow Long</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allowShort} onCheckedChange={setAllowShort} />
              <Label className="font-mono text-xs uppercase tracking-wider">Allow Short</Label>
            </div>
          </div>
          <p className="text-[11px] text-text-muted">
            Backend defaults missing flags to long+short. The wizard now sends your explicit choice
            so a strategy not validated for shorts (e.g. trend followers in a structural bull
            regime) can be safely run long-only without touching the strategy code.
          </p>
          {errors.allowLong && (
            <p className="text-xs text-[var(--color-warning)]">{errors.allowLong}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-bd-subtle bg-bg-surface">
        <SectionHeader
          title="Strategies"
          hint={
            selectedStrategies.length > 0
              ? `${selectedStrategies.length} selected`
              : 'Select one or more'
          }
        />

        {definitionsLoading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-[12px] text-text-muted">
            <Loader2 size={12} strokeWidth={1.75} className="animate-spin" />
            Loading strategies…
          </div>
        ) : activeDefinitions.length === 0 ? (
          <div className="flex items-start gap-2 px-5 py-6 text-[12px] text-text-secondary">
            <AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
            No active strategies in the catalogue. Register one in the strategy definitions admin
            page first.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 lg:grid-cols-6">
            {activeDefinitions.map((def) => {
              const code = def.strategyCode;
              const selected = selectedStrategies.includes(code);
              const candidates = strategyOptionsByCode.get(code) ?? [];
              const noneAvailable = !strategiesLoading && candidates.length === 0;
              return (
                <StrategyChip
                  key={code}
                  code={code}
                  name={def.strategyName}
                  selected={selected}
                  disabled={noneAvailable}
                  onToggle={() => toggleStrategy(code)}
                />
              );
            })}
          </div>
        )}

        {errors.strategyCodes && (
          <p className="border-t border-bd-subtle bg-tint-loss px-5 py-2 text-[11px] text-loss">
            {errors.strategyCodes}
          </p>
        )}

        {selectedStrategies.length > 0 && (
          <div className="border-t border-bd-subtle px-5 py-4">
            {/* Phase B2 — backtest mode toggle. 'multi' auto-resolves each
                 strategy's interval from its registered AccountStrategy and
                 suppresses the mismatch warning by construction. */}
            <div className="pb-4">
              <p className="label-caps pb-2">Backtest mode</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label
                  className={cn(
                    'flex flex-1 cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors',
                    evaluationMode === 'single'
                      ? 'border-profit bg-tint-profit'
                      : 'border-bd-subtle bg-bg-base hover:border-bd hover:bg-bg-hover',
                  )}
                >
                  <input
                    type="radio"
                    name="evaluationMode"
                    value="single"
                    checked={evaluationMode === 'single'}
                    onChange={() => setEvaluationMode('single')}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-text-primary">Single timeframe</p>
                    <p className="text-[11px] text-text-muted">
                      Every strategy runs on the primary interval below. Warns when a
                      strategy&apos;s registered interval differs.
                    </p>
                  </div>
                </label>
                <label
                  className={cn(
                    'flex flex-1 cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors',
                    evaluationMode === 'multi'
                      ? 'border-profit bg-tint-profit'
                      : 'border-bd-subtle bg-bg-base hover:border-bd hover:bg-bg-hover',
                  )}
                >
                  <input
                    type="radio"
                    name="evaluationMode"
                    value="multi"
                    checked={evaluationMode === 'multi'}
                    onChange={() => setEvaluationMode('multi')}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-text-primary">Multi-interval</p>
                    <p className="text-[11px] text-text-muted">
                      Each strategy runs on its registered timeframe automatically. e.g. LSR @ 15m +
                      VCB @ 1h in one run.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <p className="label-caps pb-3">Account-strategy assignment</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {selectedStrategies.map((code) => {
                const candidates = strategyOptionsByCode.get(code) ?? [];
                const currentId = strategyAccountStrategyIds[code] ?? '';
                const noneAvailable = !strategiesLoading && candidates.length === 0;
                return (
                  <AccountStrategyPicker
                    key={code}
                    code={code}
                    candidates={candidates}
                    value={currentId}
                    loading={strategiesLoading}
                    noneAvailable={noneAvailable}
                    onChange={(id) => setStrategyAccountStrategyId(code, id)}
                  />
                );
              })}
            </div>
            {errors.strategyAccountStrategyIds && (
              <p className="mt-3 text-[11px] text-loss">{errors.strategyAccountStrategyIds}</p>
            )}

            {/* Phase A — concurrent cap + per-strategy allocation overrides. */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-bd-subtle pt-4 lg:grid-cols-3">
              <Field label="Max concurrent strategies">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  value={maxConcurrentStrategies}
                  onChange={(e) => setMaxConcurrentStrategies(e.target.value)}
                  className="num h-9"
                />
                <p className="mt-1 text-[10px] text-text-muted">
                  Cap on simultaneous open trades across all strategies.
                </p>
              </Field>
              <div className="lg:col-span-2">
                <p className="label-caps pb-2">Per-strategy allocation + interval</p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedStrategies.map((code) => (
                    <div
                      key={code}
                      className="grid grid-cols-[5rem_1fr_auto_5rem] items-center gap-2"
                    >
                      <span className="truncate font-mono text-[11px] font-semibold text-text-primary">
                        {code}
                      </span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={5}
                          placeholder="from account"
                          value={strategyAllocations[code] ?? ''}
                          onChange={(e) =>
                            setStrategyAllocations((prev) => ({
                              ...prev,
                              [code]: e.target.value,
                            }))
                          }
                          className="num h-8 flex-1"
                        />
                        <span className="text-[10px] text-text-muted">%</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-text-muted">
                        on
                      </span>
                      <Select
                        // Radix forbids value="" — use a sentinel for "use
                        // primary" and translate on both edges. Stored
                        // state still holds "" or a real interval, so the
                        // submit-time trim logic stays unchanged.
                        // In 'multi' mode the picker is locked to the
                        // strategy's registered interval (auto-filled by
                        // the effect above) — disabled to avoid drift.
                        value={strategyIntervals[code] ? strategyIntervals[code] : INHERIT_PRIMARY}
                        onValueChange={(value) =>
                          setStrategyIntervals((prev) => ({
                            ...prev,
                            [code]: value === INHERIT_PRIMARY ? '' : value,
                          }))
                        }
                        disabled={evaluationMode === 'multi'}
                      >
                        <SelectTrigger className="h-8 font-mono text-[11px]">
                          <SelectValue placeholder={interval} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_PRIMARY}>Use primary ({interval})</SelectItem>
                          {INTERVALS.map((i) => (
                            <SelectItem key={i} value={i}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-text-muted">
                  Allocation blank → falls back to{' '}
                  <span className="font-mono">account_strategy.capital_allocation_pct</span>.
                  Interval blank → uses the primary <span className="font-mono">{interval}</span>.
                  Sizing per strategy is <span className="font-mono">balance × allocation</span>.
                </p>
              </div>
            </div>

            {allocationSumPct > 100 && (
              <div className="mt-3 flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2.5">
                <AlertTriangle
                  size={12}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <p className="text-[11px] text-text-primary">
                  <span className="font-semibold">
                    Allocations sum to {allocationSumPct.toFixed(1)}%.
                  </span>{' '}
                  Strategies are evaluated in order; once the balance is exhausted, later trades
                  silently fail their balance check. Reduce overlap so the total is ≤&nbsp;100%.
                </p>
              </div>
            )}

            {tinyAllocationCodes.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2.5">
                <AlertTriangle
                  size={12}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[11px] text-text-primary">
                    <span className="font-semibold">Allocation below min-notional.</span> The
                    executor floors orders to{' '}
                    <span className="font-mono">{BACKTEST_MIN_NOTIONAL_USDT} USDT</span>, which
                    over-allocates these strategies vs your intended slice:
                  </p>
                  <ul className="flex flex-col gap-0.5 text-[11px] text-text-primary">
                    {tinyAllocationCodes.map((t) => (
                      <li key={t.code} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{t.code}</span>
                        <span className="text-text-muted">
                          {t.pct.toFixed(1)}% ={' '}
                          <span className="font-mono text-text-primary">
                            {t.sliceUsdt.toFixed(2)} USDT
                          </span>{' '}
                          → floored to{' '}
                          <span className="font-mono text-text-primary">
                            {BACKTEST_MIN_NOTIONAL_USDT.toFixed(2)} USDT
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-text-muted">
                    Increase the allocation, or raise initial capital so each slice clears the
                    min-notional floor.
                  </p>
                </div>
              </div>
            )}

            {intervalMismatches.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2.5">
                <AlertTriangle
                  size={12}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-[11px] text-text-primary">
                    <span className="font-semibold">Interval mismatch.</span> Strategy params are
                    calibrated for a specific timeframe; running on a different bar produces invalid
                    results.
                  </p>
                  <ul className="flex flex-col gap-1.5 text-[11px] text-text-primary">
                    {intervalMismatches.map((m) => (
                      <li key={m.code} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{m.code}</span>
                        <span className="text-text-muted">
                          registered on{' '}
                          <span className="font-mono font-semibold text-text-primary">
                            {m.registered}
                          </span>
                          , would run on{' '}
                          <span className="font-mono font-semibold text-text-primary">
                            {m.effective}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStrategyIntervals((prev) => ({
                              ...prev,
                              [m.code]: m.registered,
                            }))
                          }
                          className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-0.5 font-mono text-[10px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
                        >
                          Run {m.code} on {m.registered}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {sharedRegisteredInterval && (
                    <button
                      type="button"
                      onClick={() => setInterval(sharedRegisteredInterval)}
                      className="self-start rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[10px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
                    >
                      Or set the primary interval to {sharedRegisteredInterval}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/backtest')}
          className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm bg-profit px-3 py-2 text-[12px] font-semibold text-text-inverse',
            'transition-opacity duration-fast hover:opacity-90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          Next: Configure Params
          <ArrowRight size={13} strokeWidth={2} />
        </button>
      </footer>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-bd-subtle px-5 py-3">
      <h2 className="label-caps">{title}</h2>
      {hint && <span className="label-caps !text-[9px]">{hint}</span>}
    </div>
  );
}

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
    <div className="flex flex-col gap-1.5">
      <Label className="label-caps !text-[9px]">{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] text-loss">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function StrategyChip({
  code,
  name,
  selected,
  disabled,
  onToggle,
}: {
  code: string;
  name?: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      title={
        disabled ? `No account-strategy configured for ${code}` : name ? `${code} — ${name}` : code
      }
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-profit bg-tint-profit text-text-primary'
          : 'border-bd-subtle bg-bg-base text-text-secondary hover:border-bd hover:bg-bg-hover hover:text-text-primary',
        disabled && 'cursor-not-allowed opacity-50 hover:border-bd-subtle hover:bg-bg-base',
      )}
    >
      <span className="truncate font-mono text-[11px] font-semibold">{code}</span>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm',
          selected ? 'bg-profit text-text-inverse' : 'border border-bd-subtle text-transparent',
        )}
      >
        <Check size={10} strokeWidth={2.5} />
      </span>
      {disabled && (
        <AlertTriangle
          size={10}
          strokeWidth={1.75}
          className="absolute right-1 top-1 text-warning"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function AccountStrategyPicker({
  code,
  candidates,
  value,
  loading,
  noneAvailable,
  onChange,
}: {
  code: string;
  candidates: AccountStrategy[];
  value: string;
  loading: boolean;
  noneAvailable: boolean;
  onChange: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[11px] text-text-muted">
        <Loader2 size={11} strokeWidth={1.75} className="animate-spin" />
        Loading strategies…
      </div>
    );
  }

  if (noneAvailable) {
    return (
      <div className="flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2">
        <AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] font-semibold text-text-primary">{code}</p>
          <p className="text-[11px] text-text-secondary">
            No account-strategy uses this code. Add one on the Strategies page first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-text-primary">{code}</span>
        <ChevronDown size={10} strokeWidth={1.75} className="text-text-muted" />
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-[12px]">
          <SelectValue placeholder="Select account-strategy" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2 text-[12px]">
                <span className="font-mono">{c.symbol}</span>
                <span className="font-mono text-text-muted">· {c.interval}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
