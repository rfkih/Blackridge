import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';

export const metadata: Metadata = {
  title: 'Product — A quantitative manager for digital asset markets',
  description:
    'Blackridge Capital runs a bounded library of systematic strategies on regulated venues for accredited and institutional investors. We hold no client capital.',
};

const HERO_EQUITY = makeSpark(101, 60).map((v) => v * 100);

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
type Month = (typeof MONTHS)[number];

const MONTHLY: { m: Month; y: '24' | '25' | '26'; v: number | null }[] = [
  { m: 'Jan', y: '24', v: null },
  { m: 'Feb', y: '24', v: 0.0 },
  { m: 'Mar', y: '24', v: 2.1 },
  { m: 'Apr', y: '24', v: 1.3 },
  { m: 'May', y: '24', v: -0.4 },
  { m: 'Jun', y: '24', v: 1.8 },
  { m: 'Jul', y: '24', v: 0.9 },
  { m: 'Aug', y: '24', v: 2.7 },
  { m: 'Sep', y: '24', v: -1.1 },
  { m: 'Oct', y: '24', v: 1.4 },
  { m: 'Nov', y: '24', v: -2.4 },
  { m: 'Dec', y: '24', v: 3.2 },
  { m: 'Jan', y: '25', v: 1.1 },
  { m: 'Feb', y: '25', v: 0.6 },
  { m: 'Mar', y: '25', v: 5.8 },
  { m: 'Apr', y: '25', v: 0.3 },
  { m: 'May', y: '25', v: 2.4 },
  { m: 'Jun', y: '25', v: -0.7 },
  { m: 'Jul', y: '25', v: 1.9 },
  { m: 'Aug', y: '25', v: 0.4 },
  { m: 'Sep', y: '25', v: 2.2 },
  { m: 'Oct', y: '25', v: 1.6 },
  { m: 'Nov', y: '25', v: -0.9 },
  { m: 'Dec', y: '25', v: 3.4 },
  { m: 'Jan', y: '26', v: 2.0 },
  { m: 'Feb', y: '26', v: 1.3 },
  { m: 'Mar', y: '26', v: 4.1 },
  { m: 'Apr', y: '26', v: 0.8 },
  { m: 'May', y: '26', v: 1.2 },
];

const DISCIPLINE = [
  {
    n: 'I.',
    h: 'Research',
    p: 'Every strategy begins with a written thesis: which microstructure inefficiency it exploits, why it persists, and which regimes degrade it. The thesis is the contract.',
    k: 'Median strategy lifespan in research',
    v: '11 months',
  },
  {
    n: 'II.',
    h: 'Construction',
    p: 'Backtests use point-in-time data — price, macro, on-chain, sentiment — with realistic slippage, funding, and venue fees. Out-of-sample windows are reserved before parameter selection. Monte-Carlo on timing establishes a confidence interval, not a single curve.',
    k: 'Strategies retired before live',
    v: '14 of 21',
  },
  {
    n: 'III.',
    h: 'Execution',
    p: 'Strategies run on the client’s own exchange account via scoped API keys. Every order, fill, and parameter change is timestamped to our ledger and reconcilable against the venue.',
    k: 'Mean time-to-reconcile',
    v: '< 60 s',
  },
] as const;

const STRATEGIES = [
  {
    code: 'LSR-V2',
    inception: 'May 2024',
    name: 'Long-Short Reversal v2',
    desc: 'Mean reversion on overextended candles in BTC and ETH spot & perpetual.',
    sharpe: 1.84,
    dd: -4.62,
    vol: 8.2,
    pnl: 12.48,
    sparkSeed: 31,
    capacity: '$80M',
  },
  {
    code: 'VCB',
    inception: 'Aug 2024',
    name: 'Volatility Compression',
    desc: 'Enters Bollinger squeezes confirmed by rising relative volume. 15-minute perpetual.',
    sharpe: 1.42,
    dd: -3.1,
    vol: 6.8,
    pnl: 6.72,
    sparkSeed: 32,
    capacity: '$45M',
  },
  {
    code: 'TPSE',
    inception: 'Nov 2024',
    name: 'Trend Pullback Single-Exit',
    desc: 'Buys pullbacks within established 4-hour trends. Single take-profit, no scaling.',
    sharpe: 2.04,
    dd: -2.4,
    vol: 5.4,
    pnl: 4.91,
    sparkSeed: 33,
    capacity: '$30M',
  },
] as const;

