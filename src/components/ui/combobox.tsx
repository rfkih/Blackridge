'use client';

import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A searchable single-select dropdown ("combobox").
 *
 * Built as a self-contained anchored panel (controlled `open` state +
 * outside-click + keyboard navigation) rather than on Radix Popover. Two
 * reasons:
 *   1. It renders in the normal DOM (no portal), so it is testable in jsdom
 *      without the pointer-capture / scrollIntoView polyfills Radix needs —
 *      matching this repo's convention of mocking Radix portals in tests.
 *   2. The roster of symbols grew past the point where a plain `<Select>` is
 *      usable (13+ coins, more as backfill lands); type-to-filter is the win.
 *
 * Styling is 100% CSS-variable tokens so it tracks light/dark like the rest of
 * the app. Used by {@link SymbolPicker} and the backtest / new-strategy forms.
 */

export type ComboboxOptionInput = string | { value: string; label?: string };

interface NormalizedOption {
  value: string;
  label: string;
}

function normalize(options: readonly ComboboxOptionInput[]): NormalizedOption[] {
  return options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  );
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboboxOptionInput[];
  /** Accessible name for the trigger button. */
  ariaLabel: string;
  /** Shown on the trigger when `value` is empty. */
  placeholder?: string;
  /** Placeholder text inside the search input. */
  searchPlaceholder?: string;
  /** Shown when the filter matches nothing. */
  emptyMessage?: string;
  disabled?: boolean;
  /** Stretch the trigger (and panel) to the parent's full width — for form fields. */
  fullWidth?: boolean;
  /** Extra classes merged onto the trigger button (e.g. `h-9 font-mono`). */
  triggerClassName?: string;
  /** Extra classes merged onto the dropdown panel. */
  contentClassName?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  disabled = false,
  fullWidth = false,
  triggerClassName,
  contentClassName,
}: ComboboxProps) {
  const items = React.useMemo(() => normalize(options), [options]);
  const listboxId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.label.toLowerCase().includes(q) || it.value.toLowerCase().includes(q),
    );
  }, [items, query]);

  const selectedLabel = React.useMemo(
    () => items.find((it) => it.value === value)?.label ?? value,
    [items, value],
  );

  function close() {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function commit(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  // Focus the search input when the panel opens; reset highlight to top.
  React.useEffect(() => {
    if (open) {
      setActiveIndex(0);
      // Defer focus to the next frame so the input is mounted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Keep the highlight in range as the filtered list shrinks.
  React.useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Scroll the active option into view (guarded — jsdom throws on scrollIntoView).
  React.useEffect(() => {
    const el = optionRefs.current[activeIndex];
    try {
      el?.scrollIntoView({ block: 'nearest' });
    } catch {
      /* not implemented in jsdom — harmless */
    }
  }, [activeIndex, filtered.length]);

  // Close on outside pointer-down.
  React.useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        const choice = filtered[activeIndex];
        if (choice) commit(choice.value);
        break;
      }
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Let focus leave naturally; just dismiss the panel.
        setOpen(false);
        setQuery('');
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', fullWidth && 'w-full')}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
          'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]',
          'hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          fullWidth && 'w-full',
          triggerClassName,
        )}
      >
        <span className={cn('truncate', !value && 'text-[var(--text-muted)]')}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 z-50 mt-1 min-w-full overflow-hidden rounded-md border',
            'border-[var(--border-default)] bg-[var(--bg-overlay)] shadow-[var(--shadow-float)]',
            contentClassName,
          )}
        >
          <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-2">
            <Search size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'h-8 w-full bg-transparent py-1 text-xs text-[var(--text-primary)] outline-none',
                'placeholder:text-[var(--text-muted)]',
              )}
            />
          </div>

          <ul
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-center text-xs text-[var(--text-muted)]">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((it, idx) => {
                const isSelected = it.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li key={it.value} role="option" aria-selected={isSelected}>
                    <button
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      // mousedown (not click) so it fires before the outside-pointer-down closer.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(it.value);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-xs transition-colors',
                        isSelected
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)]',
                        isActive && 'bg-[var(--bg-hover)] text-[var(--text-primary)]',
                      )}
                    >
                      {it.label}
                      {isSelected && <Check size={11} className="shrink-0" aria-hidden />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
