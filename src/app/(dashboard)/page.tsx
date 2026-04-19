'use client';

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
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenTrades, useRecentTrades, usePnlSummary } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useLivePnl } from '@/hooks/useLivePnl';
import { formatPrice, formatPnl, formatPercent, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Trades } from '@/types/trading';
import type { AccountStrategy, AccountStrategyStatus } from '@/types/strategy';

// ─── Recent trades row ───────────────────────────────────────────────────────

function RecentTradeRow({ trade }: { trade: Trades }) {
  const isProfit = trade.realizedPnl >= 0;
  const isLong = trade.direction === 'LONG';

  return (
    <tr className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded"
            style={{
              backgroundColor: isLong ? 'rgba(0,200,150,0.1)' : 'rgba(255,77,106,0.1)',
            }}
          >
            {isLong ? (
              <ArrowUpRight size={11} style={{ color: 'var(--color-profit)' }} />
            ) : (
              <ArrowDownRight size={11} style={{ color: 'var(--color-loss)' }} />
            )}
          </span>
          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
            {trade.symbol}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StrategyBadge code={trade.strategyCode} size="sm" />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 font-mono tabular-nums text-xs text-[var(--text-secondary)]">
          <PriceCell value={trade.entryPrice} />
          <ChevronRight size={10} className="text-[var(--text-muted)]" />
          {trade.exitAvgPrice != null ? (
            <PriceCell value={trade.exitAvgPrice} />
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <PnlCell value={trade.realizedPnl} />
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-[var(--text-muted)]">
          {trade.exitTime != null ? formatDate(trade.exitTime) : '—'}
        </span>
      </td>
    </tr>
  );
}

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
  const { data: pnlSummary, isLoading: pnlLoading } = usePnlSummary('today');
  const { data: openTrades = [], isLoading: tradesLoading } = useOpenTrades();
  const { data: recentTrades = [], isLoading: recentLoading } = useRecentTrades(10);
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies();

  // Subscribe to live P&L for the first account in the data
  const accountId = openTrades[0]?.accountId ?? strategies[0]?.accountId;
  useLivePnl(accountId);

  // Derive hero values
  const unrealizedPnl = pnlSummary?.unrealizedPnl ?? 0;
  const realizedPnl = pnlSummary?.realizedPnl ?? 0;
  const openCount = pnlSummary?.openCount ?? openTrades.length;
  const winRate = pnlSummary?.winRate ?? 0;

  const heroLoading = pnlLoading && !pnlSummary;

  return (
    <div className="space-y-6">
      {/* ── Row 1: Hero stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Unrealized P&L"
          value={formatPnl(unrealizedPnl)}
          valueColor={unrealizedPnl >= 0 ? 'profit' : 'loss'}
          sub="across all open positions"
          icon={TrendingUp}
          isLoading={heroLoading}
        />
        <StatCard
          label="Realized P&L Today"
          value={formatPnl(realizedPnl)}
          valueColor={realizedPnl >= 0 ? 'profit' : 'loss'}
          sub="closed trades today"
          icon={DollarSign}
          isLoading={heroLoading}
        />
        <StatCard
          label="Open Positions"
          value={String(openCount)}
          valueColor="info"
          sub="active trades"
          icon={Activity}
          isLoading={heroLoading}
        />
        <StatCard
          label="Win Rate (30d)"
          value={`${winRate.toFixed(1)}%`}
          valueColor={winRate >= 50 ? 'profit' : 'loss'}
          sub={`${formatPercent(winRate - 50)} vs 50%`}
          subColor={winRate >= 50 ? 'profit' : 'loss'}
          icon={Target}
          isLoading={heroLoading}
        />
      </div>

      {/* ── Row 2: Open positions ── */}
      <OpenPositionsPanel positions={openTrades} isLoading={tradesLoading} />

      {/* ── Row 3: Recent trades + Strategy status ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent trades */}
        <div className="lg:col-span-3">
          <SectionHeader
            title="Recent Trades"
            count={recentTrades.length}
            href="/trades"
            hrefLabel="All trades"
          />
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {recentLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : recentTrades.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No closed trades yet"
                description="Completed trades will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Symbol', 'Strategy', 'Entry → Exit', 'P&L', 'Closed'].map((col) => (
                        <th
                          key={col}
                          className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <RecentTradeRow key={trade.id} trade={trade} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Strategy status */}
        <div className="lg:col-span-2">
          <SectionHeader
            title="Strategies"
            count={strategies.length}
            href="/strategies"
            hrefLabel="Manage"
          />
          {strategiesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : strategies.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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
  );
}
