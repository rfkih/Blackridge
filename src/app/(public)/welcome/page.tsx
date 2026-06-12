import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';
import { EquityChart } from '@/components/marketing/EquityChart';
import { HEDGE_CURVE, BUYHOLD_CURVE, HEDGE_STATS } from '@/components/marketing/hedgeBacktest';

export const metadata: Metadata = {
  title: 'Blackridge — Systematic trading & hedging for digital assets',
  description:
    'Research-built systematic strategies, validated with walk-forward and Monte-Carlo analysis, executed on your own exchange account. Non-custodial by design.',
};

const GATES = [
  {
    num: '01',
    title: 'Hypothesis',
    body: 'A written thesis: which inefficiency, why it persists, which regimes degrade it.',
  },
  {
    num: '02',
    title: 'Backtest',
    body: 'Point-in-time data across price, macro, on-chain, and sentiment. Slippage, funding, and fees modelled in.',
  },
  {
    num: '03',
    title: 'Walk-forward',
    body: 'Out-of-sample windows reserved before parameter selection. Robustness across folds, not one lucky curve.',
  },
  {
    num: '04',
    title: 'Monte-Carlo',
    body: 'Fills, slippage, and trade ordering stressed across thousands of resampled paths to bound the estimate.',
  },
  {
    num: '05',
    title: 'Paper, then live',
    body: 'Live ticks without real orders first. Capital follows only after the paper record agrees with the research.',
  },
] as const;

const CAPABILITIES = [
  {
    n: 'I.',
    h: 'Honest backtesting',
    p: 'Walk-forward and Monte-Carlo validation with realistic slippage and venue fees. Out-of-sample windows are reserved before parameters are chosen, and a market-impact model degrades edge as capital scales. Strategies that fail out-of-sample are retired, not re-tuned until they pass.',
    k: 'Backtest history available',
    v: 'up to 9 yrs',
  },
  {
    n: 'II.',
    h: 'Trading & hedging accounts',
    p: 'Run directional strategies from the library, or protect a spot stack: the EMA-band hedge holds BTC above the daily trend and rotates to USDT below it, managing your whole balance at deposit cost basis. Idle USDT is parked in Binance Simple Earn so sidelined cash still earns.',
    k: 'Account types',
    v: 'Trade · Hedge',
  },
  {
    n: 'III.',
    h: 'Risk controls that fire',
    p: 'Per-account daily-loss caps, position-concentration limits, and a drawdown kill-switch — enforced pre-trade, with no discretionary override. Every order, fill, and parameter change lands in an append-only audit ledger, timestamped and exportable.',
    k: 'Enforcement',
    v: 'Pre-trade',
  },
] as const;

const STRATEGY_INDEX = [
  {
    code: 'EMA-BAND',
    name: 'EMA-Band BTC Hedge',
    style: 'Hedging · spot trend',
    venue: 'Binance Spot',
    horizon: 'Daily',
    real: true,
  },
  {
    code: 'TILT',
    name: 'Dynamic BTC/USDT Tilt',
    style: 'Hedging · allocation',
    venue: 'Binance Spot',
    horizon: 'Daily',
    real: false,
  },
  {
    code: 'LSR-V2',
    name: 'Long-Short Reversal v2',
    style: 'Mean-reversion',
    venue: 'Spot + Perp',
    horizon: '4h',
    real: false,
  },
  {
    code: 'VCB',
    name: 'Volatility Compression Breakout',
    style: 'Breakout',
    venue: 'USDⓈ-M Perp',
    horizon: '15m',
    real: false,
  },
  {
    code: 'TPSE',
    name: 'Trend Pullback Single-Exit',
    style: 'Trend',
    venue: 'Binance Spot',
    horizon: '4h',
    real: false,
  },
  {
    code: 'XS-MOM',
    name: 'Cross-Sectional Momentum',
    style: 'Long-short',
    venue: 'Universe',
    horizon: 'Daily',
    real: false,
  },
] as const;

