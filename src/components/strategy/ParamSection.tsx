'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParamSectionProps {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  overrideCount: number;
  children: React.ReactNode;
}

function readStored(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

export function ParamSection({
  title,
  storageKey,
  defaultOpen = false,
  overrideCount,
  children,
}: ParamSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(readStored(storageKey, defaultOpen));
  }, [storageKey, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(storageKey, next ? '1' : '0');
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [storageKey]);

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className={cn(
              'text-[var(--text-muted)] transition-transform',
              open ? 'rotate-0' : '-rotate-90',
            )}
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {title}
          </h3>
        </div>
        <span
          className={cn(
            'font-mono text-[10px]',
            overrideCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--text-muted)]',
          )}
        >
          {overrideCount > 0
            ? `${overrideCount} override${overrideCount > 1 ? 's' : ''}`
            : 'defaults'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </section>
  );
}
