'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Zap,
  FlaskConical,
  BarChart3,
  Wallet,
  CandlestickChart,
  Dices,
  HelpCircle,
  LogOut,
  ShieldCheck,
  X,
  Book,
  Database,
  Settings,
  Microscope,
  Grid3x3,
  Inbox,
  Activity,
  ListChecks,
  Bell,
  ScrollText,
  AlertOctagon,
  Repeat,
  Binary,
  GitBranch,
  ChevronRight,
  Bot,
  Brain,
  Target,
  FileText,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlackridgeMark } from '@/components/brand/BlackridgeMark';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'TRADE',
    items: [
      { label: 'Dashboard', href: '/', icon: Home },
      { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
      { label: 'Portfolio', href: '/portfolio', icon: Wallet },
      { label: 'Asset Targets', href: '/portfolio/assets', icon: Target },
      { label: 'Trades', href: '/trades', icon: Book },
      { label: 'Strategies', href: '/strategies', icon: Zap },
    ],
  },
  {
    label: 'RESEARCH',
    items: [
      { label: 'Backtest', href: '/backtest', icon: FlaskConical },
      { label: 'Markets', href: '/market', icon: CandlestickChart },
      { label: 'Sweeps', href: '/research/sweeps', icon: Grid3x3 },
      { label: 'Papers', href: '/research/papers', icon: FileText },
      { label: 'ML', href: '/ml/monitor', icon: Brain },
      { label: 'Forward Projections', href: '/montecarlo', icon: Dices },
      { label: 'P&L', href: '/pnl', icon: BarChart3 },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { label: 'Audit Log', href: '/audit', icon: ScrollText },
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Help', href: '/help', icon: HelpCircle },
    ],
  },
];

interface AdminNavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Ops Dashboard', href: '/research', icon: Activity },
      { label: 'Inbox', href: '/admin/inbox', icon: Inbox },
      { label: 'Alerts', href: '/admin/alerts', icon: Bell },
      { label: 'Errors', href: '/admin/errors', icon: AlertOctagon },
    ],
  },
  {
    label: 'Research',
    items: [
      { label: 'Research Queue', href: '/research/queue', icon: ListChecks },
      { label: 'Walk-forward', href: '/research/walk-forward', icon: Repeat },
      { label: 'Research Log', href: '/research/log', icon: Microscope },
      { label: 'Research Activity', href: '/admin/research-activity', icon: Bot },
    ],
  },
  {
    label: 'Data & Strategy',
    items: [
      { label: 'Catalogue', href: '/admin/strategies', icon: ShieldCheck },
      { label: 'Historical Data', href: '/admin/historical', icon: Database },
      { label: 'ML Data Sources', href: '/admin/ml-ingest', icon: Brain },
      { label: 'Spec Trace', href: '/admin/spec-trace', icon: Binary },
      { label: 'Spec History', href: '/admin/strategy-history', icon: GitBranch },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();

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
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        data-theme="dark"
        className={cn(
          'br-sidebar fixed left-0 top-0 z-40 flex h-full w-[240px] flex-col',
          'transition-transform duration-base ease-out-quart',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-auto lg:translate-x-0',
        )}
        style={{
          padding: '20px 14px',

          background: '#0E1116',
          color: '#F2F5F8',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          gap: 4,
        }}
        aria-label="Navigation"
      >
        {}
        <div className="flex items-center gap-2.5" style={{ padding: '6px 10px 22px' }}>
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Blackridge — home"
          >
            <BlackridgeMark size={34} />
            <div>
              <div
                className="font-display"
                style={{
                  fontSize: 17,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  fontWeight: 800,
                  color: '#F2F5F8',
                }}
              >
                Blackridge
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md transition-colors duration-fast lg:hidden"
            style={{ color: '#8C95A2' }}
            aria-label="Close sidebar"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {}
        <nav
          aria-label="Main navigation"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}
          className="overflow-y-auto"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#8C95A2',
                  fontWeight: 700,
                  padding: '0 10px 6px',
                }}
              >
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn('br-sb-link', active && 'br-sb-link-on')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '9px 12px',
                        borderRadius: 10,
                        color: active ? '#F2F5F8' : '#C5CCD5',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 14,
                        fontWeight: active ? 600 : 500,
                        textDecoration: 'none',
                        transition: 'background var(--dur-fast), color var(--dur-fast)',
                      }}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        style={{
                          flexShrink: 0,
                          opacity: 0.95,

                          color: active ? '#F2F5F8' : '#8C95A2',
                        }}
                      />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#8C95A2',
                  fontWeight: 700,
                  padding: '0 10px 6px',
                }}
              >
                ADMIN
              </div>
              <button
                type="button"
                onClick={() => setAdminOpen((o) => !o)}
                aria-expanded={adminOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 12px',
                  borderRadius: 10,
                  width: '100%',
                  textAlign: 'left',
                  color: '#C5CCD5',
                  background: 'transparent',
                  border: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <ShieldCheck
                  size={18}
                  strokeWidth={1.75}
                  style={{ flexShrink: 0, color: '#8C95A2' }}
                />
                <span>Admin tools</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    color: '#8C95A2',
                    transition: 'transform 160ms',
                    transform: adminOpen ? 'rotate(90deg)' : 'none',
                  }}
                >
                  <ChevronRight size={14} strokeWidth={1.75} />
                </span>
              </button>
              {adminOpen &&
                ADMIN_NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div
                      style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                        color: '#5C6470',
                        fontWeight: 700,
                        padding: '8px 12px 3px 32px',
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map(({ label, href, icon: Icon }) => {
                      const active = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '7px 12px 7px 32px',
                            borderRadius: 8,
                            color: active ? '#F2F5F8' : '#A8B0BC',
                            background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            textDecoration: 'none',
                            transition: 'background 120ms, color 120ms',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLAnchorElement).style.background =
                                'rgba(255,255,255,0.04)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLAnchorElement).style.background =
                                'transparent';
                            }
                          }}
                        >
                          <Icon
                            size={15}
                            strokeWidth={1.6}
                            style={{
                              flexShrink: 0,
                              color: active ? '#F2F5F8' : '#8C95A2',
                            }}
                          />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </nav>

        {}
        <div
          style={{
            marginTop: 'auto',
            padding: 12,
            background: '#14181F',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',

              background: 'rgba(255,255,255,0.10)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'var(--font-display)',
              flexShrink: 0,
            }}
          >
            {initials.slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#F2F5F8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {firstName}
            </div>
            <div style={{ fontSize: 11, color: '#8C95A2' }}>
              {isAdmin ? 'Admin' : 'Live · Binance'}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="br-live-dot"
            title="Connected"
            style={{ flexShrink: 0 }}
          />
          <button
            type="button"
            onClick={logout}
            className="flex size-7 items-center justify-center rounded-md transition-colors duration-fast"
            style={{ color: '#8C95A2' }}
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
