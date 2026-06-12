import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';
import { EquityChart } from '@/components/marketing/EquityChart';
import { HEDGE_CURVE, BUYHOLD_CURVE, HEDGE_STATS } from '@/components/marketing/hedgeBacktest';

export const metadata: Metadata = {
  title: 'Product — A self-serve algorithmic trading & hedging desk',
  description:
    'Blackridge runs systematic trading and spot-hedging strategies on your own Binance account. Non-custodial — your funds never leave your exchange. Backtest, deploy, monitor from one dashboard.',
};

const ACCOUNT_TYPES = [
  {
    tag: 'Trading account',
    h: 'Run directional strategies.',
    p: 'Enable systematic strategies from the library on BTC, ETH and majors. Algorithmic or ML-gated. Per-account risk caps, position limits, and a drawdown kill-switch are armed before the first order.',
    points: ['Strategy library', 'Algo + ML-gated modes', 'Per-account risk caps'],
  },
  {
    tag: 'Hedging account',
    h: 'Protect a spot stack.',
    p: 'Hold BTC through the bull, rotate to USDT when the daily trend breaks down. Manage your whole BTC balance at deposit cost basis, and park idle USDT in Binance Simple Earn so cash on the sidelines still earns. Switch an account between Trading and Hedging at any time.',
    points: ['Spot EMA-band hedge', 'Full-balance management', 'Idle-cash yield (Simple Earn)'],
  },
] as const;

const DISCIPLINE = [
  {
    n: 'I.',
    h: 'Research',
    p: 'Every strategy begins with a written thesis: which inefficiency it exploits, why it persists, and which regimes degrade it. Strategies that fail out-of-sample are retired, not tuned until they pass.',
    k: 'Point-in-time data feeds',
    v: '7',
  },
  {
    n: 'II.',
    h: 'Construction',
    p: 'Backtests use point-in-time data — price, macro, on-chain, sentiment — with realistic slippage, funding, and venue fees. Out-of-sample windows are reserved before parameter selection. Walk-forward and Monte-Carlo establish a confidence interval, not a single curve. A market-impact model degrades edge as capital scales.',
    k: 'Backtest history available',
    v: 'up to 9 yrs',
  },
  {
    n: 'III.',
    h: 'Execution',
    p: 'Strategies run on your own Binance account via scoped API keys with withdrawals disabled. Every order, fill, and parameter change is timestamped to our ledger and reconcilable against the venue.',
    k: 'Client funds we custody',
    v: '0',
  },
] as const;

const SIGNALS = [
  {
    n: 'I.',
    h: 'Macro',
    sources: 'FRED · ALFRED · ForexFactory',
    p: 'Real yields, DXY, VIX, M2, headline CPI, and the live econ calendar (FOMC, CPI, NFP, unemployment). Strategies size down ahead of named events and re-enter once realised vol re-anchors.',
    k: 'Series tracked',
    v: '32',
  },
  {
    n: 'II.',
    h: 'Market structure',
    sources: 'Binance · CoinGecko',
    p: 'Funding rate, open interest, top-trader long-short, taker buy/sell volume, plus global market cap and BTC dominance. Conviction is a function of crowding and flow direction, not price alone.',
    k: 'Update cadence',
    v: '1 min',
  },
  {
    n: 'III.',
    h: 'On-chain & sentiment',
    sources: 'CoinMetrics · DeFiLlama · alternative.me',
    p: 'Exchange netflow, active addresses, realised cap, stablecoin supply, chain TVL, and the Fear & Greed Index. Regime tags shift the strategy mix toward mean-reversion or trend depending on extremity.',
    k: 'Fear & Greed history',
    v: '> 6 yrs daily',
  },
] as const;

const STRATEGIES = [
  {
    code: 'LSR-V2',
    name: 'Long-Short Reversal v2',
    kind: 'Trading · mean-reversion',
    desc: 'Fades overextended candles on BTC & ETH.',
  },
  {
    code: 'VCB',
    name: 'Volatility Compression',
    kind: 'Trading · breakout',
    desc: 'Enters Bollinger squeezes confirmed by rising relative volume.',
  },
  {
    code: 'TPSE',
    name: 'Trend Pullback Single-Exit',
    kind: 'Trading · trend',
    desc: 'Buys pullbacks within an established trend; single take-profit.',
  },
  {
    code: 'XS-MOM',
    name: 'Cross-Sectional Momentum',
    kind: 'Trading · long-short',
    desc: 'Ranks a universe and trades the spread, long the strong / short the weak.',
  },
  {
    code: 'EMA-BAND',
    name: 'EMA-Band BTC Hedge',
    kind: 'Hedging · spot',
    desc: 'Holds BTC above the daily EMA band, rotates to USDT below it.',
  },
  {
    code: 'TILT',
    name: 'Dynamic BTC/USDT Tilt',
    kind: 'Hedging · allocation',
    desc: 'Leans the spot stack toward BTC or USDT with trend and volatility.',
  },
] as const;

const RISK = [
  {
    num: '01 — Custody',
    h: 'Capital remains with you.',
    p: 'Strategies trade through scoped Binance API keys with withdrawal permission explicitly denied. Funds never leave your exchange account, and the connection is reconciled against the venue.',
  },
  {
    num: '02 — Limits',
    h: 'Pre-trade enforcement.',
    p: 'Per-account daily-loss caps, per-instrument concentration limits, and a portfolio drawdown kill-switch. A breach halts the strategy automatically — no discretionary override.',
  },
  {
    num: '03 — Audit',
    h: 'Append-only ledger.',
    p: 'Every order, fill, cancel, and parameter change is timestamped to an append-only ledger and exportable. A complete, reproducible trace for any review.',
  },
] as const;

