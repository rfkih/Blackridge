'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { listBacktestRuns } from '@/lib/api/backtest';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays } from 'date-fns';
import type { BacktestRun } from '@/types/backtest';
import type { SymbolApprovalThreshold } from '@/types/symbolApproval';

/**
 * Picker for the backtest run that justifies an approval. Lists completed
 * runs filtered by (symbol, strategyCode), shows the four gate metrics
 * inline with green/red coloring, lets the operator hide failing runs.
 *
 * <p>The {@code threshold} prop drives the visual pass/fail markers — the
 * real gate runs server-side on submit. This UI is *advisory*; an operator
 * can still pick a below-bar run and the backend will return 422.
 */
interface BacktestRunPickerProps {
  symbol: string;
  strategyCode: string;
  threshold: SymbolApprovalThreshold | undefined;
  value: string | null;
  onChange: (runId: string | null) => void;
}

export function BacktestRunPicker({
  symbol,
  strategyCode,
  threshold,
  value,
  onChange,
}: BacktestRunPickerProps) {
  const [hideBelow, setHideBelow] = useState(true);
  const [filter, setFilter] = useState('');

  const runsQ = useQuery({
    queryKey: ['backtest-runs', 'picker', symbol, strategyCode],
    queryFn: () =>
      listBacktestRuns({
        symbol,
        strategyCode,
        status: 'COMPLETED',
        sortBy: 'createdAt',
        sortDir: 'DESC',
        size: 50,
      }),
    enabled: Boolean(symbol && strategyCode),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const all = runsQ.data?.content ?? [];
    const scored = all.map((run) => ({ run, eval: evaluate(run, threshold) }));
    const filtered = hideBelow ? scored.filter((r) => r.eval.passesAll) : scored;
    if (!filter.trim()) return filtered;
    const needle = filter.trim().toLowerCase();
    return filtered.filter(
      ({ run }) =>
        run.id.toLowerCase().includes(needle) ||
        (run.interval ?? '').toLowerCase().includes(needle),
    );
  }, [runsQ.data, hideBelow, filter, threshold]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={11}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search ${symbol} · ${strategyCode} runs…`}
            className="h-8 pl-7 text-[12px]"
          />
        </div>
        <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={hideBelow}
            onChange={(e) => setHideBelow(e.target.checked)}
            className="size-3"
          />
          Hide below bar
        </label>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-sm border border-bd-subtle bg-bg-base">
        {runsQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-[11px] text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Loading runs…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-text-muted">
            {hideBelow
              ? `No ${symbol}·${strategyCode} runs above the bar. Untoggle "Hide below bar" to see all.`
              : `No COMPLETED ${symbol}·${strategyCode} runs found. Run a backtest first.`}
          </div>
        ) : (
          <ul role="listbox" className="divide-y divide-bd-subtle">
            {rows.map(({ run, eval: rowEval }) => (
              <RunRow
                key={run.id}
                run={run}
                rowEval={rowEval}
                selected={value === run.id}
                onSelect={() => onChange(run.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface RowEvaluation {
  cagr: { actual: number | null; pass: boolean };
  capital: { actual: number; pass: boolean };
  windowDays: { actual: number; pass: boolean };
  trades: { actual: number | null; pass: boolean };
  passesAll: boolean;
}

function evaluate(run: BacktestRun, threshold: SymbolApprovalThreshold | undefined): RowEvaluation {
  const cagr = run.metrics?.geometricReturnPctAtAlloc90 ?? null;
  const trades = run.metrics?.totalTrades ?? null;
  const capital = Number(run.initialCapital) || 0;
  const windowDays =
    run.fromDate && run.toDate
      ? differenceInCalendarDays(new Date(run.toDate), new Date(run.fromDate))
      : 0;

  if (!threshold) {
    return {
      cagr: { actual: cagr, pass: true },
      capital: { actual: capital, pass: true },
      windowDays: { actual: windowDays, pass: true },
      trades: { actual: trades, pass: true },
      passesAll: true,
    };
  }

  const cagrPass = (cagr ?? -Infinity) >= threshold.minCagrPct;
  const capitalPass = capital >= threshold.minInitialCapitalUsd;
  const windowPass = windowDays >= threshold.minWindowDays;
  const tradesPass = (trades ?? 0) >= threshold.minTrades;

  return {
    cagr: { actual: cagr, pass: cagrPass },
    capital: { actual: capital, pass: capitalPass },
    windowDays: { actual: windowDays, pass: windowPass },
    trades: { actual: trades, pass: tradesPass },
    passesAll: cagrPass && capitalPass && windowPass && tradesPass,
  };
}

function RunRow({
  run,
  rowEval,
  selected,
  onSelect,
}: {
  run: BacktestRun;
  rowEval: RowEvaluation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        role="option"
        aria-selected={selected}
        className={cn(
          'block w-full px-3 py-2 text-left transition-colors',
          selected ? 'bg-bg-hover' : 'hover:bg-bg-hover',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-text-primary">
            {run.id.slice(0, 8)} · {run.interval ?? '—'}
          </span>
          <span className="font-mono text-[10px] text-text-muted">
            {run.fromDate ? format(new Date(run.fromDate), 'yyyy-MM-dd') : '—'} →{' '}
            {run.toDate ? format(new Date(run.toDate), 'yyyy-MM-dd') : '—'}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px]">
          <Metric
            label="CAGR"
            value={rowEval.cagr.actual != null ? `${rowEval.cagr.actual.toFixed(2)}%` : '—'}
            pass={rowEval.cagr.pass}
          />
          <Metric
            label="cap"
            value={`$${rowEval.capital.actual.toFixed(0)}`}
            pass={rowEval.capital.pass}
          />
          <Metric
            label="window"
            value={`${rowEval.windowDays.actual}d`}
            pass={rowEval.windowDays.pass}
          />
          <Metric
            label="trades"
            value={rowEval.trades.actual != null ? String(rowEval.trades.actual) : '—'}
            pass={rowEval.trades.pass}
          />
          {!rowEval.passesAll && (
            <span className="inline-flex items-center gap-0.5 text-[var(--color-loss)]">
              <AlertCircle size={9} /> below bar
            </span>
          )}
          {rowEval.passesAll && selected && (
            <span className="inline-flex items-center gap-0.5 text-[var(--color-profit)]">
              <CheckCircle2 size={9} /> selected
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function Metric({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-text-muted">{label}</span>
      <span className={pass ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}>
        {value}
      </span>
    </span>
  );
}
