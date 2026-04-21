'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  TrendingUp,
  ChevronRight,
  Zap,
  PauseCircle,
  StopCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { HeroPnl } from '@/components/dashboard/HeroPnl';
import { OpenPositionsPanel } from '@/components/trading/OpenPositionsPanel';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { PnlCell } from '@/components/shared/PnlCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenTrades, useRecentTrades, usePnlSummary } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { formatPrice, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
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
        className="w-full rounded-md border border-bd-subtle shimmer"
        style={{ height: 620 }}
        aria-hidden="true"
      />
    ),
  },
);

const DashboardEquityCurve = dynamic(
  () =>
    import('@/components/charts/DashboardEquityCurve').then((m) => ({
      default: m.DashboardEquityCurve,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-md border border-bd-subtle shimmer" aria-hidden="true" />
    ),
  },
);

const STATUS_CONFIG: Record<
  AccountStrategyStatus,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  LIVE: { label: 'Live', icon: Zap, color: 'var(--color-profit)', bg: 'var(--tint-profit)' },
  PAUSED: {
    label: 'Paused',
    icon: PauseCircle,
    color: 'var(--color-warning)',
    bg: 'var(--tint-warning)',
  },
  STOPPED: {
    label: 'Stopped',
    icon: StopCircle,
    color: 'var(--color-loss)',
    bg: 'var(--tint-loss)',
  },
};

function StrategyStatusCard({ strategy }: { strategy: AccountStrategy }) {
  const statusCfg = STATUS_CONFIG[strategy.status] ?? STATUS_CONFIG.STOPPED;
  const StatusIcon = statusCfg.icon;

  return (
    <Link
      href={`/strategies/${strategy.id}`}
      className="group relative block overflow-hidden rounded-md border border-bd-subtle bg-bg-base transition-colors duration-base ease-out-quart hover:border-bd"
    >
      <span aria-hidden="true" className="card-topline" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <StrategyBadge code={strategy.strategyCode} size="sm" />
          <span
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold"
            style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
          >
            <StatusIcon size={10} strokeWidth={2} />
            {statusCfg.label}
          </span>
        </div>

        <div className="mt-3 space-y-1">
          <p className="num text-[13px] font-medium text-text-primary">
            {strategy.symbol}
            <span className="ml-1.5 text-[11px] text-text-muted">{strategy.interval}</span>
          </p>
          <p className="num text-[11px] text-text-secondary">
            {strategy.capitalAllocationPct.toFixed(1)}%
            <span className="text-text-muted"> of account allocated</span>
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <DirPill kind="long" on={strategy.allowLong} />
          <DirPill kind="short" on={strategy.allowShort} />
          <span className="label-caps ml-auto !text-[9px] opacity-0 transition-opacity duration-fast group-hover:opacity-100">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

function DirPill({ kind, on }: { kind: 'long' | 'short'; on: boolean }) {
  const color = kind === 'long' ? 'var(--color-profit)' : 'var(--color-loss)';
  const bg = kind === 'long' ? 'var(--tint-profit)' : 'var(--tint-loss)';
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px]"
      style={{
        backgroundColor: on ? bg : 'var(--bg-elevated)',
        color: on ? color : 'var(--text-muted)',
      }}
    >
      {kind === 'long' ? 'L' : 'S'}
    </span>
  );
}

