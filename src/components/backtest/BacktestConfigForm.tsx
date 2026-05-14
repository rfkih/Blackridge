'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertTriangle, Check, ChevronDown, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import {
  ALLOC_MAX_PCT,
  ALLOC_OPTIONS,
  BACKTEST_INTERVALS as INTERVALS,
  BACKTEST_INTERVAL_REGEX_SOURCE,
  RISK_OPTIONS,
} from '@/lib/constants';
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
const INHERIT_ALLOC   = '__inherit_alloc__';
const INHERIT_RISK    = '__inherit_risk__';
// V62 — tristate sentinel for the gate-override selects (Auto / On / Off).
// Picking "Auto" deletes the strategy's key from the override map so the
// backend falls back to account_strategy.<gate>_gate_enabled.
const INHERIT_GATE    = '__inherit_gate__';

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
    strategyAllocations: z.record(z.string(), z.number().positive().max(ALLOC_MAX_PCT)).optional(),
    /** V57 — per-strategy risk-pct override map. Fractional scale (0, 0.20]. */
    strategyRiskPcts: z.record(z.string(), z.number().positive().max(0.2)).optional(),
    /** V58 — per-strategy direction overrides. Both true and false are
     *  valid override values; key absent = "use bound AS's flag". */
    strategyAllowLong: z.record(z.string(), z.boolean()).optional(),
    strategyAllowShort: z.record(z.string(), z.boolean()).optional(),
    /** V62 — per-strategy risk-gate overrides. Same shape as
     *  strategyAllowLong: key present = explicit override for this run,
     *  key absent = "use the bound account_strategy's persisted toggle".
     *  Both `true` and `false` are valid override values. */
    strategyKillSwitchOverrides: z.record(z.string(), z.boolean()).optional(),
    strategyRegimeOverrides: z.record(z.string(), z.boolean()).optional(),
    strategyCorrelationOverrides: z.record(z.string(), z.boolean()).optional(),
    strategyConcurrentCapOverrides: z.record(z.string(), z.boolean()).optional(),
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
    // V58 — direction flags moved to per-strategy (sourced from each
    // strategy's bound account_strategy). Run-level fields are kept
    // wire-compatible but always sent as TRUE/TRUE so the resolver's
    // run-level fallback (used only for ad-hoc spec strategies without a
    // bound AS) stays permissive.
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
  // V57 — per-strategy risk-pct override (UI scale: percent, e.g. "5" =
  // 5%). Stored fractional on submit. Blank = "fall back to persisted
  // account_strategy.risk_pct" (and the persisted toggle).
  const [strategyRiskPcts, setStrategyRiskPcts] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(savedConfig?.strategyRiskPcts ?? {}).map(([code, frac]) => [
        code,
        // Saved value is fractional; UI shows percent.
        String(Number(frac) * 100),
      ]),
    ),
  );
  // V58 — per-strategy direction override maps. Key absent = "no override
  // → use bound account_strategy's flag" (matches live behaviour). Key
  // present = explicit override for this run (for research). Both `true`
  // and `false` are valid override values.
  const [strategyAllowLong, setStrategyAllowLong] = useState<Record<string, boolean>>(
    savedConfig?.strategyAllowLong ?? {},
  );
  const [strategyAllowShort, setStrategyAllowShort] = useState<Record<string, boolean>>(
    savedConfig?.strategyAllowShort ?? {},
  );
  // V62 — per-strategy risk-gate overrides. Same null-vs-bool semantics as
  // strategyAllowLong: present key = explicit override (true/false), absent
  // key = "use bound account_strategy's persisted toggle".
  const [strategyKillSwitchOverrides, setStrategyKillSwitchOverrides] = useState<
    Record<string, boolean>
  >(savedConfig?.strategyKillSwitchOverrides ?? {});
  const [strategyRegimeOverrides, setStrategyRegimeOverrides] = useState<Record<string, boolean>>(
    savedConfig?.strategyRegimeOverrides ?? {},
  );
  const [strategyCorrelationOverrides, setStrategyCorrelationOverrides] = useState<
    Record<string, boolean>
  >(savedConfig?.strategyCorrelationOverrides ?? {});
  const [strategyConcurrentCapOverrides, setStrategyConcurrentCapOverrides] = useState<
    Record<string, boolean>
  >(savedConfig?.strategyConcurrentCapOverrides ?? {});
  // V62 — UI toggle for the gate-overrides section. Hidden by default so the
  // common single-strategy / single-account research flow isn't cluttered.
  const [showGateOverrides, setShowGateOverrides] = useState<boolean>(false);
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
  // V58 — run-level direction flags are no longer user-controlled in the
  // wizard. The backend resolver now reads allowLong/allowShort per-strategy
  // from the bound account_strategy; run-level fields stay on the wire as a
  // permissive fallback (used only for ad-hoc strategies without a bound
  // AS), so we always submit TRUE/TRUE. Locals retained because re-run flow
  // hydrates them and the wire payload still carries the field.
  const [allowLong] = useState<boolean>(true);
  const [allowShort] = useState<boolean>(true);
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

  // When account-strategies finish loading, auto-fill any selected strategy
  // that is missing an account-strategy ID. This covers the race where the
  // user clicked a chip before useAccountStrategies resolved (candidates was
  // empty at click time so toggleStrategy couldn't pick one).
  useEffect(() => {
    if (strategiesLoading) return;
    setStrategyAccountStrategyIds((ids) => {
      let changed = false;
      const next = { ...ids };
      for (const code of selectedStrategies) {
        if (!next[code]) {
          const candidates = strategyOptionsByCode.get(code) ?? [];
          const pick = pickDefaultAccountStrategy(candidates, scopedAccountId);
          if (pick) {
            next[code] = pick.id;
            changed = true;
          }
        }
      }
      return changed ? next : ids;
    });
  }, [strategiesLoading, selectedStrategies, strategyOptionsByCode, scopedAccountId]);

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
      if (Number.isFinite(n) && n > 0 && n <= ALLOC_MAX_PCT) {
        allocs[code] = n;
      }
    }

    // V57 — trim per-strategy risk-pct overrides. UI scale is percent
    // (5 = 5%); convert to fraction (0.05) for the wire/schema. Drop
    // blanks (fall back to persisted) and out-of-range.
    const riskPcts: Record<string, number> = {};
    for (const code of selectedStrategies) {
      const raw = strategyRiskPcts[code];
      if (raw == null || raw === '') continue;
      const pct = Number(raw);
      if (Number.isFinite(pct) && pct > 0 && pct <= 20) {
        riskPcts[code] = pct / 100;
      }
    }

    // Same trim for per-strategy intervals: only carry entries for
    // currently-selected strategies, drop blanks (= "use primary").
    const intervals: Record<string, string> = {};
    for (const code of selectedStrategies) {
      const v = strategyIntervals[code];
      if (typeof v === 'string' && v.trim() !== '') intervals[code] = v.trim();
    }

    // V58 — same trim for direction overrides: only carry entries for
    // currently-selected strategies. Both true and false are valid
    // override values, so we don't drop falsy entries.
    const allowLongMap: Record<string, boolean> = {};
    const allowShortMap: Record<string, boolean> = {};
    // V62 — same trim for gate overrides. Trims to currently-selected
    // strategies; preserves explicit false values (operator's intent to
    // force a gate off for this run).
    const killSwitchMap: Record<string, boolean> = {};
    const regimeMap: Record<string, boolean> = {};
    const correlationMap: Record<string, boolean> = {};
    const concurrentCapMap: Record<string, boolean> = {};
    for (const code of selectedStrategies) {
      if (typeof strategyAllowLong[code] === 'boolean')
        allowLongMap[code] = strategyAllowLong[code];
      if (typeof strategyAllowShort[code] === 'boolean')
        allowShortMap[code] = strategyAllowShort[code];
      if (typeof strategyKillSwitchOverrides[code] === 'boolean')
        killSwitchMap[code] = strategyKillSwitchOverrides[code];
      if (typeof strategyRegimeOverrides[code] === 'boolean')
        regimeMap[code] = strategyRegimeOverrides[code];
      if (typeof strategyCorrelationOverrides[code] === 'boolean')
        correlationMap[code] = strategyCorrelationOverrides[code];
      if (typeof strategyConcurrentCapOverrides[code] === 'boolean')
        concurrentCapMap[code] = strategyConcurrentCapOverrides[code];
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
      strategyRiskPcts: Object.keys(riskPcts).length ? riskPcts : undefined,
      strategyAllowLong: Object.keys(allowLongMap).length ? allowLongMap : undefined,
      strategyAllowShort: Object.keys(allowShortMap).length ? allowShortMap : undefined,
      strategyKillSwitchOverrides: Object.keys(killSwitchMap).length ? killSwitchMap : undefined,
      strategyRegimeOverrides: Object.keys(regimeMap).length ? regimeMap : undefined,
      strategyCorrelationOverrides: Object.keys(correlationMap).length ? correlationMap : undefined,
      strategyConcurrentCapOverrides: Object.keys(concurrentCapMap).length
        ? concurrentCapMap
        : undefined,
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
      requestAnimationFrame(() => {
        document
          .querySelector('[data-form-error]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
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
    strategyRiskPcts,
    strategyAllowLong,
    strategyAllowShort,
    strategyKillSwitchOverrides,
    strategyRegimeOverrides,
    strategyCorrelationOverrides,
    strategyConcurrentCapOverrides,
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
              color: 'var(--brand-500)',
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
          <p
            data-form-error
            className="border-t border-bd-subtle bg-tint-loss px-5 py-2 text-[11px] text-loss"
          >
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
              <p data-form-error className="mt-3 text-[11px] text-loss">
                {errors.strategyAccountStrategyIds}
              </p>
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
                <p className="label-caps pb-2">
                  Per-strategy direction + allocation + risk + interval
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedStrategies.map((code) => {
                    const boundAs = strategyOptionsByCode
                      .get(code)
                      ?.find((s) => s.id === strategyAccountStrategyIds[code]);
                    return (
                      <div
                        key={code}
                        className="grid grid-cols-[5rem_auto_1fr_1fr_auto_5rem] items-center gap-2"
                      >
                        <span className="truncate font-mono text-[11px] font-semibold text-text-primary">
                          {code}
                        </span>
                        <DirectionSelect
                          allowLong={boundAs?.allowLong}
                          allowShort={boundAs?.allowShort}
                          longOverride={strategyAllowLong[code]}
                          shortOverride={strategyAllowShort[code]}
                          onLongChange={(next) =>
                            setStrategyAllowLong((prev) => {
                              const out = { ...prev };
                              if (next === undefined) delete out[code];
                              else out[code] = next;
                              return out;
                            })
                          }
                          onShortChange={(next) =>
                            setStrategyAllowShort((prev) => {
                              const out = { ...prev };
                              if (next === undefined) delete out[code];
                              else out[code] = next;
                              return out;
                            })
                          }
                        />
                        <Select
                          value={strategyAllocations[code] ? strategyAllocations[code] : INHERIT_ALLOC}
                          onValueChange={(value) =>
                            setStrategyAllocations((prev) => ({
                              ...prev,
                              [code]: value === INHERIT_ALLOC ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 font-mono text-[11px]" aria-label={`${code} allocation`}>
                            <SelectValue placeholder="alloc %" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INHERIT_ALLOC}>Auto (account default)</SelectItem>
                            {ALLOC_OPTIONS.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                {v}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={strategyRiskPcts[code] ? strategyRiskPcts[code] : INHERIT_RISK}
                          onValueChange={(value) =>
                            setStrategyRiskPcts((prev) => ({
                              ...prev,
                              [code]: value === INHERIT_RISK ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 font-mono text-[11px]" aria-label={`${code} risk per trade`}>
                            <SelectValue placeholder="risk %" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INHERIT_RISK}>Auto (account default)</SelectItem>
                            {RISK_OPTIONS.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                {v}%R
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          value={
                            strategyIntervals[code] ? strategyIntervals[code] : INHERIT_PRIMARY
                          }
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
                            <SelectItem value={INHERIT_PRIMARY}>
                              Use primary ({interval})
                            </SelectItem>
                            {INTERVALS.map((i) => (
                              <SelectItem key={i} value={i}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-text-muted">
                  Direction defaults to each strategy&apos;s live setting — select{' '}
                  <strong className="font-semibold text-text-secondary">Both</strong>,{' '}
                  <strong className="font-semibold text-profit">Long</strong>, or{' '}
                  <strong className="font-semibold text-loss">Short</strong> to override for this
                  run only. A{' '}
                  <span className="font-semibold text-text-secondary">≠ live</span> badge appears
                  when you&apos;ve changed it. Allocation and Risk% blank → fall back to each
                  strategy&apos;s saved settings. Setting Risk% forces risk-based sizing on for
                  that strategy in this run.
                </p>

                {/* V62 — per-strategy risk-gate overrides. Collapsed by
                    default so the common single-strategy research flow
                    isn't cluttered. Each gate is independently tristate:
                    Auto (use persisted toggle), On (force enabled for
                    this run), Off (force disabled for this run). */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowGateOverrides((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
                    aria-expanded={showGateOverrides}
                  >
                    <ChevronDown
                      size={11}
                      strokeWidth={1.75}
                      className={cn(
                        'transition-transform',
                        showGateOverrides ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                    Risk gate overrides (research)
                  </button>
                  {showGateOverrides && (
                    <div className="mt-3 rounded-sm border border-bd-subtle bg-bg-base p-3">
                      <p className="mb-2 text-[10px] text-text-muted">
                        Each gate defaults to the strategy&apos;s persisted toggle. Pick{' '}
                        <strong className="font-semibold text-profit">On</strong> to force
                        the gate active for this run, or{' '}
                        <strong className="font-semibold text-loss">Off</strong> to disable.
                        Same gate stack runs in live and backtest after V62.
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <div className="grid grid-cols-[5rem_repeat(4,_minmax(0,_1fr))] items-center gap-2 border-b border-bd-subtle pb-1 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                          <span></span>
                          <span>Kill-switch</span>
                          <span>Regime</span>
                          <span>Correlation</span>
                          <span>Account cap</span>
                        </div>
                        {selectedStrategies.map((code) => (
                          <div
                            key={code}
                            className="grid grid-cols-[5rem_repeat(4,_minmax(0,_1fr))] items-center gap-2"
                          >
                            <span className="truncate font-mono text-[11px] font-semibold text-text-primary">
                              {code}
                            </span>
                            <GateOverrideSelect
                              code={code}
                              gate="kill-switch"
                              value={strategyKillSwitchOverrides[code]}
                              onChange={(next) =>
                                setStrategyKillSwitchOverrides((prev) => {
                                  const out = { ...prev };
                                  if (next === undefined) delete out[code];
                                  else out[code] = next;
                                  return out;
                                })
                              }
                            />
                            <GateOverrideSelect
                              code={code}
                              gate="regime"
                              value={strategyRegimeOverrides[code]}
                              onChange={(next) =>
                                setStrategyRegimeOverrides((prev) => {
                                  const out = { ...prev };
                                  if (next === undefined) delete out[code];
                                  else out[code] = next;
                                  return out;
                                })
                              }
                            />
                            <GateOverrideSelect
                              code={code}
                              gate="correlation"
                              value={strategyCorrelationOverrides[code]}
                              onChange={(next) =>
                                setStrategyCorrelationOverrides((prev) => {
                                  const out = { ...prev };
                                  if (next === undefined) delete out[code];
                                  else out[code] = next;
                                  return out;
                                })
                              }
                            />
                            <GateOverrideSelect
                              code={code}
                              gate="concurrent-cap"
                              value={strategyConcurrentCapOverrides[code]}
                              onChange={(next) =>
                                setStrategyConcurrentCapOverrides((prev) => {
                                  const out = { ...prev };
                                  if (next === undefined) delete out[code];
                                  else out[code] = next;
                                  return out;
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

type DirectionMode = 'both' | 'long' | 'short';

function directionMode(l: boolean, s: boolean): DirectionMode {
  if (l && s) return 'both';
  if (l) return 'long';
  return 'short';
}

/** 3-segment pill control for per-strategy direction in a backtest run.
 *  Defaults to the bound account-strategy's live config. Selecting a
 *  different mode overrides for this run only; a "≠ live" badge appears
 *  when the selection differs from the persisted live setting. */
function DirectionSelect({
  allowLong,
  allowShort,
  longOverride,
  shortOverride,
  onLongChange,
  onShortChange,
}: {
  allowLong: boolean | undefined;
  allowShort: boolean | undefined;
  longOverride: boolean | undefined;
  shortOverride: boolean | undefined;
  onLongChange: (next: boolean | undefined) => void;
  onShortChange: (next: boolean | undefined) => void;
}) {
  const disabled = allowLong === undefined && allowShort === undefined;

  const effectiveLong = longOverride !== undefined ? longOverride : Boolean(allowLong);
  const effectiveShort = shortOverride !== undefined ? shortOverride : Boolean(allowShort);
  const current = directionMode(effectiveLong, effectiveShort);

  const persistedLong = Boolean(allowLong);
  const persistedShort = Boolean(allowShort);
  const liveMode = directionMode(persistedLong, persistedShort);
  const differsFromLive = !disabled && current !== liveMode;

  const select = (mode: DirectionMode) => {
    if (disabled) return;
    const wantsLong = mode !== 'short';
    const wantsShort = mode !== 'long';
    // Clear overrides when the selection already matches live — keeps wire minimal.
    onLongChange(wantsLong === persistedLong ? undefined : wantsLong);
    onShortChange(wantsShort === persistedShort ? undefined : wantsShort);
  };

  const segments: { mode: DirectionMode; label: string; title: string }[] = [
    { mode: 'both',  label: 'Both',  title: 'Long and short entries allowed' },
    { mode: 'long',  label: 'Long',  title: 'Long entries only for this run' },
    { mode: 'short', label: 'Short', title: 'Short entries only for this run' },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-md border border-border',
          disabled && 'pointer-events-none opacity-40',
        )}
        title={disabled ? 'Select an account-strategy preset to configure direction.' : undefined}
      >
        {segments.map(({ mode, label, title }) => {
          const isActive = current === mode;
          const activeClass =
            mode === 'long'
              ? 'bg-[rgba(22,179,100,0.18)] text-profit'
              : mode === 'short'
                ? 'bg-[rgba(229,72,77,0.15)] text-loss'
                : 'bg-bg-elevated text-text-primary';
          return (
            <button
              key={mode}
              type="button"
              onClick={() => select(mode)}
              disabled={disabled}
              title={title}
              className={cn(
                'h-7 px-2.5 text-[10px] font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? activeClass
                  : 'bg-bg-surface text-text-muted hover:bg-bg-elevated hover:text-text-secondary',
                mode !== 'both' && 'border-l border-border',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {differsFromLive && (
        <span
          className="text-[9px] leading-none text-text-muted"
          title={`Strategy live config: ${liveMode}`}
        >
          ≠ live
        </span>
      )}
    </div>
  );
}

/**
 * V62 — tristate select for one per-strategy risk-gate override.
 * "Auto" maps to undefined (delete the strategy's key from the override map,
 * fall back to account_strategy.<gate>_gate_enabled); "On" forces TRUE; "Off"
 * forces FALSE. Both true and false are valid override values, so the parent
 * carries the distinction via `next === undefined ? delete : assign`.
 */
function GateOverrideSelect({
  code,
  gate,
  value,
  onChange,
}: {
  code: string;
  gate: string;
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
}) {
  const selectValue =
    value === undefined ? INHERIT_GATE : value ? 'true' : 'false';
  return (
    <Select
      value={selectValue}
      onValueChange={(v) =>
        onChange(v === INHERIT_GATE ? undefined : v === 'true')
      }
    >
      <SelectTrigger className="h-7 font-mono text-[10px]" aria-label={`${code} ${gate} gate override`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={INHERIT_GATE}>Auto</SelectItem>
        <SelectItem value="true">On</SelectItem>
        <SelectItem value="false">Off</SelectItem>
      </SelectContent>
    </Select>
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
        <p data-form-error className="text-[11px] text-loss">
          {error}
        </p>
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
                <span className="font-mono font-semibold">{c.interval}</span>
                <span className="font-mono text-text-muted">· {c.presetName}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
