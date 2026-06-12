import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell, SectionHead } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Documentation for Blackridge — connecting Binance, picking and tuning strategies, setting up hedging and idle-cash yield, risk controls, and reading a backtest.',
};

const SECTIONS = [
  {
    title: 'Quickstart',
    body: 'Open an account, connect your Binance keys, and enable your first strategy in minutes.',
    href: '/onboarding',
  },
  {
    title: 'Strategies & tuning',
    body: 'Pick a strategy, adjust its parameters, paper-trade it against live data, then go live.',
    href: '/strategies-overview',
  },
  {
    title: 'Hedging & earn',
    body: 'Set up the spot EMA-band hedge, manage your whole BTC balance, and park idle USDT in Simple Earn.',
    href: '/strategies-overview',
  },
  {
    title: 'Risk controls',
    body: 'Per-account daily-loss caps, position-concentration limits, and a drawdown kill-switch.',
    href: '/docs',
  },
  {
    title: 'Binance setup',
    body: 'Required API-key scopes, why withdrawals must be disabled, spot vs USDⓈ-M futures.',
    href: '/docs',
  },
  {
    title: 'Reading a backtest',
    body: 'Walk-forward folds, Monte-Carlo bands, drawdown profiles — and what they do and don’t tell you.',
    href: '/strategies-overview',
  },
];

export default function DocsPage() {
  return (
    <MarketingShell activeNav="docs">
      <section className="qp-hero" style={{ paddingBottom: 48 }}>
        <div className="qp-wrap">
          <div className="qp-hero-eyebrow">
            <span>Documentation</span>
            <span className="dot" />
            <span>Early access</span>
          </div>
          <h1 style={{ maxWidth: 680 }}>Build, deploy, monitor. In that order.</h1>
          <p className="lede" style={{ maxWidth: 580 }}>
            How to connect Binance, pick and tune strategies, set up hedging and idle-cash yield,
            arm your risk controls, and read a backtest like the desk does.
          </p>
          <div className="qp-hero-cta">
            <Link href="/onboarding" className="qp-btn-primary lg">
              Quickstart
            </Link>
            <Link href="/strategies-overview" className="qp-btn-textlink">
              Strategy catalog&ensp;→
            </Link>
          </div>
        </div>
      </section>

      <section className="qp-section" style={{ paddingTop: 48 }}>
        <div className="qp-wrap">
          <SectionHead eyebrow="Index" title="Pick your starting point." />
          <div className="qp-docdex">
            {SECTIONS.map((s, i) => (
              <Link key={s.title} href={s.href}>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <span className="go">Read&ensp;→</span>
              </Link>
            ))}
          </div>
          <div className="qp-foot-note">
            Docs are expanding through early access. If something you need is missing, email{' '}
            <strong style={{ color: 'var(--qp-ink)' }}>engineering@blackridge.com</strong> and
            we&apos;ll write it.
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
