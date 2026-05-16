import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';
import {
  StrategyFilterGrid,
  type PublicStrategy,
} from '@/components/marketing/StrategyFilterGrid';

export const metadata: Metadata = {
  title: 'Strategies',
  description:
    'Seven production strategies battle-tested on live capital. Long-Short Reversal, Volatility Compression, Trend Pullback, and more — fork them or run yours alongside.',
};

const STRATEGIES: PublicStrategy[] = [
  {
    code: 'LSR-V2',
    name: 'Long-Short Reversal v2',
    tagline: 'Mean-reversion against the trend on overextended candles.',
    category: 'Mean reversion',
    pnl30d: 12.48,
    sharpe: 1.84,
    drawdown: -4.62,
    winRate: 58.4,
    trades30d: 142,
    tags: ['BTC, ETH', 'Spot + Perp', '4h'],
    highlight: 'Top performer',
    sparkSeed: 21,
  },
  {
    code: 'VCB',
    name: 'Volatility Compression Breakout',
    tagline: 'Enters squeezes that break with rising volume.',
    category: 'Breakout',
    pnl30d: 6.72,
    sharpe: 1.42,
    drawdown: -3.1,
    winRate: 51.1,
    trades30d: 88,
    tags: ['Perp', '15m'],
    highlight: 'Most popular',
    sparkSeed: 22,
  },
  {
    code: 'TPSE',
    name: 'Trend Pullback Single-Exit',
    tagline: 'Buys pullbacks within established trends, single TP.',
    category: 'Trend follow',
    pnl30d: 4.91,
    sharpe: 2.04,
    drawdown: -2.4,
    winRate: 61.7,
    trades30d: 47,
    tags: ['Spot', '4h'],
    highlight: 'Best Sharpe',
    sparkSeed: 25,
  },
  {
    code: 'VBO',
    name: 'Volume Breakout',
    tagline: 'Fades or follows breakouts based on RVOL z-score.',
    category: 'Breakout',
    pnl30d: 2.84,
    sharpe: 0.92,
    drawdown: -5.74,
    winRate: 47.0,
    trades30d: 64,
    tags: ['Perp', '1h'],
    sparkSeed: 23,
  },
  {
    code: 'LSR',
    name: 'Long-Short Reversal',
    tagline: 'Original mean-reversion, kept for benchmarking.',
    category: 'Mean reversion',
    pnl30d: 8.23,
    sharpe: 1.18,
    drawdown: -7.2,
    winRate: 53.6,
    trades30d: 312,
    tags: ['Legacy', 'BTC'],
    sparkSeed: 24,
  },
  {
    code: 'TSMOM',
    name: 'Time-Series Momentum',
    tagline: 'Cross-asset momentum with monthly rebalance.',
    category: 'Momentum',
    pnl30d: -0.31,
    sharpe: 0.42,
    drawdown: -3.8,
    winRate: 55.5,
    trades30d: 18,
    tags: ['Spot', 'D'],
    sparkSeed: 26,
  },
  {
    code: 'RAHT-V1',
    name: 'Range-Asymmetric Hedge Trade',
    tagline: 'Captures pinning effect into weekly options expiry.',
    category: 'Volatility',
    pnl30d: 3.45,
    sharpe: 1.62,
    drawdown: -1.9,
    winRate: 64.2,
    trades30d: 12,
    tags: ['Perp', 'Weekly'],
    sparkSeed: 27,
  },
];

const CATEGORIES = [
  'All',
  'Mean reversion',
  'Breakout',
  'Trend follow',
  'Momentum',
  'Volatility',
];

export default function StrategiesOverviewPage() {
  return (
    <MarketingShell activeNav="strategies">
      {/* Hero */}
      <section style={{ padding: '72px 0 32px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 text-center">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--brand-600)' }}
          >
            Strategy library
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(36px, 6vw, 56px)',
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '14px 0 16px',
              color: 'var(--text-primary)',
            }}
          >
            Start with a strategy. Not a blinking cursor.
          </h1>
          <p
            className="mx-auto"
            style={{
              fontSize: 'clamp(15px, 2vw, 19px)',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              maxWidth: 620,
              margin: '0 auto 28px',
            }}
          >
            Seven strategies, each documented end-to-end with three years of out-of-sample
            results. Enable the ones you trust — fork them, retune them, run yours alongside.
          </p>

          <StrategyFilterGrid strategies={STRATEGIES} categories={CATEGORIES} />
        </div>
      </section>

      {/* How we build them */}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="How we build them"
            title="From idea to live capital in five gates."
            sub="No strategy goes live until every gate is green. Same gauntlet runs on yours when you fork."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { step: '01', title: 'Hypothesis', body: 'Documented edge, regime, expected behavior.' },
              { step: '02', title: 'Backtest', body: 'Walk-forward across price + macro + sentiment; slippage + fees in.' },
              { step: '03', title: 'Monte-Carlo', body: 'Stress fills, slippage, ordering.' },
              { step: '04', title: 'Paper', body: 'Live ticks, no real orders, 30 days.' },
              { step: '05', title: 'Live', body: 'Tiny size first; risk caps armed.' },
            ].map((g) => (
              <div key={g.step} className="br-card" style={{ padding: 20, borderRadius: 16 }}>
                <div
                  className="font-mono text-[11px] font-bold"
                  style={{ color: 'var(--brand-600)' }}
                >
                  {g.step}
                </div>
                <div
                  className="mt-2 font-display text-[16px] font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {g.title}
                </div>
                <div className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {g.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        title="Run one of these on your account."
        sub="Free for 14 days with paper trading. Connect a real exchange whenever you’re ready."
      />
    </MarketingShell>
  );
}
