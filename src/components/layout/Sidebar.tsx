'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Zap,
  FlaskConical,
  BarChart3,
  Wallet,
  CandlestickChart,
  Dices,
  LogOut,
  ShieldCheck,
  X,
  Book,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { usePnlSummary } from '@/hooks/useTrades';
import { usePortfolio } from '@/hooks/usePortfolio';
import { formatPnl, formatPrice } from '@/lib/formatters';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Portfolio', href: '/portfolio', icon: Wallet },
  { label: 'Markets', href: '/market', icon: CandlestickChart },
  { label: 'Strategies', href: '/strategies', icon: Zap },
  { label: 'Backtest', href: '/backtest', icon: FlaskConical },
  { label: 'Monte Carlo', href: '/montecarlo', icon: Dices },
  { label: 'P&L', href: '/pnl', icon: BarChart3 },
  { label: 'Journal', href: '/trades', icon: Book },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Catalogue', href: '/admin/strategies', icon: ShieldCheck },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();

  const { data: pnlSummary } = usePnlSummary('today');
  const { data: portfolio } = usePortfolio();

  const equity = portfolio?.totalUsdt ?? 0;
  const realizedToday = pnlSummary?.realizedPnl ?? 0;

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
    : 'U';

  const [firstName] = (user?.name ?? 'Trader').split(' ');

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
          'fixed left-0 top-0 z-40 flex h-full w-[240px] flex-col',
          'transition-transform duration-base ease-out-quart',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-auto lg:translate-x-0',
        )}
        style={{
          padding: '24px 18px 20px',
          background: 'var(--mm-bg)',
          gap: 4,
        }}
        aria-label="Navigation"
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2.5" style={{ padding: '0 6px 22px' }}>
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Meridian Edge — home"
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--mm-mint)',
                color: 'var(--mm-bg)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--mm-display)',
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              M
            </div>
            <div>
              <div
                className="mm-display"
                style={{ fontSize: 19, lineHeight: 1, color: 'var(--mm-ink-0)' }}
              >
                Meridian
              </div>
              <div style={{ fontSize: 11, color: 'var(--mm-ink-2)', marginTop: 2 }}>Edge</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-[color:var(--mm-ink-2)] transition-colors duration-fast hover:bg-[color:var(--mm-surface-2)] hover:text-[color:var(--mm-ink-0)] lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {/* Balance card */}
        <div className="mm-card-2" style={{ padding: '14px 16px', margin: '0 0 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--mm-ink-2)' }}>Balance</div>
          <div
            className="mm-display"
            style={{
              fontSize: 22,
              marginTop: 4,
              letterSpacing: '-0.03em',
              color: 'var(--mm-ink-0)',
            }}
          >
            {equity > 0 ? `$${formatPrice(equity, 0)}` : '—'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
              fontSize: 11,
            }}
          >
            <span
              style={{
                color: realizedToday >= 0 ? 'var(--mm-up)' : 'var(--mm-dn)',
                fontFamily: 'var(--mm-num)',
              }}
            >
              {realizedToday >= 0 ? '+' : ''}
              {formatPnl(realizedToday)}
            </span>
            <span style={{ color: 'var(--mm-ink-3)' }}>today</span>
          </div>
        </div>

        {/* Nav */}
        <nav
          aria-label="Main navigation"
          style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}
          className="overflow-y-auto"
        >
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn('mm-nav', active && 'mm-nav-active')}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    width: 18,
                    color: active ? 'var(--mm-mint)' : 'var(--mm-ink-2)',
                  }}
                >
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mm-kicker" style={{ padding: '14px 16px 6px', fontSize: 10 }}>
                Admin
              </div>
              {ADMIN_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn('mm-nav', active && 'mm-nav-active')}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 18,
                        color: active ? 'var(--mm-mint)' : 'var(--mm-ink-2)',
                      }}
                    >
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 6px 0',
            marginTop: 12,
            borderTop: '1px solid var(--mm-hair)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--mm-surface-3)',
              color: 'var(--mm-ink-1)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--mm-display)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {initials.slice(0, 1)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--mm-ink-0)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {firstName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mm-ink-2)' }}>
              {isAdmin ? 'Admin' : 'Pro member'}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mm-signout-btn flex size-7 items-center justify-center rounded-md transition-colors duration-fast"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={14} strokeWidth={1.75} />
          </button>
        </div>
      </aside>
    </>
  );
}