export default function WelcomePage() {
  return (
    <MarketingShell>
      <Hero />
      <Venues />
      <Process />
      <Capabilities />
      <StrategyIndex />
      <RiskBand />
      <DeskLetter />
      <MarketingCta />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="qp-hero">
      <div className="qp-wrap qp-hero-grid">
        <div>
          <div className="qp-hero-eyebrow">
            <span>Systematic</span>
            <span className="dot" />
            <span>Non-custodial</span>
            <span className="dot" />
            <span>Live since 2024</span>
          </div>
          <h1>Systematic strategies, validated before they trade.</h1>
          <p className="lede">
            Blackridge is a systematic trading and hedging platform for digital assets. Strategies
            are research-built, walk-forward validated, and executed on your own exchange account —
            your capital never leaves your custody.
          </p>
          <div className="qp-hero-cta">
            <Link href="/onboarding" className="qp-btn-primary lg">
              Open account
            </Link>
            <Link href="/product" className="qp-btn-textlink">
              Read how the platform works&ensp;→
            </Link>
          </div>
          <div className="qp-hero-stats">
            <div>
              <strong>9 yrs</strong>
              <span>Backtest history</span>
            </div>
            <div>
              <strong>7</strong>
              <span>Point-in-time data feeds</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Client funds custodied</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Automated execution</span>
            </div>
          </div>
        </div>
        <HeroFactsheet />
      </div>
    </section>
  );
}

function HeroFactsheet() {
  return (
    <div className="qp-fact-card">
      <div className="qp-fact-head">
        <div>
          <div className="qp-fact-lbl">EMA-band BTC hedge — backtest</div>
          <div className="qp-fact-val">
            {HEDGE_STATS.total}
            <span className="qp-fact-suf">total</span>
          </div>
        </div>
        <div className="qp-fact-meta">
          <div>
            <span>Window</span>
            <strong>2022&nbsp;–&nbsp;2026</strong>
          </div>
          <div>
            <span>vs buy-hold</span>
            <strong>{HEDGE_STATS.bhTotal}</strong>
          </div>
        </div>
      </div>
      <EquityChart hedge={HEDGE_CURVE} bh={BUYHOLD_CURVE} height={180} />
      <div className="qp-fact-grid">
        <div>
          <span>CAGR</span>
          <strong>{HEDGE_STATS.cagr}</strong>
        </div>
        <div>
          <span>Sharpe</span>
          <strong>{HEDGE_STATS.sharpe}</strong>
        </div>
        <div>
          <span>Max drawdown</span>
          <strong className="dn">{HEDGE_STATS.maxDd}</strong>
        </div>
        <div>
          <span>Buy-hold max DD</span>
          <strong className="dn">{HEDGE_STATS.bhMaxDd}</strong>
        </div>
      </div>
      <div className="qp-fact-foot">
        <span>
          Backtest on BTC daily closes, Jan 2022 – Jun 2026 (includes the 2022 bear). Costs modelled
          at 4 bps per allocation switch. Not live results. Past performance is not indicative of
          future results.
        </span>
      </div>
    </div>
  );
}

