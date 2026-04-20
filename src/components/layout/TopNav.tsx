'use client';

import { usePathname } from 'next/navigation';
import { Menu, ChevronDown, User, Settings, LogOut, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountSwitcher } from '@/components/layout/AccountSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useWsStore } from '@/store/wsStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/trades': 'Trades',
  '/strategies': 'Strategies',
  '/backtest': 'Backtest',
  '/backtest/new': 'New Backtest',
  '/pnl': 'P&L Analytics',
  '/portfolio': 'Portfolio',
  '/market': 'Market',
  '/montecarlo': 'Monte Carlo',
};

function usePageTitle(pathname: string): string {
  if (pathname in PAGE_TITLES) return PAGE_TITLES[pathname];
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (key !== '/' && pathname.startsWith(key)) return title;
  }
  return 'Blackheart';
}

type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const WS_STATUS_META: Record<WsStatus, { label: string; dot: string; pulse: boolean }> = {
  connected: { label: 'LIVE', dot: 'bg-profit', pulse: true },
  reconnecting: { label: 'RECONNECTING', dot: 'bg-warning', pulse: true },
  disconnected: { label: 'OFFLINE', dot: 'bg-loss', pulse: false },
};

interface TopNavProps {
  onMenuClick: () => void;
  onCommandOpen: () => void;
}

export function TopNav({ onMenuClick, onCommandOpen }: TopNavProps) {
  const pathname = usePathname();
  const pageTitle = usePageTitle(pathname);

  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const wsStatus: WsStatus = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';
  const wsMeta = WS_STATUS_META[wsStatus];

  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-4 px-4',
        'bg-bg-base/80 backdrop-blur-md',
        'hairline-b',
      )}
    >
      {/* Left: menu (mobile) + page title as label-caps */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-bg-hover hover:text-text-primary lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={16} strokeWidth={1.75} />
        </button>
        <h1 className="label-caps !text-text-primary !text-[11px]">{pageTitle}</h1>
      </div>

      {/* Right: WS + ⌘K + account + theme + user */}
      <div className="flex items-center gap-2">
        {/* WS status — dot + caps label */}
        <div className="hidden items-center gap-1.5 pr-2 sm:flex" aria-live="polite">
          <span
            aria-hidden="true"
            className={cn('inline-block h-[6px] w-[6px] rounded-full', wsMeta.dot, wsMeta.pulse && 'pulse-dot')}
          />
          <span className="label-caps !text-[10px] text-text-muted">{wsMeta.label}</span>
        </div>

        {/* Command palette trigger — discoverable, not just a hidden shortcut */}
        <button
          type="button"
          onClick={onCommandOpen}
          aria-label="Open command palette"
          className={cn(
            'hidden items-center gap-2 rounded-sm border border-bd-subtle px-2 py-1 sm:inline-flex',
            'text-text-muted transition-colors duration-fast',
            'hover:border-bd hover:bg-bg-elevated hover:text-text-secondary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Search size={12} strokeWidth={1.75} />
          <span className="font-mono text-[11px]">Search</span>
          <kbd className="rounded-sm border border-bd-subtle bg-bg-elevated px-1 py-px font-mono text-[9px] leading-none text-text-muted">
            ⌘K
          </kbd>
        </button>

        <div className="hidden sm:block">
          <AccountSwitcher />
        </div>

        <ThemeToggle />

        {/* User dropdown — square avatar, no gradient */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-1 py-1 transition-colors duration-fast',
                'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="User menu"
            >
              <div
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-sm bg-bg-elevated font-mono text-[10px] font-semibold text-text-primary"
              >
                {initials}
              </div>
              <ChevronDown size={12} strokeWidth={1.75} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="truncate text-[12px] font-medium text-text-primary">
                {user?.name ?? 'Trader'}
              </p>
              <p className="truncate font-mono text-[10px] text-text-muted">{user?.email ?? ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-[12px] cursor-pointer">
              <User size={13} strokeWidth={1.75} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-[12px] cursor-pointer">
              <Settings size={13} strokeWidth={1.75} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-[12px] cursor-pointer text-loss focus:text-loss"
              onClick={logout}
            >
              <LogOut size={13} strokeWidth={1.75} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
