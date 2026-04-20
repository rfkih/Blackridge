'use client';

import { usePathname } from 'next/navigation';
import { Menu, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusIndicator } from '@/components/shared/StatusIndicator';
import { AccountSwitcher } from '@/components/layout/AccountSwitcher';
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

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const pathname = usePathname();
  const pageTitle = usePageTitle(pathname);

  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const wsStatus = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';

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
        'flex h-12 shrink-0 items-center justify-between px-4',
        'bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]',
      )}
    >
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex size-7 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>
        <h1 className="font-body text-sm font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
      </div>

      {/* Right: WS indicator + user menu */}
      <div className="flex items-center gap-4">
        {/* WS status */}
        <div className="hidden items-center sm:flex">
          <StatusIndicator status={wsStatus} size="sm" />
        </div>

        {/* Account switcher — scopes dashboard, trades, strategies to one account or "All" */}
        <div className="hidden sm:block">
          <AccountSwitcher />
        </div>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors',
                'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
              )}
              aria-label="User menu"
            >
              <div className="flex size-6 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[10px] font-semibold text-[var(--accent-primary)]">
                {initials}
              </div>
              <ChevronDown size={12} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {user?.name ?? 'Trader'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email ?? ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-xs cursor-pointer">
              <User size={13} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs cursor-pointer">
              <Settings size={13} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer text-[var(--color-loss)] focus:text-[var(--color-loss)]"
              onClick={logout}
            >
              <LogOut size={13} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
