'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Activity,
  Target,
  ChevronRight,
  Zap,
  PauseCircle,
  StopCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { OpenPositionsPanel } from '@/components/trading/OpenPositionsPanel';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { PnlCell } from '@/components/shared/PnlCell';
import { PriceCell } from '@/components/shared/PriceCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenTrades, useRecentTrades, usePnlSummary } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useLivePnl } from '@/hooks/useLivePnl';
import { formatPrice, formatPnl, formatPercent, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Trades } from '@/types/trading';
import type { AccountStrategy, AccountStrategyStatus } from '@/types/strategy';

const DashboardMarketChart = dynamic(
  () =>
    import('@/components/charts/DashboardMarketChart').then((m) => ({
      default: m.DashboardMarketChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded-lg border border-[var(--border-subtle)]"
        style={{ height: 620, background: 'var(--bg-surface)' }}
        aria-hidden="true"
      />
    ),
  },
);

// Recharts is large — defer to a client-only chunk so it doesn't bloat the dashboard's first paint.
const DashboardEquityCurve = dynamic(
  () =>
    import('@/components/charts/DashboardEquityCurve').then((m) => ({
      default: m.DashboardEquityCurve,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-full w-full animate-pulse rounded-lg border border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-surface)' }}
        aria-hidden="true"
      />
    ),
  },
);

// ─── Strategy status card ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AccountStrategyStatus,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  LIVE: {
    label: 'Live',
    icon: Zap,
    color: 'var(--color-profit)',
    bg: 'rgba(0,200,150,0.1)',
  },
  PAUSED: {
    label: 'Paused',
    icon: PauseCircle,
    color: 'var(--color-warning)',
    bg: 'rgba(245,166,35,0.1)',
  },
  STOPPED: {
    label: 'Stopped',
    icon: StopCircle,
    color: 'var(--color-loss)',
    bg: 'rgba(255,77,106,0.1)',
  },
};

