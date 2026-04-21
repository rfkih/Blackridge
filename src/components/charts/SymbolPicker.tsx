'use client';

import { useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { POPULAR_SYMBOLS } from '@/lib/charts/chartTheme';
import { cn } from '@/lib/utils';

interface SymbolPickerProps {
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolPicker({ value, onChange }: SymbolPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = POPULAR_SYMBOLS.filter((s) => s.toLowerCase().includes(query.toLowerCase()));

  function handleSelect(sym: string) {
    onChange(sym.toUpperCase());
    setOpen(false);
    setQuery('');
  }

  function handleCustom(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      handleSelect(query.trim());
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
            'border border-[var(--border-default)] bg-[var(--bg-elevated)]',
            'hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
          )}
          aria-label={`Current symbol: ${value}. Click to change.`}
        >
          <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
            {value}
          </span>
          <ChevronDown size={12} className="text-[var(--text-muted)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2" sideOffset={6}>
        <div className="mb-2 flex items-center gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5">
          <Search size={12} className="shrink-0 text-[var(--text-muted)]" />
          {/* eslint-disable jsx-a11y/no-autofocus -- popover search input is
              the intended focus target the moment the popover opens. */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleCustom}
            placeholder="Search or type symbol…"
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            autoFocus
            aria-label="Search symbol"
          />
          {/* eslint-enable jsx-a11y/no-autofocus */}
        </div>
        <ul className="space-y-0.5" role="listbox">
          {filtered.map((sym) => (
            <li key={sym} role="option" aria-selected={sym === value}>
              <button
                type="button"
                onClick={() => handleSelect(sym)}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  sym === value
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                )}
              >
                {sym}
                {sym === value && <Check size={11} />}
              </button>
            </li>
          ))}
          {filtered.length === 0 && query && (
            <li>
              <button
                type="button"
                onClick={() => handleSelect(query)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
              >
                <span>Use &quot;{query.toUpperCase()}&quot;</span>
              </button>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
