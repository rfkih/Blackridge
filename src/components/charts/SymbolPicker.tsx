'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SUPPORTED_SYMBOLS } from '@/lib/symbols';
import { cn } from '@/lib/utils';

interface SymbolPickerProps {
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolPicker({ value, onChange }: SymbolPickerProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(sym: string) {
    onChange(sym.toUpperCase());
    setOpen(false);
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
      <PopoverContent
          align="start"
          sideOffset={6}
          className="w-44 p-1.5 bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)]"
        >
        <ul className="space-y-0.5" role="listbox">
          {SUPPORTED_SYMBOLS.map((sym) => (
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
        </ul>
      </PopoverContent>
    </Popover>
  );
}
