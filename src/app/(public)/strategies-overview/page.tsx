import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';
import { StrategyFilterGrid, type PublicStrategy } from '@/components/marketing/StrategyFilterGrid';

export const metadata: Metadata = {
  title: 'Strategies',
  description:
    'A library of trading and spot-hedging strategies. Long-Short Reversal, Volatility Compression, Trend Pullback, the EMA-band BTC hedge, and more — each documented, tunable, and runnable in paper before you go live.',
};

// Hedging strategies carry a REAL backtest where one exists (EMA-band, computed on
// BTC daily 2022–2026). Trading strategies are shown with illustrative numbers — their
// real per-strategy stats render inside the app against your own data window.
const STRATEGIES: PublicStrategy[] = [
  {
    code: 'EMA-BAND',
    name: 'EMA-Band BTC Hedge',
    tagline: 'Holds BTC above the daily EMA band, rotates to USDT below it.',
    category: 'Hedging',
    illustrative: false,
    returnLabel: 'CAGR',
    pnl30d: 24.5,
    sharpe: 0.83,
    drawdown: -30,
    winRate: 0,
    trades30d: 0,
    footnote: 'Backtest 2022–26 · 22 switches',
    tags: ['BTC', 'Spot', 'Daily', 'Full-balance'],
    highlight: 'Robust 9-yr',
    sparkSeed: 41,
  },
  {
    code: 'TILT',
    name: 'Dynamic BTC/USDT Tilt',
    tagline: 'Leans the spot stack toward BTC or USDT with trend and volatility.',
    category: 'Hedging',
    pnl30d: 11.2,
    sharpe: 0.71,
    drawdown: -22,
    winRate: 0,
    trades30d: 0,
    footnote: 'Spot allocation · idle USDT earns',
    tags: ['BTC', 'Spot', 'Allocation'],
    sparkSeed: 42,
  },
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
    sparkSeed: 25,
  },
  {
    code: 'XS-MOM',
    name: 'Cross-Sectional Momentum',
    tagline: 'Ranks a universe and trades the spread, long strong / short weak.',
    category: 'Momentum',
    pnl30d: 5.6,
    sharpe: 1.1,
    drawdown: -6.2,
    winRate: 52.0,
    trades30d: 36,
    tags: ['Universe', 'Long-short'],
    sparkSeed: 28,
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
    tagline: 'Cross-asset momentum with monthly rebalance. Kept for benchmarking.',
    category: 'Momentum',
    pnl30d: -0.31,
    sharpe: 0.42,
    drawdown: -3.8,
    winRate: 55.5,
    trades30d: 18,
    tags: ['Spot', 'D', 'Benchmark'],
    sparkSeed: 26,
  },
];

const CATEGORIES = ['All', 'Hedging', 'Mean reversion', 'Breakout', 'Trend follow', 'Momentum'];

export default function StrategiesOverviewPage() {
  return (
    <MarketingShell activeNav="strategies">
      {}
      <section style={{ padding: '72px 0 32px' }}>
        <div className="mx-auto max-w-[1180px] px-5 text-center sm:px-8">
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
            Trading and spot-hedging strategies, each documented end-to-end and validated on up to
            nine years of history. Enable the ones you trust, tune the parameters, run them in paper
            first. The EMA-band hedge shows a real backtest; the rest are illustrative.
          </p>

          <StrategyFilterGrid strategies={STRATEGIES} categories={CATEGORIES} />
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="How we build them"
            title="From idea to live capital in five gates."
            sub="No strategy goes live until every gate is green. The same gauntlet runs when you tune one to your own parameters."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                step: '01',
                title: 'Hypothesis',
                body: 'Documented edge, regime, expected behavior.',
              },
              {
                step: '02',
                title: 'Backtest',
                body: 'Walk-forward across price + macro + sentiment; slippage + fees in.',
              },
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
        sub="Start free in paper trading. Connect your Binance account whenever you’re ready."
      />
    </MarketingShell>
  );
}