export default function ProductPage() {
  return (
    <MarketingShell activeNav="product">
      <Hero />
      <Venues />
      <AccountTypes />
      <Discipline />
      <Signals />
      <StrategyLibrary />
      <Risk />
      <Contact />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="qp-hero">
      <div className="qp-wrap qp-hero-grid">
        <div className="qp-hero-copy">
          <div className="qp-hero-eyebrow">
            <span>Live since 2024</span>
          </div>
          <h1>A self-serve trading &amp; hedging desk you actually&nbsp;control.</h1>
          <p className="lede">
            Blackridge runs systematic strategies on your own Binance account. We hold no client
            capital — your funds stay on your exchange, accessible only through scoped API keys with
            withdrawals disabled. Backtest, deploy, and monitor from one dashboard.
          </p>
          <div className="qp-hero-cta">
            <Link href="/onboarding" className="qp-btn-primary lg">
              Open account
            </Link>
            <Link href="/strategies-overview" className="qp-btn-textlink">
              Browse strategies &nbsp;→
            </Link>
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
        <div className="qp-venues-aux">More venues on the roadmap</div>
      </div>
    </section>
  );
}

function AccountTypes() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Two ways to run</div>
            <h2>One account. Trade, or hedge.</h2>
          </div>
          <p className="qp-section-lede">
            Every account is either a Trading account or a Hedging account — and you can switch
            between them at any time. Incompatible strategies disable automatically and restore when
            you switch back.
          </p>
        </header>
        <div className="qp-disc-grid">
          {ACCOUNT_TYPES.map((a) => (
            <article key={a.tag}>
              <div
                className="qp-disc-num"
                style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                {a.tag}
              </div>
              <h3>{a.h}</h3>
              <p>{a.p}</p>
              <div className="qp-disc-stat" style={{ display: 'block' }}>
                {a.points.map((pt) => (
                  <span key={pt} style={{ display: 'block', margin: '2px 0' }}>
                    • {pt}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Discipline() {
  return (
    <section className="qp-section">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">How we operate</div>
            <h2>Discipline, in three movements.</h2>
          </div>
          <p className="qp-section-lede">
            Systematic discipline applied to every decision — research, construction, and execution
            — with your capital never leaving your own exchange.
          </p>
        </header>

        <div className="qp-disc-grid">
          {DISCIPLINE.map((it) => (
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

function Signals() {
  return (
    <section className="qp-section">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Inputs</div>
            <h2>Signals, beyond the price tape.</h2>
          </div>
          <p className="qp-section-lede">
            Every strategy scores regime, conviction, and exhaustion against seven point-in-time
            external feeds — macro, market microstructure, on-chain flows, and sentiment. The candle
            is the smallest of them.
          </p>
        </header>

        <div className="qp-disc-grid">
          {SIGNALS.map((it) => (
            <article key={it.n}>
              <div className="qp-disc-num">{it.n}</div>
              <h3>{it.h}</h3>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--qp-ink-muted)',
                  fontWeight: 600,
                  margin: '-6px 0 14px',
                }}
              >
                {it.sources}
              </div>
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

function StrategyLibrary() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Strategy library</div>
            <h2>Trading and hedging, side by side.</h2>
          </div>
          <p className="qp-section-lede">
            Each strategy ships with documented logic and tunable parameters. Enable the ones you
            trust, run them in paper first, then connect live. Per-strategy backtest stats render
            inside the app from your own data window.
          </p>
        </header>

        <div className="qp-disc-grid">
          {STRATEGIES.map((s) => (
            <article key={s.code}>
              <div className="qp-disc-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                {s.code}
              </div>
              <h3 style={{ fontSize: 18 }}>{s.name}</h3>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--qp-ink-muted)',
                  fontWeight: 600,
                  margin: '-6px 0 12px',
                }}
              >
                {s.kind}
              </div>
              <p>{s.desc}</p>
              <div className="chart" style={{ marginTop: 4, color: 'var(--qp-ink-muted)' }}>
                <Sparkline
                  data={makeSpark(s.code.length + s.name.length, 28)}
                  color="currentColor"
                  width={300}
                  height={36}
                  fill={false}
                />
              </div>
            </article>
          ))}
        </div>

        <div className="qp-strat-foot">
          <span>
            Strategy sparklines are illustrative. The EMA-band hedge figures above are a real
            backtest on the 2022–2026 window.
          </span>
          <Link href="/strategies-overview">Browse all strategies &nbsp;→</Link>
        </div>
      </div>
    </section>
  );
}

function Risk() {
  return (
    <section className="qp-section brand">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Risk &amp; controls</div>
            <h2>Three guarantees we put in writing.</h2>
          </div>
          <p className="qp-section-lede">
            We never custody, we never co-mingle, and we never run a proprietary book against you.
            The same controls an institutional desk uses, applied to your own account.
          </p>
        </header>
        <div className="qp-risk-grid">
          {RISK.map((it) => (
            <article key={it.num}>
              <div className="num">{it.num}</div>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap qp-contact-grid">
        <div className="qp-contact-copy">
          <div className="qp-section-eye">Speak with the desk</div>
          <h2>Get in touch.</h2>
          <p>
            Happy to walk through strategy selection, hedging setup, risk settings, or onboarding.
            Reach the desk and we&apos;ll get back to you.
          </p>
          <div className="qp-contact-meta">
            <div>
              <span>Desk</span>
              <strong>desk@blackridge.capital</strong>
            </div>
          </div>
        </div>
        <div className="qp-contact-action">
          <Link href="/onboarding" className="qp-btn-primary lg">
            Open account
          </Link>
          <span className="qp-contact-note">
            No credit card required. Paper trade free before connecting a real exchange.
          </span>
        </div>
      </div>
    </section>
  );
}
