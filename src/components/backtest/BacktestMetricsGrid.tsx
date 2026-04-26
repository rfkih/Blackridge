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

// Tooltip copy for each metric. Centralised so they can be reused on the
// dashboard or sweep result page later. Each is a tight 2-3 paragraph
// explanation: what the number is, how to read it, what NOT to read into it.
const HELP = {
  totalReturn: (
    <>
      <p>
        Net P&amp;L over the run, fees + slippage included. Shown as % of
        initial capital with absolute USDT below.
      </p>
      <p className="mt-1.5 text-text-muted">
        Single-number read of the run, but doesn&apos;t tell you how
        <em> stable</em> the path was — pair with Max Drawdown.
      </p>
    </>
  ),
  winRate: (
    <>
      <p>
        Fraction of closed trades that ended profitable, after fees.
      </p>
      <p className="mt-1.5 text-text-muted">
        Misleading on its own — a 70% win rate with tiny wins and large
        losses is still a losing strategy. Read alongside Profit Factor
        and Avg Win / Loss.
      </p>
    </>
  ),
  profitFactor: (
    <>
      <p>
        <span className="font-mono">gross winning P&amp;L ÷ gross losing P&amp;L</span> (absolute).
        1.0 = breakeven, 1.5+ = healthy, 2.0+ = excellent.
      </p>
      <p className="mt-1.5 text-text-muted">
        Survivor of choice when comparing strategies — single trade
        can&apos;t dominate it the way raw P&amp;L can.
      </p>
    </>
  ),
  sharpe: (
    <>
      <p>
        Annualized risk-adjusted return:{' '}
        <span className="font-mono">mean daily return ÷ daily σ × √252</span>.
        Above 1.0 is decent, 2+ is rare.
      </p>
      <p className="mt-1.5 text-text-muted">
        Breaks down on non-Gaussian returns (fat tails, skew) — a Sharpe
        of 2 with one giant winner is not the same as 2 from steady wins.
        That&apos;s exactly what PSR corrects for.
      </p>
    </>
  ),
  sortino: (
    <>
      <p>
        Sharpe variant that only penalizes <em>downside</em> volatility —
        uses σ of negative daily returns instead of all returns.
      </p>
      <p className="mt-1.5 text-text-muted">
        More honest for trend-following or asymmetric strategies where
        upside variance shouldn&apos;t count as risk. A Sortino much
        higher than Sharpe means the volatility is mostly upside.
      </p>
    </>
  ),
  psr: (
    <>
      <p>
        <strong>Probabilistic Sharpe Ratio.</strong> Probability that the{' '}
        <em>true</em> Sharpe exceeds zero given the observed sample size
        and the return distribution&apos;s skew + kurtosis.
      </p>
      <p className="mt-1.5">
        95%+ ≈ confident edge. 70–95% ≈ promising but not significant.
        &lt; 70% ≈ likely noise.
      </p>
      <p className="mt-1.5 text-text-muted">
        A Sharpe of 2 over 30 trades earns much less PSR than the same
        Sharpe over 1000 trades — the metric discounts small samples and
        fat-tailed returns automatically.
      </p>
    </>
  ),
  maxDrawdown: (
    <>
      <p>
        Largest peak-to-trough decline in equity over the run, as a % of
        the prior peak.
      </p>
      <p className="mt-1.5 text-text-muted">
        Decides whether a strategy is psychologically tolerable — a 50%
        MDD on paper is rarely survivable in production. Pair with Sharpe:
        high Sharpe + high MDD = leveraged volatility, not edge.
      </p>
    </>
  ),
  avgWinLoss: (
    <>
      <p>
        Average USDT P&amp;L on winning trades vs losing trades.
      </p>
      <p className="mt-1.5 text-text-muted">
        Ratio matters more than absolutes: a 1:2 win/loss ratio (avg loss
        2× avg win) needs ≥67% win rate to be profitable. Combine with
        Win Rate to spot mean-revert vs trend-follow profiles.
      </p>
    </>
  ),
  totalTrades: (
    <>
      <p>Closed trades in the run.</p>
      <p className="mt-1.5 text-text-muted">
        Below ~30 trades, every metric on this page is statistically
        meaningless — the noise dominates the signal. 100+ for a stable
        Sharpe estimate, more if returns are fat-tailed.
      </p>
    </>
  ),
};

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
        help={HELP.totalReturn}
      />
      <StatCard
        label="Win Rate"
        isLoading={isLoading}
        value={m ? `${formatNum(m.winRate)}%` : '—'}
        valueColor={m == null ? 'neutral' : m.winRate >= 50 ? 'profit' : 'loss'}
        sub={m ? `${m.winningTrades}W / ${m.losingTrades}L` : undefined}
        help={HELP.winRate}
      />
      <StatCard
        label="Profit Factor"
        isLoading={isLoading}
        value={m && m.profitFactor != null ? formatNum(m.profitFactor) : '—'}
        valueColor={m?.profitFactor == null ? 'neutral' : m.profitFactor >= 1 ? 'profit' : 'loss'}
        help={HELP.profitFactor}
      />
      <StatCard
        label="Sharpe"
        isLoading={isLoading}
        value={m?.sharpe != null ? formatNum(m.sharpe) : '—'}
        valueColor={m?.sharpe == null ? 'neutral' : m.sharpe >= 0 ? 'profit' : 'loss'}
        help={HELP.sharpe}
      />
      <StatCard
        label="Sortino"
        isLoading={isLoading}
        value={m?.sortino != null ? formatNum(m.sortino) : '—'}
        valueColor={m?.sortino == null ? 'neutral' : m.sortino >= 0 ? 'profit' : 'loss'}
        help={HELP.sortino}
      />
      <StatCard
        label="PSR"
        isLoading={isLoading}
        value={m?.psr != null ? formatNum(m.psr * 100, 1) + '%' : '—'}
        valueColor={
          m?.psr == null
            ? 'neutral'
            : m.psr >= 0.95
            ? 'profit'
            : m.psr >= 0.7
            ? 'neutral'
            : 'loss'
        }
        sub="P(SR > 0)"
        help={HELP.psr}
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
        help={HELP.maxDrawdown}
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
        help={HELP.avgWinLoss}
      />
      <StatCard
        label="Total Trades"
        isLoading={isLoading}
        value={m ? String(m.totalTrades) : '—'}
        valueColor="neutral"
        help={HELP.totalTrades}
      />
    </div>
  );
}