function Venues() {
  return (
    <section className="qp-venues">
      <div className="qp-wrap qp-venues-inner">
        <div className="qp-venues-lbl">Executes on</div>
        <div className="qp-venues-list">
          <span>Binance&nbsp;Spot</span>
          <span>Binance&nbsp;USDⓈ-M&nbsp;Futures</span>
        </div>
        <div className="qp-venues-aux">Your own account · scoped keys · withdrawals disabled</div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="qp-section">
      <div className="qp-wrap">
        <SectionHead
          eyebrow="Methodology"
          title="Five gates between an idea and your capital."
          sub="No strategy reaches a live account until every gate is green. The same gauntlet re-runs when you tune one to your own parameters."
        />
        <div className="qp-gates">
          {GATES.map((g) => (
            <article key={g.num}>
              <div className="num">{g.num}</div>
              <h3>{g.title}</h3>
              <p>{g.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap">
        <SectionHead
          eyebrow="The platform"
          title="An institutional desk, run from one dashboard."
          sub="Research, validation, execution, and risk in one system — with live P&L streamed over WebSocket and the same numbers your accountant will see."
        />
        <div className="qp-disc-grid">
          {CAPABILITIES.map((it) => (
            <article key={it.n}>
              <div className="qp-disc-num">{it.n}</div>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
              <div className="qp-disc-stat">
                <span>{it.k}</span>
                <strong>{it.v}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StrategyIndex() {
  return (
    <section className="qp-section">
      <div className="qp-wrap">
        <SectionHead
          eyebrow="Strategy library"
          title="The current book, in one table."
          sub="Each strategy ships with documented logic and tunable parameters. Per-strategy statistics render inside the app against your own data window — not as marketing numbers."
        />
        <div className="qp-table-wrap">
          <table className="qp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Strategy</th>
                <th>Style</th>
                <th>Venue</th>
                <th>Horizon</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {STRATEGY_INDEX.map((s) => (
                <tr key={s.code}>
                  <td className="code">{s.code}</td>
                  <td className="name">{s.name}</td>
                  <td>{s.style}</td>
                  <td className="mono">{s.venue}</td>
                  <td className="mono">{s.horizon}</td>
                  <td>
                    {s.real ? (
                      <span className="qp-status ink">Backtest ’22–’26</span>
                    ) : (
                      <span className="qp-status">In library</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qp-strat-foot">
          <span>
            The EMA-band figures above are a real backtest on the 2022–2026 window; other strategies
            are documented in the library without public performance claims.
          </span>
          <Link href="/strategies-overview">Browse the full library&ensp;→</Link>
        </div>
      </div>
    </section>
  );
}

function RiskBand() {
  return (
    <section className="qp-section brand">
      <div className="qp-wrap">
        <SectionHead
          eyebrow="Custody & controls"
          title="Your keys, your funds, your audit trail."
          sub="We never custody, we never co-mingle, and we never run a proprietary book against you. The same controls an institutional desk uses, applied to your own account."
        />
        <div className="qp-risk-grid">
          <article>
            <div className="num">01 — Custody</div>
            <h3>Capital remains with you.</h3>
            <p>
              Strategies trade through scoped Binance API keys with withdrawal permission explicitly
              denied. Keys are sealed with KMS-backed encryption before they leave your browser;
              only the trading workers can decrypt, at order-placement time.
            </p>
          </article>
          <article>
            <div className="num">02 — Limits</div>
            <h3>Pre-trade enforcement.</h3>
            <p>
              Per-account daily-loss caps, per-instrument concentration limits, and a portfolio
              drawdown kill-switch. A breach halts the strategy automatically — no discretionary
              override.
            </p>
          </article>
          <article>
            <div className="num">03 — Audit</div>
            <h3>Append-only ledger.</h3>
            <p>
              Every order, fill, cancel, and parameter change is timestamped to an append-only
              ledger and exportable. A complete, reproducible trace for any review.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function DeskLetter() {
  return (
    <section className="qp-letter-section">
      <div className="qp-wrap qp-letter-grid">
        <div className="qp-letter-meta">
          <div className="qp-letter-author">
            <div className="avatar">BR</div>
            <div>
              <strong>The Blackridge desk</strong>
              <span>On publishing honest numbers</span>
            </div>
          </div>
          <div className="qp-letter-date">Research note · 2026</div>
        </div>
        <blockquote className="qp-letter-quote">
          <p>
            “We publish drawdowns next to returns, label every illustrative figure as illustrative,
            and retire strategies that fail out-of-sample. If a number on this site isn’t a real
            backtest, it says so — and nothing here is a promise of future performance.”
          </p>
          <Link href="/strategies-overview" className="qp-letter-link">
            See how strategies are validated
          </Link>
        </blockquote>
      </div>
    </section>
  );
}
