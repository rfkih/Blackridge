'use client';

import { StatCard } from '@/components/shared/StatCard';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { isHedging } from '@/lib/strategyKind';
import type { BacktestMetrics } from '@/types/backtest';

interface BacktestMetricsGridProps {
  metrics: BacktestMetrics | null;
  isLoading?: boolean;
  /** Strategy kind from the run object. When "HEDGING", trading-only metrics
   *  are hidden and allocation/drawdown framing is shown instead. */
  strategyKind?: string | null;
  /** Final ending equity from the run (USDT). Used in hedging view to show
   *  the terminal portfolio value alongside return and drawdown. */
  endingBalance?: number;
  /** Initial capital for the run. Used in hedging view for context. */
  initialCapital?: number;
}

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

const HELP = {
  totalReturn: (
    <>
      <p>
        Net P&amp;L over the run, fees + slippage included. Shown as % of initial capital with
        absolute USDT below.
      </p>
      <p className="mt-1.5 text-text-muted">
        Single-number read of the run, but doesn&apos;t tell you how
        <em> stable</em> the path was — pair with Max Drawdown.
      </p>
    </>
  ),
  winRate: (
    <>
      <p>Fraction of closed trades that ended profitable, after fees.</p>
      <p className="mt-1.5 text-text-muted">
        Misleading on its own — a 70% win rate with tiny wins and large losses is still a losing
        strategy. Read alongside Profit Factor and Avg Win / Loss.
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
        Survivor of choice when comparing strategies — single trade can&apos;t dominate it the way
        raw P&amp;L can.
      </p>
    </>
  ),
  sharpe: (
    <>
      <p>
        Annualized risk-adjusted return:{' '}
        <span className="font-mono">mean daily return ÷ daily σ × √252</span>. Above 1.0 is decent,
        2+ is rare.
      </p>
      <p className="mt-1.5 text-text-muted">
        Breaks down on non-Gaussian returns (fat tails, skew) — a Sharpe of 2 with one giant winner
        is not the same as 2 from steady wins. That&apos;s exactly what PSR corrects for.
      </p>
    </>
  ),
  sortino: (
    <>
      <p>
        Sharpe variant that only penalizes <em>downside</em> volatility — uses σ of negative daily
        returns instead of all returns.
      </p>
      <p className="mt-1.5 text-text-muted">
        More honest for trend-following or asymmetric strategies where upside variance
        shouldn&apos;t count as risk. A Sortino much higher than Sharpe means the volatility is
        mostly upside.
      </p>
    </>
  ),
  psr: (
    <>
      <p>
        <strong>Probabilistic Sharpe Ratio.</strong> Probability that the <em>true</em> Sharpe
        exceeds zero given the observed sample size and the return distribution&apos;s skew +
        kurtosis.
      </p>
      <p className="mt-1.5">
        95%+ ≈ confident edge. 70–95% ≈ promising but not significant. &lt; 70% ≈ likely noise.
      </p>
      <p className="mt-1.5 text-text-muted">
        A Sharpe of 2 over 30 trades earns much less PSR than the same Sharpe over 1000 trades — the
        metric discounts small samples and fat-tailed returns automatically.
      </p>
    </>
  ),
  maxDrawdown: (
    <>
      <p>Largest peak-to-trough decline in equity over the run, as a % of the prior peak.</p>
      <p className="mt-1.5 text-text-muted">
        Decides whether a strategy is psychologically tolerable — a 50% MDD on paper is rarely
        survivable in production. Pair with Sharpe: high Sharpe + high MDD = leveraged volatility,
        not edge.
      </p>
    </>
  ),
  avgWinLoss: (
    <>
      <p>Average USDT P&amp;L on winning trades vs losing trades.</p>
      <p className="mt-1.5 text-text-muted">
        Ratio matters more than absolutes: a 1:2 win/loss ratio (avg loss 2× avg win) needs ≥67% win
        rate to be profitable. Combine with Win Rate to spot mean-revert vs trend-follow profiles.
      </p>
    </>
  ),
  totalTrades: (
    <>
      <p>Closed trades in the run.</p>
      <p className="mt-1.5 text-text-muted">
        Below ~30 trades, every metric on this page is statistically meaningless — the noise
        dominates the signal. 100+ for a stable Sharpe estimate, more if returns are fat-tailed.
      </p>
    </>
  ),
  avgTradeReturn: (
    <>
      <p>
        Mean of per-trade return rate <span className="font-mono">(pnl ÷ notional × 100)</span>.
        Answers &ldquo;average edge per trade&rdquo; — independent of how much equity was actually
        risked.
      </p>
      <p className="mt-1.5 text-text-muted">
        Compare to Total Return: when the bet size is small (e.g. risk-based sizing), Total Return
        can look tiny even though the edge is strong. This number doesn&apos;t care about sizing.
      </p>
    </>
  ),
  avgRiskReward: (
    <>
      <p>
        <span className="font-mono">avg winning trade ÷ |avg losing trade|</span>. How many average
        losers a single average winner pays for.
      </p>
      <p className="mt-1.5 text-text-muted">
        1.0 means wins and losses are equal size — need &gt;50% win rate to profit. 2.0+ means a
        single winner covers two average losers, so a sub-50% win rate can still be profitable. Pair
        with Win Rate to spot trend-follow (low WR, high R:R) vs mean-revert (high WR, low R:R)
        profiles. &ldquo;∞&rdquo; means no losing trades.
      </p>
    </>
  ),
};

