'use client';

import { Suspense, useCallback, useMemo } from 'react';
import nextDynamic from 'next/dynamic';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { useDailyPnl, usePnlByStrategy } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useAccountView } from '@/lib/accountType/registry';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { useBtcBuyHold } from '@/hooks/useBtcBuyHold';
import { AllocationStatCards } from '@/components/hedging/AllocationStatCards';
import { AllocationPanel } from '@/components/hedging/AllocationPanel';
import { DrawdownVsBuyHoldPanel } from '@/components/hedging/DrawdownVsBuyHoldPanel';
import { cn } from '@/lib/utils';
import type { DailyPnl, StrategyPnl } from '@/types/pnl';

const PnlBarChart = nextDynamic(
  () => import('@/components/charts/PnlBarChart').then((m) => m.PnlBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> },
);
const CumulativePnlChart = nextDynamic(
  () => import('@/components/charts/CumulativePnlChart').then((m) => m.CumulativePnlChart),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);

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
  return (
    <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
      <PnlPageContent />
    </Suspense>
  );
}

function HedgingPnlContent() {
  const { scopedAccountId } = useActiveAccount();
  const { points, period, setPeriod, stats: equityStats, isLoading } = useEquityCurve();
  const { strategyDrawdown, buyHoldDrawdown, verdict } = useBtcBuyHold(points, period);

  const accountId = scopedAccountId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Allocation Performance"
        title="Performance"
        description="BTC/cash allocation vs buy-hold — drawdown, equity trajectory, rebalance framing."
      />

      {/* Period selector */}
      <div className="flex items-center gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-4 py-3">
        <span className="label-caps">Window</span>
        {(['7D', '30D', '90D', 'ALL'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-sm px-2.5 py-1 font-mono text-[11px] transition-colors',
              period === p
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-[120px] w-full" />
      ) : (
        <AllocationStatCards accountId={accountId} />
      )}

      <AllocationPanel accountId={accountId} />

      <DrawdownVsBuyHoldPanel
        strategySeries={strategyDrawdown}
        buyHoldSeries={buyHoldDrawdown}
        verdict={verdict}
      />

      {equityStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            label="Equity Return"
            value={`${equityStats.changePct >= 0 ? '+' : ''}${equityStats.changePct.toFixed(2)}%`}
            valueColor={equityStats.changePct >= 0 ? 'profit' : 'loss'}
            sub="vs strategy start"
            icon={TrendingUp}
            isLoading={isLoading}
          />
          <StatCard
            label="Max Drawdown"
            value={equityStats.maxDrawdown != null ? `${equityStats.maxDrawdown.toFixed(2)}%` : '—'}
            valueColor="loss"
            sub="peak-to-trough"
            icon={TrendingDown}
            isLoading={isLoading}
          />
          <StatCard
            label="Calmar"
            value={
              equityStats.maxDrawdown && equityStats.maxDrawdown < 0
                ? (equityStats.changePct / Math.abs(equityStats.maxDrawdown)).toFixed(2)
                : '—'
            }
            sub="return / max drawdown"
            icon={BarChart3}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

function PnlPageContent() {
  const accountView = useAccountView();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHedgingView = accountView.label === 'Hedging';

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

  // All hooks called unconditionally — branching happens in render only.
  // For HEDGING views the data these return is not rendered, so queries
  // either stay disabled (useDailyPnl guards on non-empty from/to) or
  // load without consequence (usePnlByStrategy).
  const dailyQ = useDailyPnl(
    filters.from,
    filters.to,
    filters.strategyCode || undefined,
    filters.symbol || undefined,
  );
  const byStratQ = usePnlByStrategy(filters.from, filters.to);

  // Symbol scoping is applied server-side by /api/v1/pnl/daily (the symbol
  // query param above) — never re-filter the daily aggregate client-side.
  const dailySeries = useMemo(() => dailyQ.data ?? [], [dailyQ.data]);

  const stats = useMemo(() => computeStats(dailySeries), [dailySeries]);

  // For HEDGING accounts, show allocation-performance framing instead.
  if (isHedgingView) {
    return <HedgingPnlContent />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="P&L Analytics"
        title="Performance"
        description="Realized daily P&L, cumulative trajectory, per-strategy breakdown."
      />

      <FilterBar filters={filters} onChange={updateFilters} />

      <SummaryRow stats={stats} isLoading={dailyQ.isLoading} />

      <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
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
        <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface lg:col-span-3">
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

        <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface lg:col-span-2">
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

function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const { data: strategies = [] } = useStrategies();

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
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-bd-subtle bg-bg-surface px-4 py-3">
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
        className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
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

    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="flex flex-col gap-1">
      <span className="label-caps inline-flex items-center gap-1">
        <CalendarRange size={10} strokeWidth={1.75} /> {label}
      </span>
      <DatePicker
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        placeholder={label}
        className={cn('h-8 px-2 text-[12px]')}
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

function StrategyTable({ rows }: { rows: StrategyPnl[] }) {
  const ordered = useMemo(() => [...rows].sort((a, b) => b.totalPnl - a.totalPnl), [rows]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-bd-subtle">
            {[
              'Strategy',
              'Total P&L',
              'Win %',
              'Trades',
              'Avg',
              'Avg / Trade %',
              'Compound @ 90%',
            ].map((col) => (
              <th key={col} className="label-caps whitespace-nowrap px-3 py-2.5 text-left">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => {
            const avg = r.tradeCount > 0 ? r.totalPnl / r.tradeCount : 0;
            const avgPct = r.avgTradeReturnPct;
            const geomPct = r.geometricReturnPctAtAlloc90;
            return (
              <tr
                key={r.strategyCode}
                className="border-b border-bd-subtle last:border-b-0 hover:bg-bg-hover"
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
                <td
                  className="num whitespace-nowrap px-3 py-2 text-[12px]"
                  title="Mean per-trade return rate (pnl ÷ notional × 100). Sizing-independent."
                  style={{
                    color:
                      avgPct == null
                        ? 'var(--text-muted)'
                        : avgPct >= 0
                          ? 'var(--color-profit)'
                          : 'var(--color-loss)',
                  }}
                >
                  {avgPct != null ? `${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(3)}%` : '—'}
                </td>
                <td
                  className="num whitespace-nowrap px-3 py-2 text-[12px]"
                  title="Compounded return assuming every trade had been sized at 90% of equity."
                  style={{
                    color:
                      geomPct == null
                        ? 'var(--text-muted)'
                        : geomPct <= -100
                          ? 'var(--color-loss)'
                          : geomPct >= 0
                            ? 'var(--color-profit)'
                            : 'var(--color-loss)',
                  }}
                >
                  {geomPct != null ? `${geomPct >= 0 ? '+' : ''}${geomPct.toFixed(2)}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-[12px] text-text-muted">
      <AlertCircle size={18} />
      <span>Could not load P&L data.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 text-[11px] text-text-primary hover:bg-bg-hover"
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
