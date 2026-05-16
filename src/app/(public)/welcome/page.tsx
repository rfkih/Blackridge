import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Play, Beaker, Bot, LineChart, Shield, Zap, Layers } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';

export const metadata: Metadata = {
  title: 'Blackridge — Algorithmic crypto trading',
  description:
    'Run your strategies on Binance Futures while you sleep. Backtest, deploy, monitor — from one calm dashboard built for serious traders.',
};

const STRATEGY_HIGHLIGHTS = [
  {
    code: 'LSR-V2',
    name: 'Long-Short Reversal v2',
    tag: 'Top performer',
    pnl: '+12.48%',
    sharpe: '1.84',
  },
  {
    code: 'VCB',
    name: 'Volatility Compression',
    tag: 'Most popular',
    pnl: '+6.72%',
    sharpe: '1.42',
  },
  {
    code: 'TPSE',
    name: 'Trend Pullback Single-Exit',
    tag: 'Best Sharpe',
    pnl: '+4.91%',
    sharpe: '2.04',
  },
];

export default function WelcomePage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ padding: '72px 0 56px', background: 'var(--bg-base)' }}
      >
        <div className="relative z-[1] mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-[60px]">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
            >
              <span className="br-live-dot" />
              1,400+ traders running live
            </span>
            <h1
              className="font-display font-extrabold"
              style={{
                fontSize: "clamp(40px, 7vw, 64px)",
                lineHeight: 1.02,
                letterSpacing: '-0.032em',
                margin: '20px 0 22px',
                color: 'var(--text-primary)',
              }}
            >
              Algo trading,{' '}
              <em style={{ fontStyle: 'normal', color: 'var(--brand-600)' }}>
                without the spreadsheet.
              </em>
            </h1>
            <p
              className="m-0 mb-8"
              style={{
                fontSize: 19,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                maxWidth: 500,
              }}
            >
              Blackridge runs your strategies on Binance Futures while you sleep. Backtest, deploy,
              monitor — from one calm dashboard built for serious traders.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
                Open account <ArrowRight size={16} />
              </Link>
              <Link href="/" className="br-btn br-btn-secondary br-btn-lg">
                <Play size={14} /> See the demo
              </Link>
            </div>
            <div
              className="mt-11 flex gap-9 pt-7"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <HeroStat value="$48M+" label="Notional traded / mo" />
              <HeroStat value="7" label="Live strategies" />
              <HeroStat value="42ms" label="Median order latency" />
            </div>
          </div>

          {/* Card-stack visual */}
          <CardStack />
        </div>
      </section>

      {/* Exchange logos */}
      <section className="mx-auto max-w-[1180px] px-8" style={{ padding: '24px 32px 56px' }}>
        <div
          className="mb-6 text-center text-[13px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Trades on the exchanges you already use
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-14 font-display text-[22px] font-extrabold tracking-[-0.02em]"
          style={{ opacity: 0.55, color: 'var(--text-primary)' }}
        >
          <span>Binance</span>
          <span>OKX</span>
          <span>Bybit</span>
          <span>Coinbase Prime</span>
          <span>Kraken</span>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-8">
          <SectionHead
            eyebrow="What you get"
            title="A trading desk that runs itself."
            sub="Six tools for the same job: turn an idea into a strategy, prove it on history, ship it to your live account, and watch it without watching it."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<Beaker />}
              title="Honest backtests"
              body="Walk-forward, monte-carlo, slippage and fees baked in. No survivorship, no overfit warnings ignored."
            />
            <Feature
              icon={<Bot />}
              title="7 production strategies"
              body="LSR, VCB, VBO, TPSE and more — battle-tested on live capital. Fork them, tune them, run yours alongside."
            />
            <Feature
              icon={<LineChart />}
              title="Live P&L, calm UI"
              body="WebSocket-driven cells flash on every tick. Aggregated across accounts. Same numbers your accountant will see."
            />
            <Feature
              icon={<Shield />}
              title="Risk caps that actually fire"
              body="Per-account daily loss limits, position concentration limits, kill-switch on drawdown. No surprises overnight."
            />
            <Feature
              icon={<Zap />}
              title="Multi-account orchestration"
              body="Run the same strategy across sub-accounts with separate risk budgets. One dashboard, many keys."
            />
            <Feature
              icon={<Layers />}
              title="Alternative data baked in"
              body="Strategies trade on more than price. FRED macro, Binance funding & open interest, on-chain flows from CoinMetrics and DeFiLlama, and the Fear & Greed sentiment index — all point-in-time, all built in."
            />
          </div>
        </div>
      </section>

      {/* Strategies highlight */}
      <section style={{ padding: '80px 0' }}>
        <div className="mx-auto max-w-[1180px] px-8">
          <SectionHead
            eyebrow="Strategy library"
            title="Start with a strategy. Not a blinking cursor."
            sub="Each strategy ships with documented logic, tunable parameters, and three years of out-of-sample results. Enable the ones you trust."
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {STRATEGY_HIGHLIGHTS.map((s, i) => (
              <div key={s.code} className="br-card" style={{ borderRadius: 28, padding: 28 }}>
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className="br-ticker"
                    style={{ width: 44, height: 44, borderRadius: 12, fontSize: 12 }}
                  >
                    {s.code}
                  </div>
                  <span className="br-chip br-chip-brand">{s.tag}</span>
                </div>
                <h3
                  className="font-display"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    margin: '0 0 16px',
                  }}
                >
                  {s.name}
                </h3>
                <Sparkline data={makeSpark(100 + i, 30)} width={280} height={48} />
                <div
                  className="mt-4 flex gap-4 pt-4"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <Stat label="30d return" value={s.pnl} valueColor="var(--color-profit)" />
                  <Stat label="Sharpe" value={s.sharpe} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/onboarding" className="br-btn br-btn-secondary br-btn-lg">
              Browse all 7 strategies <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section style={{ padding: '80px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="br-trust-band">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            >
              <Shield size={14} /> Built for capital you can&apos;t lose
            </span>
            <h2
              className="font-display"
              style={{
                color: '#fff',
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: '-0.025em',
                maxWidth: 640,
                margin: '16px 0',
              }}
            >
              Your keys, your funds, your audit trail.
            </h2>
            <p
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: 17,
                maxWidth: 580,
                margin: '0 0 28px',
              }}
            >
              Blackridge never custodies a single dollar. We connect to your Binance account via
              read-and-trade API keys with withdrawals disabled. Every order, every fill, every
              parameter change is timestamped and exportable.
            </p>
            <div
              className="mt-10 flex gap-14 pt-8"
              style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
            >
              <TrustStat value="0" label="Funds custodied" />
              <TrustStat value="99.97%" label="Order success rate" />
              <TrustStat value="SOC 2" label="Type II in progress" />
              <TrustStat value="24/7" label="Engineer on-call" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0' }}>
        <div className="mx-auto max-w-[1180px] px-8 text-center">
          <h2
            className="font-display"
            style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}
          >
            Ready to take your strategies live?
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'var(--text-secondary)',
              maxWidth: 540,
              margin: '16px auto 28px',
            }}
          >
            Open an account in three minutes. Run paper trades free for the first 14 days. Connect a
            real exchange when you&apos;re ready.
          </p>
          <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
            Open account <ArrowRight size={16} />
          </Link>
          <div className="mt-3.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            No credit card required. No funds custodied.
          </div>
        </div>
      </section>

    </MarketingShell>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mb-12 text-center">
      <span
        className="text-[12px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--brand-600)' }}
      >
        {eyebrow}
      </span>
      <h2
        className="font-display"
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          margin: '12px 0',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h2>
      <p
        className="mx-auto"
        style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto' }}
      >
        {sub}
      </p>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="br-card" style={{ borderRadius: 28, padding: 28 }}>
      <div
        className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
        style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
      >
        {icon}
      </div>
      <h3
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.015em',
          margin: '0 0 8px',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 18, fontWeight: 700, color: valueColor ?? 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {label}
      </div>
    </div>
  );
}

