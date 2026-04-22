'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type AuthMode = 'login' | 'register';

interface AuthModeSwitchProps {
  current: AuthMode;
}

const TABS: Array<{ id: AuthMode; label: string; path: string }> = [
  { id: 'login', label: 'Sign in', path: '/login' },
  { id: 'register', label: 'Sign up', path: '/register' },
];

/**
 * Tab-style switcher at the top of each auth card. Navigating between
 * `/login` and `/register` carries the currently-typed email forward via the
 * `?email=` query param, so users who start on one screen and realise they
 * need the other don't lose their input.
 *
 * Pattern borrowed from Stripe / Linear / Vercel — more discoverable than a
 * tiny footer link and makes the two modes feel like one flow.
 */
export function AuthModeSwitch({ current }: AuthModeSwitchProps) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (path: string) => {
    // Preserve `?next=` + `?email=` across the swap so:
    //  - a user redirected from a gated page into /login can click "Sign up"
    //    and still return to the original destination after register.
    //  - whatever they'd typed into the email input doesn't evaporate.
    const nextParam = params.get('next');
    const emailParam = params.get('email');
    const qs = new URLSearchParams();
    if (emailParam) qs.set('email', emailParam);
    if (nextParam) qs.set('next', nextParam);
    const query = qs.toString();
    router.push(query ? `${path}?${query}` : path);
  };

  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className="relative grid grid-cols-2 gap-1 rounded-md border border-bd-subtle bg-bg-elevated p-1"
    >
      {TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) go(tab.path);
            }}
            className={cn(
              'relative z-10 rounded-sm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors duration-fast',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
              active ? 'text-[var(--text-inverse)]' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {active && (
              // Layout-animated pill slides between the two tabs — makes the
              // mode swap feel continuous instead of a hard route change.
              <motion.span
                layoutId="auth-tab-indicator"
                className="absolute inset-0 rounded-sm bg-[var(--color-profit)]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
