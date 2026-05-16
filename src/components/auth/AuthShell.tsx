'use client';

import { Clock, Globe, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlackridgeMark } from '@/components/brand/BlackridgeMark';

interface AuthShellProps {
  /** Right-aligned link in the top bar — e.g. `{ label: 'New here?', cta: 'Create account →', href: '/register' }`. */
  topRight?: { label: string; cta: string; href: string };
  /** Card width cap on the right panel. Defaults to 440px (login). Register uses 480px for the wider form. */
  maxWidth?: number;
  /** Whether to render the trust strip in the left panel. Defaults to true. */
  trustStrip?: boolean;
  children: ReactNode;
}

/**
 * Shared chrome for the auth flow — split-screen with a palette-driven brand
 * panel on the left (gradient + quote + trust strip) and a white form panel
 * on the right hosting the page's card content. Matches the Blackridge
 * onboarding wizard's layout so signup/signin feel like one product.
 */
export function AuthShell({
  topRight,
  maxWidth = 480,
  trustStrip = true,
  children,
}: AuthShellProps) {
  return (
    <div className="br grid min-h-screen grid-cols-1 md:grid-cols-2">
      {}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-14 md:flex"
        style={{
          background: 'linear-gradient(160deg, var(--brand-700), var(--brand-900))',
          color: '#fff',
        }}
      >
        {}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -140,
            bottom: -140,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />

        <Link
          href="/welcome"
          className="relative z-[1] inline-flex w-fit items-center gap-2.5"
          style={{ color: '#fff' }}
        >
          <BlackridgeMark size={36} tone="inverse" />
          <span
            className="font-display"
            style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#fff' }}
          >
            Blackridge
          </span>
        </Link>

        <div className="relative z-[1]">
          <div
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              maxWidth: 380,
            }}
          >
            &ldquo;I sleep through Asia open now. Last quarter the bot beat my discretionary book
            by 14%.&rdquo;
          </div>
          <div className="mt-7 flex items-center gap-3">
            <div
              className="grid place-items-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.16)',
                fontWeight: 700,
              }}
            >
              MC
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Maya Chen</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                Prop trader · Hong Kong
              </div>
            </div>
          </div>
        </div>

        {trustStrip && <TrustStrip />}
      </aside>

      {}
      <main className="relative w-full p-8 sm:p-12 md:p-14" style={{ background: 'var(--bg-base)' }}>
        {}
        <div className="mb-6 flex items-center justify-between md:hidden">
          <Link href="/welcome" className="inline-flex items-center gap-2.5">
            <BlackridgeMark size={28} />
            <span
              className="font-display"
              style={{
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              Blackridge
            </span>
          </Link>
          {topRight && (
            <Link
              href={topRight.href}
              className="text-[13px] font-semibold"
              style={{ color: 'var(--brand-600)' }}
            >
              {topRight.cta}
            </Link>
          )}
        </div>

        {}
        {topRight && (
          <div
            className="absolute right-8 top-8 hidden text-[13px] md:block"
            style={{ color: 'var(--text-secondary)', fontWeight: 500 }}
          >
            {topRight.label}{' '}
            <Link
              href={topRight.href}
              className="ml-1 font-semibold"
              style={{ color: 'var(--brand-700)', textDecoration: 'none' }}
            >
              {topRight.cta}
            </Link>
          </div>
        )}

        <div
          className="mx-auto w-full"
          style={{ maxWidth, paddingTop: 28 }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Small inline brand mark used inside auth cards. The full brand lockup
 * lives in the left panel, so this is a quiet visual anchor at the top of
 * the form (omitted on mobile where the page header already shows the mark).
 */
export function AuthMark() {
  return (
    <div className="mb-5 hidden md:block">
      <BlackridgeMark size={40} />
    </div>
  );
}

/**
 * Card surface used inside the right panel. Lighter than the previous
 * floating-card design since the surrounding split-screen already provides
 * visual containment — just a subtle elevated panel.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 20,
        padding: '32px',
        boxSizing: 'border-box',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      {children}
    </div>
  );
}

function TrustStrip() {
  const items = [
    { Icon: Shield, label: 'SOC 2 in progress' },
    { Icon: Zap, label: '42ms order latency' },
    { Icon: Globe, label: '24/7 on-call' },
    { Icon: Clock, label: 'Non-custodial' },
  ] as const;
  return (
    <div
      className="relative z-[1] flex flex-wrap gap-x-7 gap-y-2 text-[13px]"
      style={{ color: 'rgba(255,255,255,0.7)' }}
    >
      {items.map(({ Icon, label }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Icon size={16} />
          {label}
        </span>
      ))}
    </div>
  );
}
