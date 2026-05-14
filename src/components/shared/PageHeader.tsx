import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Small uppercase mono kicker above the title. */
  eyebrow?: string;
  /** Main title — rendered in display weight at h1 size. */
  title: string;
  /** Subtitle / lede paragraph below the title. */
  description?: ReactNode;
  /** Optional right-side actions (buttons, search, status pills). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard dashboard page header — matches the Machiavelli design pack's
 * eyebrow + display headline + lede + right-side actions pattern. Used at
 * the top of strategies / backtest / portfolio / trades / etc. pages.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--brand-500)',
              fontFamily: 'var(--mm-mono)',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="mm-display"
          style={{
            marginTop: eyebrow ? 6 : 0,
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            fontWeight: 800,
            color: 'var(--mm-ink-0)',
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              marginTop: 6,
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--mm-ink-2)',
              maxWidth: 720,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