export function BacktestMetricsGrid({
  metrics,
  isLoading,
  strategyKind,
  endingBalance,
  initialCapital,
}: BacktestMetricsGridProps) {
  const m = metrics;
  const formatCurrency = useCurrencyFormatter();
  const hedging = isHedging(strategyKind);

  const totalReturnColor = m == null ? 'neutral' : m.totalReturn >= 0 ? 'profit' : 'loss';
  const totalReturnPctPrefix = m && m.totalReturnPct >= 0 ? '+' : '';

  // Calmar ratio: annualised return / |maxDrawdown|.
  // For backtest purposes we use totalReturnPct / |maxDrawdownPct| as a
  // return-per-drawdown ratio (not annualised, since the run window varies).
  // Shown only on hedging runs where it is the primary quality metric.
  const calmar =
    m?.maxDrawdownPct != null && m.maxDrawdownPct !== 0 && m?.totalReturnPct != null
      ? m.totalReturnPct / Math.abs(m.maxDrawdownPct)
      : null;

  // ---- HEDGING metrics set -----------------------------------------------
  if (hedging) {
    const calmarColor =
      calmar == null ? 'neutral' : calmar >= 2 ? 'profit' : calmar >= 1 ? 'neutral' : 'loss';

    // "Final portfolio" stat: show endingBalance if available.
    const hasEnding = endingBalance != null && endingBalance > 0;
    const endingColor = (() => {
      if (!hasEnding || initialCapital == null || initialCapital === 0) return 'neutral';
      return endingBalance! >= initialCapital ? 'profit' : 'loss';
    })();

    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          label="Max Drawdown"
          isLoading={isLoading}
          value={m ? `−${formatNum(m.maxDrawdownPct)}%` : '—'}
          valueColor={m?.maxDrawdownPct ? 'loss' : 'neutral'}
          sub={
            m && m.maxDrawdown != null
              ? formatCurrency(-Math.abs(m.maxDrawdown), { withSign: true })
              : undefined
          }
          subColor="loss"
          help={HELP.maxDrawdown}
        />
        <StatCard
          label="Return / Drawdown"
          isLoading={isLoading}
          value={calmar != null ? formatNum(calmar) : '—'}
          valueColor={calmarColor}
          sub="Calmar — return ÷ |max DD|"
          help={
            <>
              <p>
                <span className="font-mono">Total Return % ÷ |Max Drawdown %|</span>. Measures how
                much return was generated per unit of pain. A Calmar above 1 means the run returned
                more than it drew down; above 2 is excellent for an allocation strategy.
              </p>
              <p className="mt-1.5 text-text-muted">
                For HEDGING runs this is the primary quality signal — it rewards strategies that
                participate in BTC upside while meaningfully cutting the drawdown vs buy-hold.
              </p>
            </>
          }
        />
        <StatCard
          label="Final Portfolio"
          isLoading={isLoading}
          value={hasEnding ? formatCurrency(endingBalance!) : '—'}
          valueColor={endingColor}
          sub={
            hasEnding && initialCapital != null && initialCapital > 0
              ? `started ${formatCurrency(initialCapital)}`
              : undefined
          }
          help={
            <>
              <p>
                Ending USDT-equivalent portfolio value. For a HEDGING strategy this is the combined
                mark-to-market of the BTC + cash position at the close of the last bar.
              </p>
              <p className="mt-1.5 text-text-muted">
                The internal BTC/cash split at end-of-run is visible on the equity curve allocation
                overlay below.
              </p>
            </>
          }
        />
      </div>
    );
  }

  // ---- TRADING metrics set (unchanged) ------------------------------------
  const avgWin = m?.avgWinUsdt ?? null;
  const avgLossAbs = m?.avgLossUsdt == null ? null : Math.abs(m.avgLossUsdt);
  const rrrInfinite = avgWin != null && avgWin > 0 && (avgLossAbs == null || avgLossAbs === 0);
  const rrr = avgWin != null && avgLossAbs != null && avgLossAbs > 0 ? avgWin / avgLossAbs : null;
  const rrrTone =
    avgWin == null && avgLossAbs == null
      ? 'neutral'
      : rrrInfinite
        ? 'profit'
        : rrr == null
          ? 'neutral'
          : rrr >= 1
            ? 'profit'
            : 'loss';

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
        value={m?.psr != null ? `${formatNum(m.psr * 100, 1)}%` : '—'}
        valueColor={
          m?.psr == null ? 'neutral' : m.psr >= 0.95 ? 'profit' : m.psr >= 0.7 ? 'neutral' : 'loss'
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
          m && m.maxDrawdown != null
            ? formatCurrency(-Math.abs(m.maxDrawdown), { withSign: true })
            : undefined
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
        label="Avg R:R"
        isLoading={isLoading}
        value={rrrInfinite ? '∞' : rrr != null ? formatNum(rrr) : '—'}
        valueColor={rrrTone}
        sub="reward ÷ risk"
        help={HELP.avgRiskReward}
      />
      <StatCard
        label="Total Trades"
        isLoading={isLoading}
        value={m ? String(m.totalTrades) : '—'}
        valueColor="neutral"
        help={HELP.totalTrades}
      />
      <StatCard
        label="Avg Trade Return"
        isLoading={isLoading}
        value={
          m?.avgTradeReturnPct != null
            ? `${m.avgTradeReturnPct >= 0 ? '+' : ''}${formatNum(m.avgTradeReturnPct, 3)}%`
            : '—'
        }
        valueColor={
          m?.avgTradeReturnPct == null ? 'neutral' : m.avgTradeReturnPct >= 0 ? 'profit' : 'loss'
        }
        sub="per-trade · sizing-independent"
        help={HELP.avgTradeReturn}
      />
    </div>
  );
}
