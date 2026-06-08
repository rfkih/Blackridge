import Link from 'next/link';
import { ArrowRight, Check, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Blackridge is in early access — free to use today. Connect your Binance account, run trading and hedging strategies, no subscription. No funds custodied.',
};

// What's actually available today. No invented tiers, SLAs, or seat counts.
const INCLUDED = [
  'Trading and hedging accounts (switch any time)',
  'Full strategy library — trading + spot hedging',
  'Spot BTC hedge with full-balance management',
  'Idle-cash yield via Binance Simple Earn',
  'Backtesting: walk-forward + Monte-Carlo, up to 9 years of history',
  'Paper trading against live market data',
  'Per-account risk caps + drawdown kill-switch',
  'Connect your own Binance account (spot & USDⓈ-M futures)',
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does it cost right now?',
    a: 'Nothing. Blackridge is in early access and free to use. There is no subscription and no card on file. We will announce pricing well before we ever charge, and early users will keep a founder rate.',
  },
  {
    q: 'Do you take a cut of my profits?',
    a: 'No. We never touch your funds and have no performance fee. When paid plans arrive they will be a flat subscription for the software — never a slice of your returns.',
  },
  {
    q: 'How does paper trading work?',
    a: 'Strategies execute against live market data with realistic slippage and fee modeling, but no real orders hit the exchange. Use it to get comfortable before you connect a live account.',
  },
  {
    q: 'What exchanges do you support?',
    a: 'Binance today — spot and USDⓈ-M futures. The connection uses a read-and-trade API key with withdrawals disabled. More venues are on the roadmap.',
  },
  {
    q: 'Is my data and are my keys safe?',
    a: 'API keys are sealed with KMS-backed encryption before they leave your browser; only the trading workers can decrypt at order-placement time. We never hold a single dollar of your capital. See the Security page for the full model.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell activeNav="pricing">
      {/* Hero */}
      <section style={{ padding: '72px 0 24px' }}>
        <div className="mx-auto max-w-[1180px] px-5 text-center sm:px-8">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
          >
            <span className="br-live-dot" /> Early access
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(36px, 6vw, 56px)',
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '18px 0 16px',
              color: 'var(--text-primary)',
            }}
          >
            Free while we&apos;re in early access.
          </h1>
          <p
            className="mx-auto"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto',
            }}
          >
            Connect your Binance account, run trading and hedging strategies, and backtest as much
            as you like — at no cost today. No subscription, no card, no performance fee. We&apos;ll
            announce pricing before we ever charge.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ padding: '32px 0 64px' }}>
        <div className="mx-auto max-w-[820px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Early access */}
            <div
              className="br-card flex flex-col"
              style={{
                padding: 32,
                borderRadius: 28,
                border: '1.5px solid var(--brand-500)',
                boxShadow: '0 20px 48px var(--accent-glow)',
                position: 'relative',
              }}
            >
              <span
                className="br-chip br-chip-brand absolute -top-3 left-7 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ padding: '4px 10px' }}
              >
                Available now
              </span>
              <div
                className="text-[12px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--brand-600)' }}
              >
                Early access
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  margin: '8px 0 10px',
                  color: 'var(--text-primary)',
                }}
              >
                Everything, free, today.
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="font-display tabular-nums"
                  style={{
                    fontSize: 'clamp(36px, 6vw, 56px)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-primary)',
                  }}
                >
                  Free
                </span>
              </div>
              <div className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                no card · no subscription · founder rate later
              </div>
              <Link
                href="/onboarding"
                className="br-btn br-btn-lg br-btn-block br-btn-primary mt-6"
              >
                Open account <ArrowRight size={14} />
              </Link>
            </div>

            {/* Desk / teams */}
            <div className="br-card flex flex-col" style={{ padding: 32, borderRadius: 28 }}>
              <div
                className="text-[12px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--text-muted)' }}
              >
                Desk &amp; teams
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  margin: '8px 0 10px',
                  color: 'var(--text-primary)',
                }}
              >
                Running real size?
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="font-display tabular-nums"
                  style={{
                    fontSize: 'clamp(32px, 5vw, 48px)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-primary)',
                  }}
                >
                  Talk to us
                </span>
              </div>
              <div className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                multiple accounts · custom risk policies
              </div>
              <Link href="/product" className="br-btn br-btn-lg br-btn-block br-btn-secondary mt-6">
                Contact the desk <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[820px] px-5 sm:px-8">
          <SectionHead
            eyebrow="What's included"
            title="What you get today"
            sub="Everything below is live in the product right now — no asterisks, no upsell gates."
          />
          <div className="br-card" style={{ padding: 28, borderRadius: 24 }}>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
                    style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  <span className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 0' }}>
        <div className="mx-auto max-w-[820px] px-5 sm:px-8">
          <SectionHead eyebrow="Questions" title="Common questions" />
          <div className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="br-card group"
                style={{ padding: 0, borderRadius: 'var(--br-radius-md)' }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 transition-transform group-open:rotate-45"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Plus size={16} strokeWidth={2} />
                  </span>
                </summary>
                <div
                  className="px-5 pb-5 text-[14px]"
                  style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
                >
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        title="Free to start. Nothing to lose."
        sub="Open an account, run it in paper, connect Binance when you're ready."
      />
    </MarketingShell>
  );
}