function StrategyStatusCard({ strategy }: { strategy: AccountStrategy }) {
  const statusCfg = STATUS_CONFIG[strategy.status] ?? STATUS_CONFIG.STOPPED;
  const StatusIcon = statusCfg.icon;

  return (
    <Link
      href={`/strategies/${strategy.id}`}
      className="group block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
    >
      <div className="flex items-start justify-between gap-2">
        <StrategyBadge code={strategy.strategyCode} size="sm" />
        <span
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
        >
          <StatusIcon size={10} />
          {statusCfg.label}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        <p className="font-mono text-sm font-medium text-[var(--text-primary)]">
          {strategy.symbol}
          <span className="ml-1.5 text-xs text-[var(--text-muted)]">{strategy.interval}</span>
        </p>
        <p className="font-mono tabular-nums text-xs text-[var(--text-secondary)]">
          {formatPrice(strategy.capitalAllocatedUsdt)}
          <span className="text-[var(--text-muted)]"> allocated</span>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px]',
            strategy.allowLong
              ? 'bg-[rgba(0,200,150,0.08)] text-[var(--color-profit)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
          )}
        >
          L
        </span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px]',
            strategy.allowShort
              ? 'bg-[rgba(255,77,106,0.08)] text-[var(--color-loss)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
          )}
        >
          S
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          View →
        </span>
      </div>
    </Link>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  href,
  hrefLabel = 'View all',
}: {
  title: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)]"
        >
          {hrefLabel}
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ─── Dashboard page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies();
  // Canonical source for account scoping — derived from strategies, not from
  // a self-referential trade fetch.
  const accountId = strategies[0]?.accountId;

  const { data: pnlSummary, isLoading: pnlLoading } = usePnlSummary('today');
  const { data: openTrades = [], isLoading: tradesLoading } = useOpenTrades(accountId);
  const { data: recentTrades = [], isLoading: recentLoading } = useRecentTrades(10, accountId);

  useLivePnl(accountId);

  const unrealizedPnl = pnlSummary?.unrealizedPnl ?? 0;
  const realizedPnl = pnlSummary?.realizedPnl ?? 0;
  const openCount = pnlSummary?.openCount ?? openTrades.length;
  const winRate = pnlSummary?.winRate ?? 0;
  const heroLoading = pnlLoading && !pnlSummary;

  return (
    <div className="space-y-6">
      {/* ── Row 1: Hero stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Unrealized P&L" value={formatPnl(unrealizedPnl)} valueColor={unrealizedPnl >= 0 ? 'profit' : 'loss'} sub="open positions" icon={TrendingUp} isLoading={heroLoading} />
        <StatCard label="Realized P&L Today" value={formatPnl(realizedPnl)} valueColor={realizedPnl >= 0 ? 'profit' : 'loss'} sub="closed trades today" icon={DollarSign} isLoading={heroLoading} />
        <StatCard label="Open Positions" value={String(openCount)} valueColor="info" sub="active trades" icon={Activity} isLoading={heroLoading} />
        <StatCard label="Win Rate (30d)" value={`${winRate.toFixed(1)}%`} valueColor={winRate >= 50 ? 'profit' : 'loss'} sub={`${formatPercent(winRate - 50)} vs 50%`} subColor={winRate >= 50 ? 'profit' : 'loss'} icon={Target} isLoading={heroLoading} />
      </div>

      {/* ── Row 2: Open positions + Strategy status — fixed height so panels match ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Open positions — fills the fixed height, table scrolls if many rows */}
        <div className="flex flex-col lg:col-span-3" style={{ height: 360 }}>
          <ErrorBoundary label="Open positions">
            <OpenPositionsPanel
              positions={openTrades}
              isLoading={tradesLoading}
              className="flex-1 min-h-0"
            />
          </ErrorBoundary>
        </div>

        {/* Strategies — same fixed height, card list scrolls if many strategies */}
        <div className="flex flex-col lg:col-span-2" style={{ height: 360 }}>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {/* Panel header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Strategies
                </h2>
                {!strategiesLoading && (
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                    {strategies.length}
                  </span>
                )}
              </div>
              <Link
                href="/strategies"
                className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)]"
              >
                Manage <ChevronRight size={12} />
              </Link>
            </div>

            {/* Scrollable card list */}
            <div className="flex-1 overflow-y-auto p-3">
              {strategiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : strategies.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={Zap}
                    title="No strategies configured"
                    description="Add a strategy to start trading."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {strategies.map((s) => (
                    <StrategyStatusCard key={s.id} strategy={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 3: Live market chart (full width) ── */}
      <ErrorBoundary label="Market chart">
        <DashboardMarketChart />
      </ErrorBoundary>

      {/* ── Row 4: Equity curve (3/5) + Recent trades (2/5) ── */}
      {/* items-start lets the recent-trades panel stay compact (~6 rows) without
          forcing the equity curve to shrink to match it. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="flex flex-col lg:col-span-3">
          <ErrorBoundary label="Equity curve">
            <DashboardEquityCurve />
          </ErrorBoundary>
        </div>

        {/* Recent trades — caps at ~6 visible rows; rest scrolls inside the body */}
        <div className="flex flex-col lg:col-span-2">
          <div
            className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            style={{ boxShadow: 'var(--shadow-panel)' }}
          >
            {/* Panel header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Recent Trades
                </span>
                {!recentLoading && (
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                    {recentTrades.length}
                  </span>
                )}
              </div>
              <Link
                href="/trades"
                className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)]"
              >
                All trades <ChevronRight size={12} />
              </Link>
            </div>

            {/* Scrollable body — capped at ~6 rows tall (each row ≈ 36px + sticky thead 32px).
                minHeight keeps the empty/loading states from collapsing. */}
            <div className="overflow-y-auto" style={{ maxHeight: 248, minHeight: 160 }}>
              {recentLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : recentTrades.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState icon={TrendingUp} title="No closed trades yet" description="Completed trades will appear here." />
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-surface)]">
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Symbol', 'Strategy', 'P&L', 'Closed'].map((col) => (
                        <th key={col} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {trade.direction === 'LONG'
                              ? <ArrowUpRight size={11} style={{ color: 'var(--color-profit)' }} />
                              : <ArrowDownRight size={11} style={{ color: 'var(--color-loss)' }} />}
                            <span className="font-mono text-sm text-[var(--text-primary)]">{trade.symbol}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StrategyBadge code={trade.strategyCode} size="sm" /></td>
                        <td className="px-4 py-2.5"><PnlCell value={trade.realizedPnl} /></td>
                        <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{formatDate(trade.exitTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
