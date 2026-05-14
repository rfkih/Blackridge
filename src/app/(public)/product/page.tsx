import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Beaker,
  Bot,
  LineChart,
  Shield,
  Zap,
  List,
  ArrowUpRight,
} from 'lucide-react';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';

export const metadata: Metadata = {
  title: 'Product',
  description:
    'Live P&L, walk-forward backtests, multi-account orchestration, kill-switch risk caps. Every tool you need to ship algorithmic strategies on real money.',
};

interface FeatureSection {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: 'live-pnl' | 'backtest' | 'risk' | 'orchestration' | 'audit';
  reverse?: boolean;
}

const SECTIONS: FeatureSection[] = [
  {
    eyebrow: 'Live trading',
    title: 'P&L that updates as fast as your exchange.',
    body:
      'A persistent WebSocket feeds every position, mark, and unrealized P&L cell. Cells flash green or red on the tick that moved them, so you can see where your money came from at a glance.',
    bullets: [
      'Sub-second tick-driven cell updates',
      'Aggregated P&L across all sub-accounts',
      'Reconnect storms handled — last-known state survives',
    ],
    visual: 'live-pnl',
  },
  {
    eyebrow: 'Backtest',
    title: 'Walk-forward, Monte-Carlo, and slippage — built in.',
    body:
      'Run a strategy against historical data with the same engine that prices live orders. Fee tier, slippage curve, and funding rate all baked in by default. No survivorship, no look-ahead.',
    bullets: [
      'Walk-forward analysis with rolling windows',
      'Monte-Carlo over fills, slippage, and re-orderings',
      'Re-run a backtest with one click — exact params replayed',
    ],
    visual: 'backtest',
    reverse: true,
  },
  {
    eyebrow: 'Risk',
    title: 'Kill switches that actually fire.',
    body:
      'Per-strategy drawdown caps, account-level daily-loss limits, and position-concentration limits — all enforced by the trading engine, not just shown in the UI. If a cap trips, orders stop within milliseconds.',
    bullets: [
      'Per-strategy and per-account drawdown ceilings',
      'Position-concentration limits across sub-accounts',
      'Kill switch arms on first overnight breach',
    ],
    visual: 'risk',
  },
  {
    eyebrow: 'Multi-account',
    title: 'One strategy, many sub-accounts.',
    body:
      'Allocate the same model to multiple sub-accounts with separate capital budgets and risk profiles. Useful for prop desks running pooled strategies behind individual books.',
    bullets: [
      'Independent risk policies per sub-account',
      'Single dashboard, multi-account roll-up',
      'Per-account API key rotation',
    ],
    visual: 'orchestration',
    reverse: true,
  },
  {
    eyebrow: 'Audit',
    title: 'Every order, fill, and parameter change — logged.',
    body:
      'An immutable audit log captures every order, fill, parameter override, and rebalance. Filter by strategy, account, or time window. Export to CSV in two clicks.',
    bullets: [
      'Immutable, timestamped order + fill trail',
      'Parameter override history per strategy run',
      'CSV export with one click for tax + compliance',
    ],
    visual: 'audit',
  },
];

const QUICK_FEATURES = [
  {
    icon: <Beaker />,
    title: 'Honest backtests',
    body: 'Walk-forward + Monte-Carlo with realistic slippage. No survivorship bias.',
  },
  {
    icon: <Bot />,
    title: '7 production strategies',
    body: 'LSR, VCB, VBO, TPSE and more — battle-tested on live capital. Fork them, tune them, run yours alongside.',
  },
  {
    icon: <LineChart />,
    title: 'Live P&L, calm UI',
    body: 'WebSocket-driven cells flash on every tick. Same numbers your accountant will see.',
  },
  {
    icon: <Shield />,
    title: 'Risk caps that fire',
    body: 'Per-account daily loss limits, kill-switch on drawdown. No surprises overnight.',
  },
  {
    icon: <Zap />,
    title: 'Multi-account orchestration',
    body: 'Run the same strategy across sub-accounts with separate risk budgets.',
  },
  {
    icon: <List />,
    title: 'Audit trail forever',
    body: 'Every order, fill, parameter change, and rebalance is logged. Export to CSV.',
  },
];

