import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Book, Code, Key, MessageCircle, Wrench, Zap } from 'lucide-react';
import { MarketingShell, SectionHead } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Documentation for Blackridge — API references, strategy authoring guides, risk-policy DSL, and exchange-connection setup.',
};

const SECTIONS = [
  {
    icon: <Zap />,
    title: 'Quickstart',
    body: 'Open an account, connect an exchange, enable your first strategy in five minutes.',
    href: '/onboarding',
  },
  {
    icon: <Code />,
    title: 'Strategy API',
    body: 'Author strategies in TypeScript or Python. Lifecycle hooks, indicator helpers, risk callbacks.',
    href: '/docs',
  },
  {
    icon: <Wrench />,
    title: 'Risk policy DSL',
    body: 'Compose drawdown caps, position limits, and kill-switch rules. Static-validated before deploy.',
    href: '/docs',
  },
  {
    icon: <Key />,
    title: 'Exchange setup',
    body: 'Binance, OKX, Bybit, Coinbase Prime — required scopes, IP allowlists, sub-account setup.',
    href: '/docs',
  },
  {
    icon: <Book />,
    title: 'Strategy catalog',
    body: 'Logic, parameters, and three-year out-of-sample stats for each shipped strategy.',
    href: '/strategies-overview',
  },
  {
    icon: <MessageCircle />,
    title: 'Talk to us',
    body: 'Stuck on something? Email engineering@blackridge.com. We reply within one business day.',
    href: '/docs',
  },
];

export default function DocsPage() {
  return (
    <MarketingShell activeNav="docs">
      {}
      <section style={{ padding: '72px 0 32px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 text-center">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--brand-600)' }}
          >
            Docs
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
            Authoring guides, API references, risk-policy DSL specs, and exchange-connection
            walkthroughs.
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
          <SectionHead
            eyebrow="Index"
            title="Pick your starting point."
          />
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
        <div className="mx-auto max-w-[820px] px-5 sm:px-8 text-center">
          <div
            className="br-card mx-auto inline-flex items-center gap-3 text-[14px]"
            style={{ padding: '12px 20px', borderRadius: 999 }}
          >
            <span
              className="br-live-dot"
              aria-hidden="true"
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>All systems operational.</strong>{' '}
              Last incident: 22 days ago (3-minute REST degradation).
            </span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