export default function DashboardPage() {
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies();
  const { scopedAccountId, isAll, activeAccount } = useActiveAccount();

  const visibleStrategies = scopedAccountId
    ? strategies.filter((s) => s.accountId === scopedAccountId)
    : strategies;

  const { data: pnlSummary, isLoading: pnlLoading } = usePnlSummary('today');
  const { data: openTrades = [], isLoading: tradesLoading } = useOpenTrades(scopedAccountId);
  const { data: recentTrades = [], isLoading: recentLoading } = useRecentTrades(10, scopedAccountId);

  useLivePnl(scopedAccountId);
  useSyncOpenPositions(openTrades);

  const unrealizedPnl = pnlSummary?.unrealizedPnl ?? 0;
  const realizedPnl = pnlSummary?.realizedPnl ?? 0;
  const openCount = pnlSummary?.openCount ?? openTrades.length;
  const winRate = pnlSummary?.winRate ?? 0;
  const heroLoading = pnlLoading && !pnlSummary;

  return (
    <div className="space-y-6">
      {/* Row 0: the hero — the single visually dominant element on the page */}
      <div className="reveal" style={{ ['--reveal-i' as string]: 0 }}>
        <HeroPnl
          unrealizedPnl={unrealizedPnl}
          realizedPnlToday={realizedPnl}
          openCount={openCount}
          winRate={winRate}
          isLoading={heroLoading}
          scope={{ isAll, account: activeAccount }}
        />
      </div>

      {/* Row 1: Open positions (3/5) + Strategies (2/5) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div
          className="reveal flex flex-col lg:col-span-3"
          style={{ ['--reveal-i' as string]: 1, height: 360 }}
        >
          <ErrorBoundary label="Open positions">
            <OpenPositionsPanel
              positions={openTrades}
              isLoading={tradesLoading}
              className="flex-1 min-h-0"
            />
          </ErrorBoundary>
        </div>

        <div
          className="reveal flex flex-col lg:col-span-2"
          style={{ ['--reveal-i' as string]: 2, height: 360 }}
        >
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
            <div className="flex shrink-0 items-center justify-between border-b border-bd-subtle px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="label-caps">Strategies</h2>
                {!strategiesLoading && (
                  <span className="num rounded-sm bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                    {visibleStrategies.length}
                  </span>
                )}
              </div>
              <Link
                href="/strategies"
                className="flex items-center gap-0.5 text-[11px] text-text-muted transition-colors duration-fast hover:text-text-primary"
              >
                Manage <ChevronRight size={12} strokeWidth={1.75} />
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {strategiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-md" />
                  ))}
                </div>
              ) : visibleStrategies.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={Zap}
                    title={isAll ? 'No strategies configured' : 'No strategies on this account'}
                    description={
                      isAll
                        ? 'Add a strategy to start trading.'
                        : 'Switch accounts in the top bar to see others.'
                    }
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleStrategies.map((s) => (
                    <StrategyStatusCard key={s.id} strategy={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: market chart — full width */}
      <div className="reveal" style={{ ['--reveal-i' as string]: 3 }}>
        <ErrorBoundary label="Market chart">
          <DashboardMarketChart />
        </ErrorBoundary>
      </div>

      {/* Row 3: Equity curve (3/5) + Recent trades (2/5) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="flex flex-col lg:col-span-3">
          <ErrorBoundary label="Equity curve">
            <DashboardEquityCurve />
          </ErrorBoundary>
        </div>

        <div className="flex flex-col lg:col-span-2">
          <div className="flex flex-col overflow-hidden rounded-md border border-bd-subtle bg-bg-surface shadow-panel">
            <div className="flex shrink-0 items-center justify-between border-b border-bd-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="label-caps">Recent Trades</h2>
                {!recentLoading && (
                  <span className="num rounded-sm bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                    {recentTrades.length}
                  </span>
                )}
              </div>
              <Link
                href="/trades"
                className="flex items-center gap-0.5 text-[11px] text-text-muted transition-colors duration-fast hover:text-text-primary"
              >
                All trades <ChevronRight size={12} strokeWidth={1.75} />
              </Link>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 248, minHeight: 160 }}>
              {recentLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : recentTrades.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={TrendingUp}
                    title="No closed trades yet"
                    description="Completed trades will appear here."
                  />
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-bg-surface">
                    <tr className={cn('border-b border-bd-subtle')}>
                      {['Symbol', 'Strategy', 'P&L', 'Closed'].map((col) => (
                        <th
                          key={col}
                          className="label-caps px-4 py-2 text-left"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <tr
                        key={trade.id}
                        className="border-b border-bd-subtle transition-colors duration-fast hover:bg-bg-elevated last:border-b-0"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {trade.direction === 'LONG' ? (
                              <ArrowUpRight size={11} strokeWidth={1.75} className="text-profit" />
                            ) : (
                              <ArrowDownRight size={11} strokeWidth={1.75} className="text-loss" />
                            )}
                            <span className="num text-[13px] text-text-primary">
                              {trade.symbol}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <StrategyBadge code={trade.strategyCode} size="sm" />
                        </td>
                        <td className="px-4 py-2.5">
                          <PnlCell value={trade.realizedPnl} noFlash />
                        </td>
                        <td className="num px-4 py-2.5 text-[11px] text-text-muted">
                          {formatDate(trade.exitTime)}
                        </td>
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
