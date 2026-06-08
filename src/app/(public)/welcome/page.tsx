import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Play,
  Beaker,
  Bot,
  LineChart,
  Shield,
  Zap,
  Layers,
  Shuffle,
  PiggyBank,
} from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';

export const metadata: Metadata = {
  title: 'Blackridge — Algorithmic crypto trading',
  description:
    'Run your strategies on Binance Futures while you sleep. Backtest, deploy, monitor — from one calm dashboard built for serious traders.',
};

// First card is a REAL backtest of the EMA-band BTC hedge (BTC daily 2022–2026,
// incl. the 2022 bear). The other two describe trading strategies qualitatively —
// per-strategy stats render inside the app, not as marketing numbers.
const STRATEGY_HIGHLIGHTS = [
  {
    code: 'EMA-BAND',
    name: 'EMA-Band BTC Hedge',
    tag: "Backtest '22–'26",
    real: true,
    s1Label: 'CAGR',
    s1Value: '+24.5%',
    s2Label: 'Max DD',
    s2Value: '−30%',
  },
  {
    code: 'LSR-V2',
    name: 'Long-Short Reversal v2',
    tag: 'Mean-reversion',
    real: false,
    s1Label: 'Markets',
    s1Value: 'BTC · ETH',
    s2Label: 'Horizon',
    s2Value: '4h',
  },
  {
    code: 'TPSE',
    name: 'Trend Pullback Single-Exit',
    tag: 'Trend',
    real: false,
    s1Label: 'Style',
    s1Value: 'Pullback',
    s2Label: 'Horizon',
    s2Value: '4h',
  },
];

export default function WelcomePage() {
  return (
    <MarketingShell>
      {}
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
              Live since Feb 2024
            </span>
            <h1
              className="font-display font-extrabold"
              style={{
                fontSize: 'clamp(40px, 7vw, 64px)',
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
              <HeroStat value="Trade + hedge" label="Two account types" />
              <HeroStat value="9 yr" label="Backtest history" />
              <HeroStat value="0" label="Funds we custody" />
            </div>
          </div>

          {}
          <CardStack />
        </div>
      </section>

      {}
      <section className="mx-auto max-w-[1180px] px-8" style={{ padding: '24px 32px 56px' }}>
        <div
          className="mb-6 text-center text-[13px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Trades on your own Binance account
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-14 font-display text-[22px] font-extrabold tracking-[-0.02em]"
          style={{ opacity: 0.55, color: 'var(--text-primary)' }}
        >
          <span>Binance Spot</span>
          <span>Binance USDⓈ-M Futures</span>
        </div>
        <div className="mt-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
          More venues on the roadmap
        </div>
      </section>

      {}
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
              title="Strategy library"
              body="LSR, VCB, TPSE and more — each backed by a written thesis and put through walk-forward and Monte-Carlo before deployment. Tune them, run them in paper, then go live."
            />
            <Feature
              icon={<Shuffle />}
              title="Spot hedging"
              body="Hold BTC through the bull, rotate to USDT when the daily trend breaks down. The EMA-band hedge can manage your whole BTC balance at deposit cost basis — drawdown protection without market-timing by hand."
            />
            <Feature
              icon={<PiggyBank />}
              title="Idle-cash yield"
              body="Cash on the sidelines still earns. Idle USDT is parked in Binance Simple Earn and the realised yield folds straight into your equity curve. Per-account toggle, redeemed automatically when you need it."
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
              body="Run trading and hedging accounts side by side, each with its own strategies and risk budget. One dashboard, switch an account's type whenever your view changes."
            />
            <Feature
              icon={<Layers />}
              title="Alternative data baked in"
              body="Strategies trade on more than price. FRED macro, Binance funding & open interest, on-chain flows from CoinMetrics and DeFiLlama, and the Fear & Greed sentiment index — all point-in-time, all built in."
            />
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '80px 0' }}>
        <div className="mx-auto max-w-[1180px] px-8">
          <SectionHead
            eyebrow="Strategy library"
            title="Start with a strategy. Not a blinking cursor."
            sub="Each strategy ships with documented logic and tunable parameters, validated on up to nine years of history. The hedge card below is a real backtest; the rest are illustrative."
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
                  <Stat
                    label={s.s1Label}
                    value={s.s1Value}
                    valueColor={s.real ? 'var(--color-profit)' : undefined}
                  />
                  <Stat label={s.s2Label} value={s.s2Value} />
                </div>
                <div className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {s.real ? 'Real backtest · not live' : 'Illustrative'}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/strategies-overview" className="br-btn br-btn-secondary br-btn-lg">
              Browse all 7 strategies <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {}
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
              <TrustStat value="0" label="Funds we custody" />
              <TrustStat value="< 60 s" label="Balance reconcile" />
              <TrustStat value="Off" label="Withdrawal scope" />
              <TrustStat value="9 yr" label="Backtest history" />
            </div>
          </div>
        </div>
      </section>

      {}
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
            Open an account in minutes. Start in paper trading for free, then connect your Binance
            account when you&apos;re ready.
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
      {}
      <div className="br-float c1">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="br-ticker btc">BTC</div>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              BTC/USDT · LONG
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              LSR-V2 · illustrative
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

      {}
      <div className="br-float c2">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Strategy · illustrative
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

      {}
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
