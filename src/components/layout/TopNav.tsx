'use client';

import { Menu, Search, Bell, Sun, Moon } from 'lucide-react';
import { AccountSwitcher } from '@/components/layout/AccountSwitcher';
import { useWsStore } from '@/store/wsStore';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const WS_STATUS_META: Record<WsStatus, { label: string; color: string; pulse: boolean }> = {
  connected: { label: 'Live', color: 'var(--mm-up)', pulse: true },
  reconnecting: { label: 'Syncing', color: 'var(--mm-warn)', pulse: true },
  disconnected: { label: 'Offline', color: 'var(--mm-dn)', pulse: false },
};

interface TopNavProps {
  onMenuClick: () => void;
  onCommandOpen: () => void;
}

export function TopNav({ onMenuClick, onCommandOpen }: TopNavProps) {
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const wsStatus: WsStatus = connected
    ? 'connected'
    : reconnecting
      ? 'reconnecting'
      : 'disconnected';
  const wsMeta = WS_STATUS_META[wsStatus];

  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <header
      className="sticky top-0 z-20 flex shrink-0 items-center gap-3"
      style={{
        padding: '20px 0 8px',
        background: 'var(--mm-bg)',
      }}
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-fast lg:hidden"
        style={{
          color: 'var(--mm-ink-2)',
          background: 'var(--mm-surface)',
          border: '1px solid var(--mm-hair)',
        }}
        aria-label="Open navigation"
      >
        <Menu size={16} strokeWidth={1.75} />
      </button>

      {/* Search trigger */}
      <button
        type="button"
        onClick={onCommandOpen}
        className="flex flex-1 items-center gap-2.5 text-left transition-colors duration-fast"
        style={{
          padding: '11px 16px',
          borderRadius: 14,
          background: 'var(--mm-surface)',
          border: '1px solid var(--mm-hair)',
          color: 'var(--mm-ink-2)',
          fontSize: 14,
          minWidth: 0,
        }}
        aria-label="Open command palette"
      >
        <Search size={16} strokeWidth={1.6} />
        <span className="truncate">Search stocks, crypto, strategies…</span>
        <span
          className="mm-mono"
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--mm-ink-3)',
            paddingLeft: 12,
          }}
        >
          ⌘K
        </span>
      </button>

      {/* WS status pill */}
      <div
        className="mm-pill hidden sm:inline-flex"
        style={{ padding: '9px 14px', fontSize: 12 }}
        aria-live="polite"
        title={`WebSocket: ${wsMeta.label}`}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block h-[7px] w-[7px] rounded-full', wsMeta.pulse && 'pulse-dot')}
          style={{ background: wsMeta.color }}
        />
        <span style={{ color: 'var(--mm-ink-1)' }}>{wsMeta.label}</span>
      </div>

      <div className="hidden sm:block">
        <AccountSwitcher />
      </div>

      {/* Theme toggle — render both icons/labels so SSR markup is stable; CSS
          swaps visibility on the hydrated theme. */}
      <button
        type="button"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        className="mm-pill"
        style={{ padding: '9px 14px', fontSize: 13 }}
        aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      >
        <span
          style={{
            width: 14,
            height: 14,
            display: 'inline-grid',
            placeItems: 'center',
            position: 'relative',
          }}
          suppressHydrationWarning
        >
          <Sun
            size={14}
            strokeWidth={1.7}
            style={{
              position: 'absolute',
              opacity: isLight ? 0 : 1,
              transition: 'opacity 140ms',
            }}
          />
          <Moon
            size={14}
            strokeWidth={1.7}
            style={{
              position: 'absolute',
              opacity: isLight ? 1 : 0,
              transition: 'opacity 140ms',
            }}
          />
        </span>
        <span suppressHydrationWarning>{isLight ? 'Dark' : 'Light'}</span>
      </button>

      {/* Alerts */}
      <button
        type="button"
        className="mm-pill"
        style={{ padding: '9px 14px', fontSize: 13, position: 'relative' }}
        aria-label="Alerts"
      >
        <Bell size={14} strokeWidth={1.7} />
        <span>Alerts</span>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            right: 10,
            width: 7,
            height: 7,
            borderRadius: 999,
            background: 'var(--mm-dn)',
          }}
        />
      </button>
    </header>
  );
}