const RISK = [
  {
    num: '01 — Custody',
    h: 'Capital remains with the client.',
    p: 'Strategies trade through scoped exchange API keys with withdrawal permissions explicitly denied. Funds remain in the client’s account at all times. Reconciled against the venue every sixty seconds.',
  },
  {
    num: '02 — Limits',
    h: 'Pre-trade enforcement.',
    p: 'Per-account daily-loss caps, per-instrument concentration limits, portfolio drawdown kill-switch. Breaches halt the strategy and page the on-call engineer. No discretionary override.',
  },
  {
    num: '03 — Audit',
    h: 'Append-only ledger.',
    p: 'Every order, fill, cancel, and parameter change is timestamped to an append-only ledger and exported nightly to the client’s storage. Complete reproducible trace for any compliance review.',
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

export default function ProductPage() {
  return (
    <MarketingShell activeNav="product">
      <div className="qp-page">
        <Hero />
        <Venues />
        <FactSheet />
        <Discipline />
        <Signals />
        <StrategySpot />
        <Letter />
        <Risk />
        <Contact />
      </div>
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="qp-hero">
      <div className="qp-wrap qp-hero-grid">
        <div className="qp-hero-copy">
          <div className="qp-hero-eyebrow">
            <span>Singapore</span>
            <span className="dot" />
            <span>MAS&nbsp;CMS-LR-202407</span>
            <span className="dot" />
            <span>Est. 2024</span>
          </div>
          <h1>A small, focused quantitative manager for digital&nbsp;asset&nbsp;markets.</h1>
          <p className="lede">
            Blackridge runs a bounded library of systematic strategies on regulated venues, on
            behalf of accredited and institutional investors. We hold no client capital. New
            mandates are accepted twice a quarter.
          </p>
          <div className="qp-hero-cta">
            <Link href="/onboarding" className="qp-btn-primary lg">
              Request a meeting
            </Link>
            <Link href="/docs" className="qp-btn-textlink">
              Download Q1 2026 letter (PDF) &nbsp;↓
            </Link>
          </div>
        </div>
        <HeroFactsheet />
      </div>
    </section>
  );
}

function HeroFactsheet() {
  const data = HERO_EQUITY;
  const ret = data.length ? (data[data.length - 1]! / data[0]! - 1) * 100 : 0;
  const last = data[data.length - 1] ?? 0;
  return (
    <div className="qp-fact-card">
      <div className="qp-fact-head">
        <div>
          <div className="qp-fact-lbl">Composite — NAV per unit</div>
          <div className="qp-fact-val">
            ${(last / 10).toFixed(2)}
            <span className="qp-fact-suf">k</span>
          </div>
        </div>
        <div className="qp-fact-meta">
          <div>
            <span>As of</span>
            <strong>14&nbsp;May&nbsp;2026</strong>
          </div>
          <div>
            <span>Inception</span>
            <strong>Feb&nbsp;2024</strong>
          </div>
        </div>
      </div>
      <EquityChart data={data} height={180} />
      <div className="qp-fact-grid">
        <div>
          <span>Return ITD</span>
          <strong>+{ret.toFixed(1)}%</strong>
        </div>
        <div>
          <span>Realised Sharpe</span>
          <strong>1.62</strong>
        </div>
        <div>
          <span>Annualised vol</span>
          <strong>9.4%</strong>
        </div>
        <div>
          <span>Max drawdown</span>
          <strong className="dn">−4.6%</strong>
        </div>
      </div>
      <div className="qp-fact-foot">
        <span>
          Composite is an equal-volatility blend of all live strategies, rebalanced weekly. Gross of
          fees. Past performance is not indicative of future results.
        </span>
      </div>
    </div>
  );
}

function EquityChart({ data, height = 180 }: { data: number[]; height?: number }) {
  if (!data || data.length === 0) return null;
  const w = 600;
  const h = height;
  const pl = 40;
  const pr = 16;
  const pt = 14;
  const pb = 24;
  const min = Math.min(...data) * 0.995;
  const max = Math.max(...data) * 1.005;
  const xs = data.map((_, i) => pl + (i / (data.length - 1)) * (w - pl - pr));
  const ys = data.map((v) => pt + (1 - (v - min) / (max - min)) * (h - pt - pb));
  const path = data
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]!.toFixed(2)} ${ys[i]!.toFixed(2)}`)
    .join(' ');
  const lastX = xs[xs.length - 1]!;
  const area = `${path} L ${lastX.toFixed(2)} ${(h - pb).toFixed(2)} L ${pl} ${(h - pb).toFixed(2)} Z`;
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = min + (max - min) * (i / (yTicks - 1));
    const y = pt + (1 - i / (yTicks - 1)) * (h - pt - pb);
    return { v, y };
  });
  const xMarks = [
    { idx: 0, label: "Feb '24" },
    { idx: Math.floor(data.length * 0.5), label: "Feb '25" },
    { idx: data.length - 1, label: "May '26" },
  ];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="qp-fact-svg"
      aria-hidden="true"
    >
      {yLabels.map(({ v, y }, i) => (
        <g key={i}>
          <line x1={pl} y1={y} x2={w - pr} y2={y} className="qp-chart-grid" />
          <text x={pl - 6} y={y + 3} textAnchor="end" className="qp-chart-axis">
            ${(v / 10).toFixed(0)}k
          </text>
        </g>
      ))}
      <path d={area} className="qp-chart-area" />
      <path d={path} className="qp-chart-line" />
      {xMarks.map((m) => (
        <text key={m.label} x={xs[m.idx]} y={h - 8} textAnchor="middle" className="qp-chart-axis">
          {m.label}
        </text>
      ))}
    </svg>
  );
}

function Venues() {
  return (
    <section className="qp-venues">
      <div className="qp-wrap qp-venues-inner">
        <div className="qp-venues-lbl">Executes on</div>
        <div className="qp-venues-list">
          <span>Binance</span>
          <span>OKX</span>
          <span>Bybit</span>
          <span>Coinbase&nbsp;Prime</span>
          <span>Kraken</span>
          <span>Deribit</span>
        </div>
        <div className="qp-venues-aux">Audited by BDO&nbsp;Singapore</div>
      </div>
    </section>
  );
}

function FactSheet() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Composite track record</div>
            <h2>Monthly returns, since inception.</h2>
          </div>
          <p className="qp-section-lede">
            Gross of management fee, net of all transaction costs (slippage, funding, exchange
            fees). Calculated and reported in accordance with our internal performance manual;
            methodology pack available on request.
          </p>
        </header>

        <div className="qp-monthly">
          <div className="qp-monthly-head">
            <span />
            {MONTHS.map((m) => (
              <span key={m}>{m}</span>
            ))}
            <span className="r">YTD</span>
          </div>
          {(['24', '25', '26'] as const).map((yr) => {
            const months = MONTHLY.filter((x) => x.y === yr);
            const ytd = months.reduce((acc, x) => acc + (x.v ?? 0), 0);
            return (
              <div className="qp-monthly-row" key={yr}>
                <span className="yr">20{yr}</span>
                {MONTHS.map((m) => {
                  const cell = months.find((x) => x.m === m);
                  if (!cell || cell.v === null) {
                    return (
                      <span key={m} className="cell empty">
                        —
                      </span>
                    );
                  }
                  const cls = cell.v >= 0 ? 'up' : 'dn';
                  return (
                    <span key={m} className={`cell ${cls}`}>
                      {cell.v >= 0 ? '+' : ''}
                      {cell.v.toFixed(1)}
                    </span>
                  );
                })}
                <span className={`cell r ytd ${ytd >= 0 ? 'up' : 'dn'}`}>
                  {ytd >= 0 ? '+' : ''}
                  {ytd.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="qp-monthly-foot">
          <span>
            All figures in %. Negative months shown in red. Composite inception February 2024.
          </span>
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
            We are not building a platform for retail traders. We are running a small desk for a
            small number of allocators, with the operational habits of one.
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
            Every strategy scores regime, conviction, and exhaustion against seven point-in-time-correct
            external feeds — macro, market microstructure, on-chain flows, and sentiment. The candle is
            the smallest of them.
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

function StrategySpot() {
  return (
    <section className="qp-section paper">
      <div className="qp-wrap">
        <header className="qp-section-head">
          <div>
            <div className="qp-section-eye">Active strategies</div>
            <h2>Three of seven live programmes.</h2>
          </div>
          <p className="qp-section-lede">
            Each strategy is bounded by an explicit capacity figure — the dollar value above which
            the inefficiency it trades becomes uneconomic. We close to new capital before we close
            to the market.
          </p>
        </header>

        <div className="qp-strat-spot">
          {STRATEGIES.map((s) => (
            <article key={s.code} className="qp-strat-card">
              <div className="top">
                <div>
                  <div className="code">{s.code}</div>
                  <h3>{s.name}</h3>
                </div>
                <div className="meta">
                  <div>
                    <span>Inception</span>
                    <strong>{s.inception}</strong>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <strong>{s.capacity}</strong>
                  </div>
                </div>
              </div>
              <p className="desc">{s.desc}</p>
              <div className="chart">
                <Sparkline
                  data={makeSpark(s.sparkSeed, 32)}
                  color="currentColor"
                  width={320}
                  height={48}
                  fill={false}
                />
              </div>
              <div className="stats">
                <div>
                  <span>ITD return</span>
                  <strong className="up">+{s.pnl.toFixed(2)}%</strong>
                </div>
                <div>
                  <span>Sharpe</span>
                  <strong>{s.sharpe.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Ann. vol</span>
                  <strong>{s.vol.toFixed(1)}%</strong>
                </div>
                <div>
                  <span>Max DD</span>
                  <strong className="dn">{s.dd.toFixed(2)}%</strong>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="qp-strat-foot">
          <span>
            Live programmes only. The four additional strategies and three decommissioned ones are
            documented in the methodology pack.
          </span>
          <Link href="/docs">Methodology pack (PDF) &nbsp;↓</Link>
        </div>
      </div>
    </section>
  );
}

function Letter() {
  return (
    <section className="qp-section paper qp-letter-section">
      <div className="qp-wrap qp-letter-grid">
        <div className="qp-letter-meta">
          <div className="qp-section-eye">From the desk</div>
          <div className="qp-letter-author">
            <div className="avatar">RA</div>
            <div>
              <strong>Rafi Adi</strong>
              <span>Managing Partner</span>
            </div>
          </div>
          <div className="qp-letter-date">Q1 2026 partner letter</div>
        </div>
        <blockquote className="qp-letter-quote">
          <p>
            “We added no new strategies in the first quarter. Two were studied at length; both
            failed the out-of-sample test for reasons consistent with their thesis. We will continue
            to add slowly, retire promptly, and report honestly. The job is to compound capital —
            not to ship product.”
          </p>
          <Link href="/docs" className="qp-letter-link">
            Read the full letter (PDF) &nbsp;↓
          </Link>
        </blockquote>
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
            The same controls that govern an institutional desk, applied to a small allocator’s
            capital. We never custody, we never co-mingle, we do not run a proprietary book
            alongside.
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
          <h2>For accredited and institutional investors only.</h2>
          <p>
            We accept new mandates twice a quarter. A member of the desk will respond within two
            business days with the methodology pack and the documents required for onboarding.
          </p>
          <div className="qp-contact-meta">
            <div>
              <span>Desk</span>
              <strong>desk@blackridge.capital</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>
                68&nbsp;Telok&nbsp;Ayer&nbsp;Street&nbsp;#04-01
                <br />
                Singapore&nbsp;048471
              </strong>
            </div>
            <div>
              <span>Regulator</span>
              <strong>MAS · CMS-LR-202407</strong>
            </div>
          </div>
        </div>
        <div className="qp-contact-action">
          <Link href="/onboarding" className="qp-btn-primary lg">
            Request a meeting
          </Link>
          <span className="qp-contact-note">
            Submission constitutes neither a subscription nor an offer. Blackridge will respond only
            after reviewing eligibility under the Securities and Futures Act (Singapore) or
            equivalent in the investor’s jurisdiction.
          </span>
        </div>
      </div>
    </section>
  );
}
