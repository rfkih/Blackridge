import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlackridgeMark } from '@/components/brand/BlackridgeMark';

interface MarketingShellProps {
  children: ReactNode;
  /** Active nav item — receives stronger styling. */
  activeNav?: 'product' | 'strategies' | 'pricing' | 'security' | 'docs';
}

const NAV_LINKS: {
  label: string;
  href: string;
  key: NonNullable<MarketingShellProps['activeNav']>;
}[] = [
  { label: 'Product', href: '/product', key: 'product' },
  { label: 'Strategies', href: '/strategies-overview', key: 'strategies' },
  { label: 'Pricing', href: '/pricing', key: 'pricing' },
  { label: 'Security', href: '/security', key: 'security' },
  { label: 'Docs', href: '/docs', key: 'docs' },
];

/**
 * Shared chrome for the public marketing site — "Research Desk" idiom.
 * Hairline sticky nav with mono uppercase links, dark institutional
 * footer with a disclosures block. Pages drop their sections in as
 * children; the `.qp-page` wrapper provides the full qp token set
 * (paper/ink surfaces, serif display face, light + dark themes).
 */
export function MarketingShell({ children, activeNav }: MarketingShellProps) {
  return (
    <main className="br qp-page" style={{ minHeight: '100vh' }}>
      <MarketingNav activeNav={activeNav} />
      {children}
      <MarketingFooter />
    </main>
  );
}

function MarketingNav({ activeNav }: { activeNav?: MarketingShellProps['activeNav'] }) {
  return (
    <header className="qp-nav">
      <div className="qp-nav-inner">
        <Link href="/welcome" className="qp-nav-brand">
          <BlackridgeMark size={28} />
          <span className="name">Blackridge</span>
        </Link>
        <nav className="qp-nav-links" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={activeNav === link.key ? 'active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="qp-nav-cta">
          <Link href="/login" className="qp-nav-signin">
            Client login
          </Link>
          <Link href="/onboarding" className="qp-btn-primary">
            Open account
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="qp-footer">
      <div className="qp-wrap">
        <div className="qp-footer-grid">
          <div className="qp-footer-brand">
            <div className="flex items-center gap-2.5">
              <BlackridgeMark size={28} tone="inverse" />
              <span className="name">Blackridge</span>
            </div>
            <p>
              Systematic trading and hedging infrastructure for digital assets. Research-built
              strategies, executed on your own exchange account.
            </p>
          </div>
          <FooterCol
            title="Platform"
            items={[
              { label: 'Product', href: '/product' },
              { label: 'Strategy library', href: '/strategies-overview' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Security', href: '/security' },
            ]}
          />
          <FooterCol
            title="Resources"
            items={[
              { label: 'Documentation', href: '/docs' },
              { label: 'Client login', href: '/login' },
              { label: 'Open account', href: '/onboarding' },
            ]}
          />
          <FooterCol
            title="Legal"
            items={[
              { label: 'Terms of service', href: '/terms' },
              { label: 'Privacy policy', href: '/privacy' },
              { label: 'Cookie policy', href: '/cookies' },
            ]}
          />
        </div>
        <div className="qp-footer-disclosures">
          <strong>Important disclosures.</strong> Blackridge Technology Pte. Ltd. provides software
          for systematic execution on a client&apos;s own exchange account. Blackridge is not a
          broker-dealer, investment adviser, or fund; it does not custody client assets, pool client
          capital, or provide individualized investment advice. Digital-asset trading involves
          substantial risk of loss and is not suitable for every investor. Backtested and simulated
          performance results are hypothetical, do not reflect live trading, and are presented net
          of modelled costs only where stated. Past performance — live, simulated, or backtested —
          is not indicative of future results.
        </div>
        <div className="qp-footer-bottom">
          <span>© 2026 Blackridge Technology Pte. Ltd. · Singapore</span>
          <span>Non-custodial by design · Withdrawals disabled at the key level</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div className="qp-footer-col">
      <h5>{title}</h5>
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href}>{it.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared section-head pattern (eyebrow + serif h2 + lede), qp idiom. */
export function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="qp-section-head">
      <div>
        <div className="qp-section-eye">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {sub && <p className="qp-section-lede">{sub}</p>}
    </header>
  );
}

/** Shared CTA strip — same on every marketing page. */
export function MarketingCta({
  title = 'Run your first strategy on paper.',
  sub = 'Open an account, validate a strategy against live market data without risking capital, and connect your exchange when the numbers convince you.',
}: {
  title?: string;
  sub?: string;
}) {
  return (
    <section className="qp-cta">
      <div className="qp-wrap">
        <h2>{title}</h2>
        <p>{sub}</p>
        <Link href="/onboarding" className="qp-btn-primary lg">
          Open account
        </Link>
        <div className="note">No card · No custody · No performance fee</div>
      </div>
    </section>
  );
}