export default function ProductPage() {
  return (
    <MarketingShell activeNav="product">
      {/* Hero */}
      <section style={{ padding: '72px 0 48px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 text-center">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--brand-600)' }}
          >
            The product
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(36px, 6vw, 56px)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '14px 0 16px',
              color: 'var(--text-primary)',
            }}
          >
            A trading desk that runs itself.
          </h1>
          <p
            className="mx-auto"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              maxWidth: 620,
              margin: '0 auto 28px',
            }}
          >
            Six tools, one product: turn an idea into a strategy, prove it on history, ship it to
            your live account, and watch it without watching it.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
              Open account <ArrowRight size={16} />
            </Link>
            <Link href="/pricing" className="br-btn br-btn-secondary br-btn-lg">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Feature deep-dives — alternating sides */}
      {SECTIONS.map((section) => (
        <FeatureRow key={section.title} section={section} />
      ))}

      {/* Quick-glance feature grid */}
      <section style={{ padding: '96px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="Everything else"
            title="Plus the things you’d expect."
            sub="Production-grade glue so you don’t reinvent the wheel."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {QUICK_FEATURES.map((f) => (
              <div key={f.title} className="br-card" style={{ borderRadius: 28, padding: 28 }}>
                <div
                  className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                >
                  {f.icon}
                </div>
                <h3
                  className="font-display"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    margin: '0 0 8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta />
    </MarketingShell>
  );
}

function FeatureRow({ section }: { section: FeatureSection }) {
  const copy = (
    <div className="flex flex-col gap-5">
      <span
        className="text-[12px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--brand-600)' }}
      >
        {section.eyebrow}
      </span>
      <h2
        className="font-display"
        style={{
          fontSize: 36,
          lineHeight: 1.12,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          margin: 0,
          color: 'var(--text-primary)',
        }}
      >
        {section.title}
      </h2>
      <p
        style={{
          fontSize: 17,
          lineHeight: 1.55,
          color: 'var(--text-secondary)',
          margin: 0,
          maxWidth: 460,
        }}
      >
        {section.body}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {section.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[14px]">
            <ArrowUpRight
              size={14}
              strokeWidth={2.5}
              style={{ color: 'var(--brand-600)', marginTop: 4, flexShrink: 0 }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const visual = <FeatureVisual kind={section.visual} />;

  return (
    <section style={{ padding: '64px 0' }}>
      <div
        className="mx-auto grid max-w-[1180px] items-center gap-12 px-8 md:grid-cols-2"
        style={{}}
      >
        {section.reverse ? (
          <>
            {visual}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {visual}
          </>
        )}
      </div>
    </section>
  );
}

function FeatureVisual({ kind }: { kind: FeatureSection['visual'] }) {
  if (kind === 'live-pnl') {
    return (
      <div
        className="br-card"
        style={{
          padding: 24,
          borderRadius: 24,
          background: 'var(--bg-elevated)',
        }}
      >
        <div
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Open positions · live
        </div>
        {[
          { sym: 'BTC', side: 'LONG', pnl: '+$512.39', pct: '+1.81%', up: true },
          { sym: 'ETH', side: 'LONG', pnl: '+$233.10', pct: '+0.96%', up: true },
          { sym: 'SOL', side: 'SHORT', pnl: '+$309.60', pct: '+2.04%', up: true },
          { sym: 'BNB', side: 'LONG', pnl: '−$206.64', pct: '−1.20%', up: false },
        ].map((row, i) => (
          <div
            key={row.sym}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}
          >
            <div
              className={`br-ticker ${row.sym.toLowerCase()}`}
              style={{ width: 32, height: 32, fontSize: 11 }}
            >
              {row.sym}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {row.sym}/USDT
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {row.side}
              </div>
            </div>
            <div className="text-right">
              <div
                className="num text-[13px] font-semibold"
                style={{ color: row.up ? 'var(--color-profit)' : 'var(--color-loss)' }}
              >
                {row.pnl}
              </div>
              <div
                className="num text-[11px]"
                style={{ color: row.up ? 'var(--color-profit)' : 'var(--color-loss)' }}
              >
                {row.pct}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'backtest') {
    return (
      <div className="br-card" style={{ padding: 24, borderRadius: 24 }}>
        <div
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Equity · walk-forward
        </div>
        <Sparkline data={makeSpark(42, 60)} color="var(--brand-500)" width={420} height={140} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat label="CAGR" value="+24.5%" tone="profit" />
          <Stat label="Sharpe" value="1.84" />
          <Stat label="Max DD" value="−4.62%" tone="loss" />
        </div>
      </div>
    );
  }

  if (kind === 'risk') {
    return (
      <div className="br-card" style={{ padding: 24, borderRadius: 24 }}>
        <div
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Risk caps · LSR-V2
        </div>
        {[
          { label: 'Daily loss limit', value: '$1,500 / day', pct: 38 },
          { label: 'Drawdown cap', value: '−6.0% trailing', pct: 72 },
          { label: 'Position notional', value: '$50k max', pct: 54 },
        ].map((row) => (
          <div key={row.label} className="mb-3 last:mb-0">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {row.label}
              </span>
              <span
                className="num text-[12px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {row.value}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: 'var(--bg-hover)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.pct}%`,
                  background: 'var(--brand-500)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'orchestration') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: 'BR-Main', value: '$78,420', strategies: 4, live: true },
          { name: 'BR-Cash', value: '$32,810', strategies: 2, live: true },
          { name: 'BR-Vol', value: '$13,230', strategies: 1, live: true },
          { name: 'BR-Paper', value: '$10,000', strategies: 3, live: false },
        ].map((acct) => (
          <div key={acct.name} className="br-card" style={{ padding: 16 }}>
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {acct.name}
              </div>
              <span
                className={`br-chip ${acct.live ? 'br-chip-profit' : 'br-chip-info'}`}
                style={{ fontSize: 10 }}
              >
                {acct.live ? 'LIVE' : 'PAPER'}
              </span>
            </div>
            <div
              className="num font-display mt-1"
              style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}
            >
              {acct.value}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {acct.strategies} strategies
            </div>
          </div>
        ))}
      </div>
    );
  }

  // audit
  return (
    <div className="br-card" style={{ padding: 24, borderRadius: 24 }}>
      <div
        className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        Audit trail
      </div>
      {[
        { time: '14:02:31', label: 'Order filled', detail: 'BTC/USDT LONG · 0.42 @ 67120.50' },
        { time: '14:02:30', label: 'Order placed', detail: 'BTC/USDT LIMIT · 0.42 @ 67120.50' },
        { time: '13:48:12', label: 'Param updated', detail: 'LSR-V2 atr_mult 2.0 → 2.4' },
        { time: '11:30:00', label: 'Strategy enabled', detail: 'TPSE on BR-Main' },
        { time: '09:15:44', label: 'Kill switch armed', detail: 'BR-Main · drawdown 4.2%' },
      ].map((row, i) => (
        <div
          key={i}
          className="flex items-baseline gap-3 py-2 font-mono text-[12px]"
          style={{
            borderTop: i ? '1px solid var(--border-subtle)' : 'none',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', minWidth: 64 }}>{row.time}</span>
          <span
            className="font-semibold"
            style={{ color: 'var(--text-primary)', minWidth: 120 }}
          >
            {row.label}
          </span>
          <span className="truncate" style={{ flex: 1, color: 'var(--text-muted)' }}>
            {row.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'profit' | 'loss' }) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="num font-display"
        style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}
