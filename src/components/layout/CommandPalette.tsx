'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  FlaskConical,
  BarChart3,
  Wallet,
  CandlestickChart,
  Dices,
  Search,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface PaletteItem {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-dash', label: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'Pages' },
  { id: 'nav-trades', label: 'Trades', href: '/trades', icon: TrendingUp, group: 'Pages' },
  { id: 'nav-strategies', label: 'Strategies', href: '/strategies', icon: Zap, group: 'Pages' },
  { id: 'nav-backtest', label: 'Backtest', href: '/backtest', icon: FlaskConical, group: 'Pages' },
  { id: 'nav-pnl', label: 'P&L Analytics', href: '/pnl', icon: BarChart3, group: 'Pages' },
  { id: 'nav-portfolio', label: 'Portfolio', href: '/portfolio', icon: Wallet, group: 'Pages' },
  { id: 'nav-market', label: 'Market', href: '/market', icon: CandlestickChart, group: 'Pages' },
  { id: 'nav-monte', label: 'Monte Carlo', href: '/montecarlo', icon: Dices, group: 'Pages' },
  {
    id: 'nav-backtest-new',
    label: 'New Backtest',
    subtitle: 'Start a new backtest run',
    href: '/backtest/new',
    icon: FlaskConical,
    group: 'Actions',
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q),
    );
  }, [query]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keep active index in bounds
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const navigate = useCallback(
    (item: PaletteItem) => {
      router.push(item.href);
      onOpenChange(false);
    },
    [router, onOpenChange],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) navigate(item);
    }
  }

  // Group items + build a single id→flatIndex map so the render loop is O(n) not O(n²).
  const { groups, flatItems, flatIndexById } = useMemo(() => {
    const g: Record<string, PaletteItem[]> = {};
    for (const item of filtered) {
      if (!g[item.group]) g[item.group] = [];
      g[item.group].push(item);
    }
    const flat = Object.values(g).flat();
    const idx: Record<string, number> = {};
    flat.forEach((item, i) => {
      idx[item.id] = i;
    });
    return { groups: g, flatItems: flat, flatIndexById: idx };
  }, [filtered]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2',
            'rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-panel',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
            'data-[state=closed]:slide-out-to-top-[18%] data-[state=open]:slide-in-from-top-[18%]',
          )}
          aria-label="Command palette"
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search pages and actions
          </DialogPrimitive.Description>

          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
            <Search size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search pages, actions…"
              className={cn(
                'flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                'focus:outline-none',
              )}
              aria-autocomplete="list"
              aria-controls="palette-results"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden rounded border border-[var(--border-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:block">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            id="palette-results"
            role="listbox"
            aria-label="Search results"
            className="max-h-80 overflow-y-auto p-2"
          >
            {flatItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No results found</p>
            ) : (
              Object.entries(groups).map(([groupName, items]) => (
                <div key={groupName} className="mb-1">
                  <p className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    {groupName}
                  </p>
                  {items.map((item) => {
                    const flatIdx = flatIndexById[item.id] ?? 0;
                    const isActive = flatIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                          isActive
                            ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]',
                        )}
                      >
                        <Icon
                          size={14}
                          className={cn(
                            'shrink-0',
                            isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]',
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{item.label}</span>
                          {item.subtitle && (
                            <span className="block truncate text-[11px] text-[var(--text-muted)]">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <kbd className="rounded border border-[var(--border-subtle)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-2">
            <span className="text-[10px] text-[var(--text-muted)]">
              <kbd className="font-mono">↑↓</kbd> navigate&nbsp;&nbsp;
              <kbd className="font-mono">↵</kbd> open&nbsp;&nbsp;
              <kbd className="font-mono">esc</kbd> close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
