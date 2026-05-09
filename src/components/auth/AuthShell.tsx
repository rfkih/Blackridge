'use client';

import { Clock, Lock, ShieldCheck, ShieldHalf } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';

interface AuthShellProps {
  /** Right-aligned link in the top bar — e.g. `{ label: 'New here?', cta: 'Create account →', href: '/register' }`. */
  topRight?: { label: string; cta: string; href: string };
  /** Card width cap. Defaults to 440px (login). Register uses 480px for the wider form. */
  maxWidth?: number;
  /** Whether to render the trust strip below the card. Defaults to true. */
  trustStrip?: boolean;
  children: ReactNode;
}

/**
 * Shared chrome for the auth flow — cream stage, brand topbar, optional trust
 * strip below the card. Pages drop their own card markup as `children`.
 *
 * Matches the design pack's `signin.html`: cream `#FAFAF7` canvas, soft
 * radial mint glows, faded grid texture, brand top-left, contextual link
 * top-right.
 */
export function AuthShell({
  topRight,
  maxWidth = 440,
  trustStrip = true,
  children,
}: AuthShellProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(22,179,100,0.06) 0%, transparent 70%),' +
          'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(22,179,100,0.04) 0%, transparent 70%),' +
          '#FAFAF7',
      }}
    >
      {/* Faded grid texture */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(14,17,22,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(14,17,22,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent 90%)',
          pointerEvents: 'none',
        }}
      />

      {/* Topbar */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '22px 32px',
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'var(--mm-ink-0, #0E1116)',
          }}
        >
          <LogoMark size={26} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              className="font-display"
              style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}
            >
              Machiavelli
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--mm-ink-2, #6B7280)',
                marginTop: 1,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Technology
            </span>
          </span>
        </Link>
        {topRight && (
          <div style={{ fontSize: 13, color: 'var(--mm-ink-1, #384151)', fontWeight: 500 }}>
            {topRight.label}{' '}
            <Link
              href={topRight.href}
              style={{
                color: 'var(--mm-ink-0, #0E1116)',
                marginLeft: 4,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {topRight.cta}
            </Link>
          </div>
        )}
      </header>

      {/* Stage */}
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '100px 24px 60px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <div style={{ width: '100%', maxWidth, position: 'relative', zIndex: 1 }}>
          {children}
          {trustStrip && <TrustStrip />}
        </div>
      </div>
    </div>
  );
}

/** Knight-mark medallion that sits at the top of each auth card. */
export function AuthMark() {
  return (
    <div
      style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'linear-gradient(160deg, #16241B 0%, #0A0F0C 100%)',
        display: 'grid',
        placeItems: 'center',
        marginBottom: 24,
        boxShadow: '0 8px 20px -8px rgba(14,17,22,0.4), 0 0 0 6px rgba(22,179,100,0.06)',
      }}
    >
      <LogoMark size={38} tone="tile" radius={0} />
    </div>
  );
}

/** Card surface used by all auth pages. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--mm-hair-2, rgba(14,17,22,0.1))',
        borderRadius: 24,
        padding: '40px 40px 32px',
        boxSizing: 'border-box',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset,' +
          '0 24px 60px -20px rgba(14,17,22,0.18),' +
          '0 8px 20px -8px rgba(14,17,22,0.08)',
      }}
    >
      {children}
    </div>
  );
}

function TrustStrip() {
  const items = [
    { Icon: ShieldHalf, label: 'SOC 2 Type II' },
    { Icon: Lock, label: '2FA Required' },
    { Icon: Clock, label: '25ms Latency' },
    { Icon: ShieldCheck, label: 'Non-custodial' },
  ] as const;
  return (
    <div
      style={{
        marginTop: 32,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        fontSize: 11,
        color: 'var(--mm-ink-2, #6B7280)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        flexWrap: 'wrap',
      }}
    >
      {items.map(({ Icon, label }, i) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 24 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon size={14} style={{ color: 'var(--brand-500, #16B364)' }} strokeWidth={2.5} />
            {label}
          </span>
          {i < items.length - 1 && (
            <span
              aria-hidden="true"
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--mm-hair-2, rgba(14,17,22,0.18))',
                display: 'inline-block',
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
