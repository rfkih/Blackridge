import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { BlackridgeMark, BlackridgeWordmark } from '@/components/brand/BlackridgeMark';

interface MarketingShellProps {
  children: ReactNode;
  /** Active nav item — receives stronger styling. */
  activeNav?: 'product' | 'strategies' | 'pricing' | 'security' | 'docs';
}

const NAV_LINKS: { label: string; href: string; key: NonNullable<MarketingShellProps['activeNav']> }[] = [
  { label: 'Product', href: '/product', key: 'product' },
  { label: 'Strategies', href: '/strategies-overview', key: 'strategies' },
  { label: 'Pricing', href: '/pricing', key: 'pricing' },
  { label: 'Security', href: '/security', key: 'security' },
  { label: 'Docs', href: '/docs', key: 'docs' },
];

/**
 * Shared chrome for the public marketing site — sticky nav at the top + the
 * 4-column footer at the bottom. Pages drop their own hero/sections in as
 * children. Background, type, and accent all follow the active palette.
 */
export function MarketingShell({ children, activeNav }: MarketingShellProps) {
  return (
    <main className="br marketing-root" style={{ background: 'var(--bg-base)' }}>
      <MarketingNav activeNav={activeNav} />
      {children}
      <MarketingFooter />
    </main>
  );
}

function MarketingNav({ activeNav }: { activeNav?: MarketingShellProps['activeNav'] }) {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-6 px-5 sm:px-8 md:gap-10">
        <Link href="/welcome" className="inline-flex items-center gap-2.5">
          <BlackridgeWordmark size="md" />
        </Link>
        {}
        <nav className="hidden flex-1 gap-7 text-[14px] font-medium md:flex">
          {NAV_LINKS.map((link) => {
            const active = activeNav === link.key;
            return (
              <Link
                key={link.key}
                href={link.href}
                className="cursor-pointer transition-colors"
                style={{
                  color: active ? 'var(--brand-700)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,

                  borderBottom: active ? '2px solid var(--brand-500)' : '2px solid transparent',
                  paddingBottom: 2,
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex gap-2 md:ml-0">
          <Link href="/login" className="br-btn br-btn-ghost hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/onboarding" className="br-btn br-btn-primary">
            Open account
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer
      className="text-[13px]"
      style={{
        padding: '48px 0 40px',
        borderTop: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        {}
        <div className="mb-10 grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-10">
          <div>
            <div className="mb-3.5 flex items-center gap-2.5">
              <BlackridgeMark size={28} />
              <div
                className="font-display text-[17px] font-extrabold"
                style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
              >
                Blackridge
              </div>
            </div>
            <p style={{ maxWidth: 280, fontSize: 13, color: 'var(--text-muted)' }}>
              Algorithmic crypto trading for traders who would rather sleep.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:contents">
            <FooterCol
              title="Product"
              items={[
                { label: 'Features', href: '/product' },
                { label: 'Strategies', href: '/strategies-overview' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Security', href: '/security' },
              ]}
            />
            <FooterCol
              title="Resources"
              items={[
                { label: 'Docs', href: '/docs' },
                { label: 'Sign in', href: '/login' },
                { label: 'Open account', href: '/onboarding' },
              ]}
            />
            <FooterCol
              title="Legal"
              items={[
                { label: 'Terms', href: '/terms' },
                { label: 'Privacy', href: '/privacy' },
                { label: 'Cookies', href: '/cookies' },
              ]}
            />
          </div>
        </div>
        <div
          className="flex flex-col gap-2 pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between sm:text-[13px]"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <span>© 2026 Blackridge Technology Pte. Ltd.</span>
          <span>Trading involves risk. Past performance does not guarantee future results.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <h5
        className="mb-3.5 text-[13px] font-bold"
        style={{ color: 'var(--text-primary)', margin: '0 0 14px' }}
      >
        {title}
      </h5>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="cursor-pointer transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-muted)' }}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared section-head pattern used by every marketing page (eyebrow + h2 + sub). */
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
      {sub && (
        <p
          className="mx-auto"
          style={{
            fontSize: 17,
            color: 'var(--text-secondary)',
            maxWidth: 620,
            margin: '0 auto',
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/** Shared CTA strip — same on every marketing page. */
export function MarketingCta({
  title = 'Ready to take your strategies live?',
  sub = 'Open an account in three minutes. Run paper trades free for the first 14 days. Connect a real exchange when you’re ready.',
}: {
  title?: string;
  sub?: string;
}) {
  return (
    <section style={{ padding: '80px 0' }}>
      <div className="mx-auto max-w-[1180px] px-8 text-center">
        <h2
          className="font-display"
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 17,
            color: 'var(--text-secondary)',
            maxWidth: 540,
            margin: '16px auto 28px',
          }}
        >
          {sub}
        </p>
        <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
          Open account <ArrowRight size={16} />
        </Link>
        <div className="mt-3.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          No credit card required. No funds custodied.
        </div>
      </div>
    </section>
  );
}
