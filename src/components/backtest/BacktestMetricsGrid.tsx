'use client';

import { StatCard } from '@/components/shared/StatCard';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { BacktestMetrics } from '@/types/backtest';

interface BacktestMetricsGridProps {
  metrics: BacktestMetrics | null;
  isLoading?: boolean;
}

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function BacktestMetricsGrid({ metrics, isLoading }: BacktestMetricsGridProps) {
  const m = metrics;
  const formatCurrency = useCurrencyFormatter();
  const totalReturnColor = m == null ? 'neutral' : m.totalReturn >= 0 ? 'profit' : 'loss';
  const totalReturnPctPrefix = m && m.totalReturnPct >= 0 ? '+' : '';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
      <StatCard
        label="Total Return"
        isLoading={isLoading}
        value={m ? `${totalReturnPctPrefix}${formatNum(m.totalReturnPct)}%` : '—'}
        valueColor={totalReturnColor}
        sub={m ? formatCurrency(m.totalReturn, { withSign: true }) : undefined}
        subColor={totalReturnColor === 'neutral' ? 'neutral' : totalReturnColor}
      />
      <StatCard
        label="Win Rate"
        isLoading={isLoading}
        value={m ? `${formatNum(m.winRate)}%` : '—'}
        valueColor={m == null ? 'neutral' : m.winRate >= 50 ? 'profit' : 'loss'}
        sub={m ? `${m.winningTrades}W / ${m.losingTrades}L` : undefined}
      />
      <StatCard
        label="Profit Factor"
        isLoading={isLoading}
        value={m && m.profitFactor != null ? formatNum(m.profitFactor) : '—'}
        valueColor={m?.profitFactor == null ? 'neutral' : m.profitFactor >= 1 ? 'profit' : 'loss'}
      />
      <StatCard
        label="Sharpe"
        isLoading={isLoading}
        value={m?.sharpe != null ? formatNum(m.sharpe) : '—'}
        valueColor={m?.sharpe == null ? 'neutral' : m.sharpe >= 0 ? 'profit' : 'loss'}
      />
      <StatCard
        label="Sortino"
        isLoading={isLoading}
        value={m?.sortino != null ? formatNum(m.sortino) : '—'}
        valueColor={m?.sortino == null ? 'neutral' : m.sortino >= 0 ? 'profit' : 'loss'}
      />
      <StatCard
        label="Max Drawdown"
        isLoading={isLoading}
        value={m ? `−${formatNum(m.maxDrawdownPct)}%` : '—'}
        valueColor={m?.maxDrawdownPct ? 'loss' : 'neutral'}
        sub={
          m && m.maxDrawdown != null ? formatCurrency(-Math.abs(m.maxDrawdown), { withSign: true }) : undefined
        }
        subColor="loss"
      />
      <StatCard
        label="Avg Win / Loss"
        isLoading={isLoading}
        value={
          m && (m.avgWinUsdt != null || m.avgLossUsdt != null)
            ? `${m.avgWinUsdt != null ? formatCurrency(m.avgWinUsdt, { withSign: true }) : '—'} / ${
                m.avgLossUsdt != null
                  ? formatCurrency(-Math.abs(m.avgLossUsdt), { withSign: true })
                  : '—'
              }`
            : '—'
        }
        valueColor="neutral"
      />
      <StatCard
        label="Total Trades"
        isLoading={isLoading}
        value={m ? String(m.totalTrades) : '—'}
        valueColor="neutral"
      />
    </div>
  );
}
