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
import { Logotype } from '@/components/brand/Logo';

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
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-[220px] flex-col',
          'border-r border-bd-subtle bg-bg-base',
          'transition-transform duration-base ease-out-quart',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-auto lg:translate-x-0',
        )}
        aria-label="Navigation"
      >
        {/* Brand lockup — full Meridian Edge wordmark + mark. */}
        <div className="flex h-12 shrink-0 items-center justify-between pl-5 pr-3">
          <Link
            href="/"
            className="group flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Meridian Edge — home"
          >
            <Logotype size="md" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-bg-hover hover:text-text-primary lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="hairline-b" />

        {/* Nav — active state is a razor-thin profit-green left edge, no pill. */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
          <p className="label-caps px-5 pb-2">Navigation</p>
          <ul className="flex flex-col">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href} className="relative">
                  {/* Active: solid 2px profit-green left edge, always visible */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-full w-[2px] bg-profit"
                    />
                  )}
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 px-5 py-[9px]',
                      'text-[13px] font-medium transition-colors duration-fast ease-out-quart',
                      'focus:outline-none focus-visible:bg-bg-elevated',
                      active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.75}
                      className={cn(
                        'shrink-0 transition-colors duration-fast',
                        active ? 'text-profit' : 'text-text-muted group-hover:text-text-secondary',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>

                    {/* Hover underline: scales from left, 120ms. Hidden when active. */}
                    {!active && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute bottom-0 left-5 right-5 h-px bg-profit',
                          'origin-left scale-x-0 opacity-0 transition-all duration-fast ease-out-quart',
                          'group-hover:scale-x-100 group-hover:opacity-60',
                        )}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hairline-b" />

        {/* User footer — square avatar, 6px radius, disciplined row */}
        <div className="shrink-0 px-3 py-3">
          <div className="flex items-center gap-2.5 px-2">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-bg-elevated font-mono text-[11px] font-semibold text-text-primary"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium leading-tight text-text-primary">
                {user?.name ?? 'Trader'}
              </p>
              <p className="truncate font-mono text-[10px] leading-tight text-text-muted">
                {user?.email ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-bg-hover hover:text-loss focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
