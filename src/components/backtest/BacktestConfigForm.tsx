'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { INTERVALS } from '@/lib/constants';
import { useAccountStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { cn } from '@/lib/utils';
import type { BacktestWizardConfig } from '@/types/backtest';
import type { AccountStrategy } from '@/types/strategy';

const COMMON_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT'];

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
  const { data: definitions = [], isLoading: definitionsLoading } =
    useStrategyDefinitions();
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

  const intervalMismatches = useMemo(() => {
    const out: Array<{ code: string; interval: string }> = [];
    for (const code of selectedStrategies) {
      const id = strategyAccountStrategyIds[code];
      if (!id) continue;
      const accStrat = strategyById.get(id);
      if (accStrat && accStrat.interval && accStrat.interval !== interval) {
        out.push({ code, interval: accStrat.interval });
      }
    }
    return out;
  }, [selectedStrategies, strategyAccountStrategyIds, strategyById, interval]);

  // Only offer a one-click fix when every assigned strategy agrees on the
  // same (non-matching) interval — otherwise there's no single right answer.
  const sharedMismatchInterval = useMemo(() => {
    if (intervalMismatches.length === 0) return null;
    const first = intervalMismatches[0].interval;
    return intervalMismatches.every((m) => m.interval === first) ? first : null;
  }, [intervalMismatches]);

  const handleSubmit = useCallback(() => {
    const parsed = configSchema.safeParse({
      symbol: symbol.trim().toUpperCase(),
      interval,
      fromDate,
      toDate,
      initialCapital: Number(initialCapital),
      strategyCodes: selectedStrategies,
      strategyAccountStrategyIds,
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
    setConfig,
    router,
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">New backtest</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Configure Run
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Step 1 of 2. Review parameters on the next screen before submitting.
          </p>
        </div>
        <WizardBreadcrumb current="config" />
      </header>

      <section className="rounded-md border border-bd-subtle bg-bg-surface">
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
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              max={toDate}
              className="h-9"
            />
          </Field>

          <Field label="To Date" error={errors.toDate}>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              min={fromDate}
              className="h-9"
            />
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

      <section className="rounded-md border border-bd-subtle bg-bg-surface">
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
            No active strategies in the catalogue. Register one in the strategy
            definitions admin page first.
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

            {intervalMismatches.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2.5">
                <AlertTriangle
                  size={12}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-[11px] text-text-primary">
                    Interval mismatch — backtest results will not be valid. The
                    backtest is set to{' '}
                    <span className="font-mono font-semibold">{interval}</span>{' '}
                    but{' '}
                    {intervalMismatches.map((m, i) => (
                      <span key={m.code}>
                        <span className="font-mono font-semibold">{m.code}</span>
                        {' is registered on '}
                        <span className="font-mono font-semibold">{m.interval}</span>
                        {i < intervalMismatches.length - 1 ? ', ' : '.'}
                      </span>
                    ))}
                  </p>
                  {sharedMismatchInterval && (
                    <button
                      type="button"
                      onClick={() => setInterval(sharedMismatchInterval)}
                      className="self-start rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 font-mono text-[10px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
                    >
                      Use {sharedMismatchInterval}
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
          className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2 text-[12px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
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
        disabled
          ? `No account-strategy configured for ${code}`
          : name
          ? `${code} — ${name}`
          : code
      }
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-profit bg-tint-profit text-text-primary'
          : 'border-bd-subtle bg-bg-base text-text-secondary hover:border-bd hover:bg-bg-elevated hover:text-text-primary',
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
