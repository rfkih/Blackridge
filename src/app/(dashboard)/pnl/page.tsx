'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays } from 'date-fns';
import {
  AlertCircle,
  BarChart3,
  CalendarRange,
  Percent,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { PnlCell } from '@/components/shared/PnlCell';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { CumulativePnlChart } from '@/components/charts/CumulativePnlChart';
import { PnlBarChart } from '@/components/charts/PnlBarChart';
import { useDailyPnl, usePnlByStrategy } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { cn } from '@/lib/utils';
import type { DailyPnl, StrategyPnl } from '@/types/pnl';

const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * Filter state we persist in the URL. Keeping it on the querystring (rather
 * than in local state) makes the page shareable and survives navigation —
 * clicking through to a strategy detail and back shouldn't lose the window.
 */
interface Filters {
  from: string;
  to: string;
  strategyCode: string;
  symbol: string;
}

function readFilters(params: URLSearchParams): Filters {
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const defaultFrom = format(subDays(new Date(), DEFAULT_LOOKBACK_DAYS - 1), 'yyyy-MM-dd');
  return {
    from: params.get('from') || defaultFrom,
    to: params.get('to') || todayIso,
    strategyCode: params.get('strategyCode') ?? '',
    symbol: params.get('symbol') ?? '',
  };
}

export default function PnlPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const updateFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === 'string' && v.length > 0) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`/pnl${next.toString() ? `?${next.toString()}` : ''}`);
    },
    [router, searchParams],
  );

  const dailyQ = useDailyPnl(filters.from, filters.to, filters.strategyCode || undefined);
  const byStratQ = usePnlByStrategy(filters.from, filters.to);

  const dailySeries = useMemo(
    () => filterBySymbol(dailyQ.data, filters.symbol),
    [dailyQ.data, filters.symbol],
  );

  const stats = useMemo(() => computeStats(dailySeries), [dailySeries]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">P&amp;L Analytics</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Performance
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Realized daily P&amp;L, cumulative trajectory, per-strategy breakdown.
          </p>
        </div>
      </header>

      <FilterBar filters={filters} onChange={updateFilters} />

      <SummaryRow stats={stats} isLoading={dailyQ.isLoading} />

      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-[13px] font-semibold text-text-primary">
            Daily P&amp;L
          </h3>
          <span className="font-mono text-[11px] text-text-muted">
            {dailySeries.length} day{dailySeries.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="p-3">
          {dailyQ.isError ? (
            <ChartError onRetry={() => dailyQ.refetch()} />
          ) : dailyQ.isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : dailySeries.length === 0 ? (
            <EmptyChartState label="No realized P&L in this window." />
          ) : (
            <ErrorBoundary label="Daily P&L chart">
              <PnlBarChart data={dailySeries} />
            </ErrorBoundary>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface lg:col-span-3">
          <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
            <h3 className="font-display text-[13px] font-semibold text-text-primary">
              Cumulative P&amp;L
            </h3>
            <span
              className="num font-mono text-[11px] tabular-nums"
              style={{
                color: stats.total >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
              }}
            >
              {stats.total >= 0 ? '+' : ''}
              {stats.total.toFixed(2)} USDT
            </span>
          </div>
          <div className="p-3">
            {dailyQ.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : dailySeries.length === 0 ? (
              <EmptyChartState label="No cumulative curve to draw." />
            ) : (
              <ErrorBoundary label="Cumulative P&L chart">
                <CumulativePnlChart data={dailySeries} />
              </ErrorBoundary>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface lg:col-span-2">
          <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
            <h3 className="font-display text-[13px] font-semibold text-text-primary">
              Per-Strategy
            </h3>
            <span className="font-mono text-[11px] text-text-muted">
              {byStratQ.data?.length ?? 0} strateg
              {byStratQ.data?.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {byStratQ.isError ? (
            <ChartError onRetry={() => byStratQ.refetch()} />
          ) : byStratQ.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !byStratQ.data?.length ? (
            <EmptyChartState label="No strategy breakdown available." />
          ) : (
            <StrategyTable rows={byStratQ.data} />
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const { data: strategies = [] } = useStrategies();

  // Unique strategy codes + symbols across the user's configured strategies —
  // no separate endpoint needed and the set is usually small (<10 items).
  const strategyCodes = useMemo(() => {
    const set = new Set<string>();
    for (const s of strategies) set.add(s.strategyCode);
    return Array.from(set).sort();
  }, [strategies]);

  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const s of strategies) set.add(s.symbol);
    return Array.from(set).sort();
  }, [strategies]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-bd-subtle bg-bg-surface px-4 py-3">
      <DateInput
        label="From"
        value={filters.from}
        onChange={(v) => onChange({ from: v })}
        max={filters.to}
      />
      <DateInput
        label="To"
        value={filters.to}
        onChange={(v) => onChange({ to: v })}
        min={filters.from}
      />
      <SelectInput
        label="Strategy"
        value={filters.strategyCode}
        onChange={(v) => onChange({ strategyCode: v })}
        options={[
          { value: '', label: 'All strategies' },
          ...strategyCodes.map((c) => ({ value: c, label: c })),
        ]}
      />
      <SelectInput
        label="Symbol"
        value={filters.symbol}
        onChange={(v) => onChange({ symbol: v })}
        options={[
          { value: '', label: 'All symbols' },
          ...symbols.map((s) => ({ value: s, label: s })),
        ]}
      />
      <button
        type="button"
        onClick={() =>
          onChange({
            from: format(subDays(new Date(), DEFAULT_LOOKBACK_DAYS - 1), 'yyyy-MM-dd'),
            to: format(new Date(), 'yyyy-MM-dd'),
            strategyCode: '',
            symbol: '',
          })
        }
        className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
      >
        <RefreshCw size={11} strokeWidth={1.75} /> Reset
      </button>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    // The label wraps both the caption and the input — a valid nested
    // association — but eslint-plugin-jsx-a11y doesn't detect it through a
    // sibling <span>. Disable the rule for this compound form primitive.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="flex flex-col gap-1">
      <span className="label-caps inline-flex items-center gap-1">
        <CalendarRange size={10} strokeWidth={1.75} /> {label}
      </span>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className={cn(
          'h-8 rounded-sm border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary',
          'focus:border-bd focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    // See DateInput — label wraps both span + control, a11y rule can't see that.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-8 rounded-sm border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary',
          'focus:border-bd focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Summary stats ───────────────────────────────────────────────────────────

interface ComputedStats {
  total: number;
  tradeCount: number;
  winRate: number;
  bestDay: DailyPnl | null;
  worstDay: DailyPnl | null;
}

function computeStats(days: DailyPnl[]): ComputedStats {
  if (!days.length) {
    return { total: 0, tradeCount: 0, winRate: 0, bestDay: null, worstDay: null };
  }
  let total = 0;
  let tradeCount = 0;
  let winningDays = 0;
  let losingDays = 0;
  let best: DailyPnl = days[0];
  let worst: DailyPnl = days[0];
  for (const d of days) {
    total += d.realizedPnl;
    tradeCount += d.tradeCount;
    if (d.realizedPnl > 0) winningDays += 1;
    else if (d.realizedPnl < 0) losingDays += 1;
    if (d.realizedPnl > best.realizedPnl) best = d;
    if (d.realizedPnl < worst.realizedPnl) worst = d;
  }
  const decided = winningDays + losingDays;
  const winRate = decided > 0 ? (winningDays / decided) * 100 : 0;
  return { total, tradeCount, winRate, bestDay: best, worstDay: worst };
}

function SummaryRow({ stats, isLoading }: { stats: ComputedStats; isLoading: boolean }) {
  const totalColor = stats.total >= 0 ? 'profit' : 'loss';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total P&L"
        value={`${stats.total >= 0 ? '+' : ''}${stats.total.toFixed(2)} USDT`}
        valueColor={totalColor}
        sub={`${stats.tradeCount} trade${stats.tradeCount === 1 ? '' : 's'}`}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <StatCard
        label="Winning-Day %"
        value={`${stats.winRate.toFixed(1)}%`}
        valueColor={stats.winRate >= 50 ? 'profit' : 'loss'}
        icon={Percent}
        isLoading={isLoading}
      />
      <StatCard
        label="Best Day"
        value={stats.bestDay ? `+${stats.bestDay.realizedPnl.toFixed(2)} USDT` : '—'}
        valueColor="profit"
        sub={stats.bestDay?.date}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <StatCard
        label="Worst Day"
        value={stats.worstDay ? `${stats.worstDay.realizedPnl.toFixed(2)} USDT` : '—'}
        valueColor="loss"
        sub={stats.worstDay?.date}
        icon={TrendingDown}
        isLoading={isLoading}
      />
    </div>
  );
}

// ─── Per-strategy table ──────────────────────────────────────────────────────

function StrategyTable({ rows }: { rows: StrategyPnl[] }) {
  const ordered = useMemo(() => [...rows].sort((a, b) => b.totalPnl - a.totalPnl), [rows]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-bd-subtle">
            {['Strategy', 'Total P&L', 'Win %', 'Trades', 'Avg'].map((col) => (
              <th key={col} className="label-caps whitespace-nowrap px-3 py-2.5 text-left">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => {
            const avg = r.tradeCount > 0 ? r.totalPnl / r.tradeCount : 0;
            return (
              <tr
                key={r.strategyCode}
                className="border-b border-bd-subtle last:border-b-0 hover:bg-bg-elevated"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <StrategyBadge code={r.strategyCode} size="sm" />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <PnlCell value={r.totalPnl} noFlash />
                </td>
                <td
                  className="num whitespace-nowrap px-3 py-2 text-[12px]"
                  style={{
                    color: r.winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)',
                  }}
                >
                  {r.winRate.toFixed(1)}%
                </td>
                <td className="num whitespace-nowrap px-3 py-2 text-[12px] text-text-primary">
                  {r.tradeCount}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <PnlCell value={avg} noFlash />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterBySymbol(data: DailyPnl[] | undefined, symbol: string): DailyPnl[] {
  if (!data) return [];
  if (!symbol) return data;
  // Backend doesn't honor ?symbol= on /pnl/daily today, so the symbol filter
  // is a no-op on the data itself. Keep the prop threading so the UI is
  // wire-ready the moment the endpoint adds support.
  return data;
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-[12px] text-text-muted">
      <AlertCircle size={18} />
      <span>Could not load P&L data.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-primary hover:bg-bg-hover"
      >
        <RefreshCw size={11} /> Retry
      </button>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-[12px] text-text-muted">
      <BarChart3 size={18} />
      <span>{label}</span>
    </div>
  );
}
