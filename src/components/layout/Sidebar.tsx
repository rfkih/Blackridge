'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  FlaskConical,
  BarChart3,
  Wallet,
  CandlestickChart,
  Dices,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Trades', href: '/trades', icon: TrendingUp },
  { label: 'Strategies', href: '/strategies', icon: Zap },
  { label: 'Backtest', href: '/backtest', icon: FlaskConical },
  { label: 'P&L Analytics', href: '/pnl', icon: BarChart3 },
  { label: 'Portfolio', href: '/portfolio', icon: Wallet },
  { label: 'Market', href: '/market', icon: CandlestickChart },
  { label: 'Monte Carlo', href: '/montecarlo', icon: Dices },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-60 flex-col',
          'bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        )}
        aria-label="Navigation"
      >
        {/* Wordmark */}
        <div className="flex h-12 shrink-0 items-center justify-between px-5">
          <div className="flex flex-col gap-0">
            <span
              className="font-display text-sm font-semibold tracking-widest"
              style={{
                background: 'linear-gradient(90deg, #4E9EFF 0%, #00C896 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              BLACKHEART
            </span>
            <span className="font-body text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
              Trading Platform
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-[var(--border-subtle)]" />

        {/* Nav */}
        <nav className="mt-3 flex-1 overflow-y-auto px-2" aria-label="Main navigation">
          <ul className="flex flex-col gap-0.5" role="list">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--accent-primary)]"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      size={15}
                      className={cn(
                        'shrink-0 transition-colors',
                        active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]',
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-3">
          <div className="h-px bg-[var(--border-subtle)] mb-3" />
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)] text-xs font-semibold text-[var(--accent-primary)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                {user?.name ?? 'Trader'}
              </p>
              <p className="truncate text-[10px] text-[var(--text-muted)]">{user?.email ?? ''}</p>
            </div>
            <button
              onClick={logout}
              className="flex size-7 shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-loss)]"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
