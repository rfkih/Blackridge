'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface LegalPageProps {
  title: string;
  /** Subtitle under the H1 — typically the effective date. */
  subtitle?: string;
  children: React.ReactNode;
}

export function LegalPage({ title, subtitle, children }: LegalPageProps) {
  useDocumentTitle(title);

  return (
    <main
      className="mm"
      data-theme="dark"
      style={{
        minHeight: '100vh',
        background: 'var(--mm-bg)',
        color: 'var(--mm-ink-0)',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--mm-ink-2)',
            textDecoration: 'none',
            fontFamily: 'var(--font-body)',
          }}
        >
          <ArrowLeft size={12} /> Back to app
        </Link>

        <header>
          <h1
            className="font-display"
            style={{ fontSize: 32, color: 'var(--mm-ink-0)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-mono"
              style={{
                marginTop: 8,
                fontSize: 11,
                color: 'var(--mm-ink-3)',
                letterSpacing: '0.06em',
              }}
            >
              {subtitle}
            </p>
          )}
        </header>

        <article
          className="legal-prose"
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--mm-ink-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {children}
        </article>

        <footer
          style={{
            borderTop: '1px solid var(--mm-hair)',
            paddingTop: 16,
            marginTop: 16,
            fontSize: 11,
            color: 'var(--mm-ink-3)',
            display: 'flex',
            gap: 16,
          }}
        >
          <Link href="/privacy" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
            Privacy
          </Link>
          <Link href="/terms" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
            Terms
          </Link>
          <Link href="/cookies" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
            Cookies
          </Link>
        </footer>
      </div>
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display"
      style={{
        fontSize: 18,
        color: 'var(--mm-ink-0)',
        marginTop: 16,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h2>
  );
}