function CardStack() {
  return (
    <div className="br-card-stack">
      {/* C1 — live position card */}
      <div className="br-float c1">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="br-ticker btc">BTC</div>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              BTC/USDT · LONG
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              LSR-V2 · 5× lev
            </div>
          </div>
          <span className="br-chip br-chip-profit ml-auto">
            <span className="br-chip-dot" /> LIVE
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--text-muted)' }}
            >
              Unrealized P&amp;L
            </div>
            <div
              className="font-display tabular-nums"
              style={{ fontWeight: 800, fontSize: 22, marginTop: 2, color: 'var(--color-profit)' }}
            >
              +$512.39
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-profit)' }}
            >
              +1.81%
            </div>
          </div>
          <Sparkline data={makeSpark(11, 22)} color="var(--color-profit)" width={80} height={36} />
        </div>
      </div>

      {/* C2 — strategy summary card */}
      <div className="br-float c2">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Strategy
        </div>
        <div
          className="font-display"
          style={{ fontWeight: 700, fontSize: 17, marginTop: 4, marginBottom: 10 }}
        >
          Long-Short Reversal v2
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Win rate" value="58.4%" />
          <MiniStat label="Sharpe" value="1.84" />
          <MiniStat label="P&L (30d)" value="+$12,480" color="var(--color-profit)" />
          <MiniStat label="Max DD" value="−4.62%" color="var(--color-loss)" />
        </div>
      </div>

      {/* C3 — equity sparkline card */}
      <div className="br-float c3" style={{ padding: '14px 16px' }}>
        <div className="mb-2 flex items-center justify-between">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            Equity · 90d
          </div>
          <div
            className="tabular-nums"
            style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-profit)' }}
          >
            +24.5%
          </div>
        </div>
        <Sparkline data={makeSpark(33, 50)} color="var(--brand-500)" width={304} height={56} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{ fontWeight: 700, fontSize: 15, color: color ?? 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
