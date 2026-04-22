import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * Shared shell for /login and /register. Provides the branded backdrop, the
 * centred hero block, and the trust-signal footer so both routes feel like
 * one coherent flow — the tab switcher inside each page handles navigation
 * between the two.
 *
 * Kept as a server component: no hooks, no client-only APIs needed here.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen flex-col px-6 py-10"
      style={{
        backgroundColor: 'var(--bg-base)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(232, 235, 240, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Hero — brand + tagline. Centred above the card so the product has a
          voice, not just a form. */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark size={44} className="text-[var(--color-profit)]" />
          <h1
            aria-label="Meridian Edge"
            className="mt-4 font-display text-[26px] font-semibold tracking-[0.22em] text-text-primary"
          >
            <span className="text-[var(--color-profit)]">MERIDIAN</span>
            <span className="mx-2 text-text-muted">/</span>
            <span>EDGE</span>
          </h1>
          <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-text-secondary">
            Run your algo trading desk with institutional-grade analytics.
          </p>
        </div>

        {children}

        {/* Trust signals — directly below the card. Subtle, not screaming. */}
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-text-muted">
          <li className="inline-flex items-center gap-1.5">
            <Lock size={10} strokeWidth={1.75} aria-hidden="true" />
            End-to-end TLS
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck size={10} strokeWidth={1.75} aria-hidden="true" />
            BCrypt passwords
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Sparkles size={10} strokeWidth={1.75} aria-hidden="true" />
            Zero KYC to explore
          </li>
        </ul>
      </div>

      <footer className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
        © Meridian Edge · Trade responsibly
      </footer>
    </main>
  );
}
