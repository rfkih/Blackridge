import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Three plans for traders, prop desks, and quant teams. Paper trade free for 14 days. No funds custodied — your keys, your account.',
};

interface PlanFeature {
  label: string;
  starter: boolean | string;
  pro: boolean | string;
  desk: boolean | string;
}

const FEATURES: { group: string; items: PlanFeature[] }[] = [
  {
    group: 'Trading',
    items: [
      { label: 'Live strategies', starter: '1', pro: '4', desk: 'Unlimited' },
      { label: 'Connected exchanges', starter: 'Paper only', pro: '2', desk: 'Unlimited' },
      { label: 'Sub-accounts', starter: false, pro: '3', desk: 'Unlimited' },
      { label: 'Backtests / month', starter: '50', pro: 'Unlimited', desk: 'Unlimited' },
      { label: 'Walk-forward & Monte-Carlo', starter: false, pro: true, desk: true },
    ],
  },
  {
    group: 'Risk',
    items: [
      { label: 'Per-strategy drawdown cap', starter: true, pro: true, desk: true },
      { label: 'Account-level kill switch', starter: false, pro: true, desk: true },
      { label: 'IP allowlist', starter: false, pro: false, desk: true },
      { label: 'Custom risk policies', starter: false, pro: false, desk: true },
    ],
  },
  {
    group: 'Support',
    items: [
      { label: 'Email support', starter: 'Community', pro: '24h SLA', desk: '1h SLA' },
      { label: 'On-boarding session', starter: false, pro: '30 min', desk: '2 hr' },
      { label: 'Dedicated Slack channel', starter: false, pro: false, desk: true },
    ],
  },
];

interface Plan {
  id: 'starter' | 'pro' | 'desk';
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Test the waters with paper trading.',
    price: 'Free',
    priceNote: 'forever · paper only',
    cta: 'Start paper trading',
    ctaHref: '/onboarding',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Run live capital across a handful of accounts.',
    price: '$199',
    priceNote: 'per month · billed annually',
    cta: 'Open Pro account',
    ctaHref: '/onboarding',
    highlight: true,
  },
  {
    id: 'desk',
    name: 'Desk',
    tagline: 'Team workflows + bring-your-own-risk policy.',
    price: 'Custom',
    priceNote: 'contact sales',
    cta: 'Talk to sales',
    ctaHref: '/docs',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do you take a cut of my profits?',
    a: 'No. Blackridge is a SaaS — you pay a flat subscription. We never touch your funds and never take performance fees.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from Settings → Billing. Your strategies keep running until the end of the current billing period; after that they’re paused, not deleted.',
  },
  {
    q: 'How does paper trading work?',
    a: 'Strategies execute against live market data with realistic slippage and fee modeling, but no real orders hit the exchange. Use it for 14 days free, or stay on the Starter plan indefinitely.',
  },
  {
    q: 'What exchanges do you support?',
    a: 'Binance Futures, Binance Spot, OKX, Bybit, and Coinbase Prime. Each connection uses a read-and-trade API key with withdrawals disabled.',
  },
  {
    q: 'Is my data encrypted?',
    a: 'API keys are sealed in a KMS-backed vault before they leave your browser; only the trading workers can decrypt at order-placement time. We never have a single dollar of your capital in our possession.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell activeNav="pricing">
      {/* Hero */}
      <section style={{ padding: '72px 0 24px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 text-center">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--brand-600)' }}
          >
            Pricing
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
            Pay for software, not your wins.
          </h1>
          <p
            className="mx-auto"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              maxWidth: 580,
              margin: '0 auto',
            }}
          >
            Flat subscription. Zero performance fees. Cancel any time. Paper trade free for 14 days
            before you connect a real exchange.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ padding: '32px 0 64px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="Compare"
            title="What’s in each plan"
            sub="Everything you need to know in one table. No fine print, no asterisks."
          />
          <div className="br-card overflow-x-auto" style={{ padding: 0 }}>
            <table
              className="w-full"
              style={{ borderCollapse: 'collapse', minWidth: 640 }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th
                    className="text-left text-[12px] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      padding: '16px 20px',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className="text-left text-[13px] font-semibold"
                      style={{
                        padding: '16px 20px',
                        color: p.highlight ? 'var(--brand-700)' : 'var(--text-primary)',
                        background: p.highlight ? 'var(--brand-50)' : 'var(--bg-surface)',
                      }}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((g) => (
                  <FeatureGroup key={g.group} group={g.group} items={g.items} />
                ))}
              </tbody>
            </table>
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

      <MarketingCta />
    </MarketingShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isHighlight = plan.highlight;
  return (
    <div
      className="br-card flex flex-col"
      style={{
        padding: 32,
        borderRadius: 28,
        border: isHighlight ? '1.5px solid var(--brand-500)' : '1px solid var(--border-subtle)',
        boxShadow: isHighlight ? '0 20px 48px var(--accent-glow)' : 'var(--shadow-panel)',
        position: 'relative',
      }}
    >
      {isHighlight && (
        <span
          className="absolute -top-3 left-7 br-chip br-chip-brand text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ padding: '4px 10px' }}
        >
          Most popular
        </span>
      )}
      <div>
        <div
          className="text-[12px] font-bold uppercase tracking-[0.14em]"
          style={{ color: isHighlight ? 'var(--brand-600)' : 'var(--text-muted)' }}
        >
          {plan.name}
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
          {plan.tagline}
        </h3>
        <div className="mt-5 flex items-baseline gap-2">
          <span
            className="font-display tabular-nums"
            style={{
              fontSize: "clamp(36px, 6vw, 56px)",
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}
          >
            {plan.price}
          </span>
        </div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {plan.priceNote}
        </div>
      </div>
      <Link
        href={plan.ctaHref}
        className={`br-btn br-btn-lg br-btn-block mt-6 ${
          isHighlight ? 'br-btn-primary' : 'br-btn-secondary'
        }`}
      >
        {plan.cta} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function FeatureGroup({ group, items }: { group: string; items: PlanFeature[] }) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{
            padding: '20px 20px 8px',
            color: 'var(--text-muted)',
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {group}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.label} style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <td
            className="text-[14px]"
            style={{ padding: '14px 20px', color: 'var(--text-primary)' }}
          >
            {item.label}
          </td>
          <FeatureCell value={item.starter} />
          <FeatureCell value={item.pro} highlight />
          <FeatureCell value={item.desk} />
        </tr>
      ))}
    </>
  );
}

function FeatureCell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  return (
    <td
      className="text-[14px]"
      style={{
        padding: '14px 20px',
        color: 'var(--text-secondary)',
        background: highlight ? 'color-mix(in srgb, var(--brand-500) 4%, transparent)' : undefined,
      }}
    >
      {typeof value === 'string' ? (
        value
      ) : value ? (
        <Check size={16} style={{ color: 'var(--color-profit)' }} aria-label="Included" />
      ) : (
        <Minus size={16} style={{ color: 'var(--text-muted)' }} aria-label="Not included" />
      )}
    </td>
  );
}
