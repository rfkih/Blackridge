import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Book, Key, Shuffle, SlidersHorizontal, Wrench, Zap } from 'lucide-react';
import { MarketingShell, SectionHead } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Documentation for Blackridge — connecting Binance, picking and tuning strategies, setting up hedging and idle-cash yield, risk controls, and reading a backtest.',
};

const SECTIONS = [
  {
    icon: <Zap />,
    title: 'Quickstart',
    body: 'Open an account, connect your Binance keys, and enable your first strategy in minutes.',
    href: '/onboarding',
  },
  {
    icon: <SlidersHorizontal />,
    title: 'Strategies & tuning',
    body: 'Pick a strategy, adjust its parameters, paper-trade it against live data, then go live.',
    href: '/strategies-overview',
  },
  {
    icon: <Shuffle />,
    title: 'Hedging & earn',
    body: 'Set up the spot EMA-band hedge, manage your whole BTC balance, and park idle USDT in Simple Earn.',
    href: '/strategies-overview',
  },
  {
    icon: <Wrench />,
    title: 'Risk controls',
    body: 'Per-account daily-loss caps, position-concentration limits, and a drawdown kill-switch.',
    href: '/docs',
  },
  {
    icon: <Key />,
    title: 'Binance setup',
    body: 'Required API-key scopes, why withdrawals must be disabled, spot vs USDⓈ-M futures. More venues on the roadmap.',
    href: '/docs',
  },
  {
    icon: <Book />,
    title: 'Strategy catalog',
    body: 'Logic, parameters, and backtests on up to nine years of history for each strategy.',
    href: '/strategies-overview',
  },
];

export default function DocsPage() {
  return (
    <MarketingShell activeNav="docs">
      {}
      <section style={{ padding: '72px 0 32px' }}>
        <div className="mx-auto max-w-[1180px] px-5 text-center sm:px-8">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--brand-600)' }}
          >
            Docs
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
            Build, deploy, monitor. In that order.
          </h1>
          <p
            className="mx-auto"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              maxWidth: 580,
              margin: '0 auto 28px',
            }}
          >
            How to connect Binance, pick and tune strategies, set up hedging and idle-cash yield,
            arm your risk controls, and read a backtest.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
              Quickstart <ArrowRight size={16} />
            </Link>
            <Link href="/strategies-overview" className="br-btn br-btn-secondary br-btn-lg">
              Strategy catalog
            </Link>
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead eyebrow="Index" title="Pick your starting point." />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className="br-card group flex flex-col"
                style={{
                  borderRadius: 24,
                  padding: 28,
                  textDecoration: 'none',
                  transition: 'transform var(--dur-fast), box-shadow var(--dur-fast)',
                }}
              >
                <div
                  className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                >
                  {s.icon}
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
                  {s.title}
                </h3>
                <p
                  className="flex-1"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {s.body}
                </p>
                <div
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold"
                  style={{ color: 'var(--brand-700)' }}
                >
                  Read <ArrowRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0 96px' }}>
        <div className="mx-auto max-w-[820px] px-5 text-center sm:px-8">
          <div
            className="br-card mx-auto inline-flex items-center gap-3 text-[14px]"
            style={{ padding: '12px 20px', borderRadius: 999 }}
          >
            <span className="br-live-dot" aria-hidden="true" />
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Early access.</strong> Docs are
              expanding — email{' '}
              <span style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                engineering@blackridge.com
              </span>{' '}
              if something&apos;s missing.
            </span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
