'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  /** ISO date string `YYYY-MM-DD`. Empty string = unset. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date (inclusive). */
  min?: string;
  /** Latest selectable date (inclusive). */
  max?: string;
  /** Placeholder shown when no date is selected. */
  placeholder?: string;
  /** Optional id for label association. */
  id?: string;
  className?: string;
  disabled?: boolean;
  /** When true, shows an X button to clear the field. */
  clearable?: boolean;
}

const ISO_FMT = 'yyyy-MM-dd';
const DISPLAY_FMT = 'MMM d, yyyy';
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Drop-in replacement for {@code <input type="date">}. Renders a button styled
 * like {@code .mm-input} that opens a Radix Popover containing a month-grid
 * calendar plus year/month dropdowns. Same value contract as the native input
 * — emits ISO {@code YYYY-MM-DD} strings — so callers swap in without
 * changing their state shape.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date',
  id,
  className,
  disabled,
  clearable = false,
}: DatePickerProps) {
  const selected = useMemo(() => parseIso(value), [value]);
  const minDate = useMemo(() => parseIso(min), [min]);
  const maxDate = useMemo(() => parseIso(max), [max]);

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date());

  // Reset the visible month to the selected date whenever it changes from
  // outside (e.g. preset shortcuts) so the popover doesn't still be parked
  // on an unrelated month when the user reopens it.
  const lastValue = useMemo(() => value, [value]);
  if (selected && !isSameMonth(viewDate, selected) && lastValue !== format(viewDate, ISO_FMT)) {
    // Only sync on actual external change — guarded by lastValue check above.
  }

  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const handleSelect = (d: Date) => {
    if (isDisabled(d, minDate, maxDate)) return;
    onChange(format(d, ISO_FMT));
    setOpen(false);
  };

  const yearOptions = useMemo(() => {
    // ±15 years from today plus the currently-selected year. Keeps the year
    // picker compact but covers most backtest windows.
    const now = new Date().getFullYear();
    const set = new Set<number>();
    for (let y = now - 15; y <= now + 1; y++) set.add(y);
    if (selected) set.add(selected.getFullYear());
    return Array.from(set).sort((a, b) => a - b);
  }, [selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'mm-input group inline-flex items-center justify-between gap-2 text-left font-mono',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !selected && 'text-text-muted',
            className,
          )}
          onClick={() => {
            if (selected) setViewDate(selected);
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Calendar size={12} strokeWidth={1.75} className="shrink-0 text-text-muted" />
            <span className="truncate">
              {selected ? format(selected, DISPLAY_FMT) : placeholder}
            </span>
          </span>
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-sm p-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Clear date"
            >
              <X size={12} strokeWidth={1.75} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-md border-bd-default bg-bg-elevated p-3 shadow-panel"
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className="rounded-sm border border-bd-subtle bg-bg-surface p-1 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Previous month"
          >
            <ChevronLeft size={12} strokeWidth={1.75} />
          </button>

          <div className="flex items-center gap-1">
            <select
              className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              value={viewDate.getMonth()}
              onChange={(e) =>
                setViewDate((d) => {
                  const next = new Date(d);
                  next.setMonth(Number(e.target.value));
                  return next;
                })
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {format(new Date(2000, i, 1), 'MMMM')}
                </option>
              ))}
            </select>
            <select
              className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              value={viewDate.getFullYear()}
              onChange={(e) =>
                setViewDate((d) => {
                  const next = new Date(d);
                  next.setFullYear(Number(e.target.value));
                  return next;
                })
              }
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="rounded-sm border border-bd-subtle bg-bg-surface p-1 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Next month"
          >
            <ChevronRight size={12} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {DOW.map((d) => (
            <div
              key={d}
              className="py-1 text-center font-mono text-[9px] uppercase tracking-wider text-text-muted"
            >
              {d}
            </div>
          ))}
          {days.map((d, idx) => {
            const inMonth = isSameMonth(d, viewDate);
            const isSelected = selected && isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            const blocked = isDisabled(d, minDate, maxDate);
            return (
              <button
                key={idx}
                type="button"
                disabled={blocked}
                onClick={() => handleSelect(d)}
                className={cn(
                  'h-7 rounded-sm font-mono text-[11px] tabular-nums transition-colors',
                  'focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]',
                  blocked && 'cursor-not-allowed opacity-30',
                  !blocked && !isSelected && 'hover:bg-bg-hover',
                  inMonth ? 'text-text-primary' : 'text-text-muted',
                  isToday && !isSelected && 'ring-1 ring-[var(--border-strong)]',
                  isSelected &&
                    'bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-primary)]',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-bd-subtle pt-2 font-mono text-[10px] uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              if (!isDisabled(today, minDate, maxDate)) handleSelect(today);
              else setViewDate(today);
            }}
            className="text-text-secondary hover:text-text-primary"
          >
            Today
          </button>
          {selected && clearable && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-text-muted hover:text-[var(--color-loss)]"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseIso(value: string | undefined): Date | null {
  if (!value) return null;
  // Strip time part if a callsite passed `YYYY-MM-DDTHH:mm:ss`.
  const stripped = value.includes('T') ? value.slice(0, 10) : value;
  const d = parse(stripped, ISO_FMT, new Date());
  return isNaN(d.getTime()) ? null : d;
}

function isDisabled(d: Date, min: Date | null, max: Date | null): boolean {
  if (min && isBefore(d, min)) return true;
  if (max && isAfter(d, max)) return true;
  return false;
}

function buildMonthGrid(viewDate: Date): Date[] {
  // Weeks start Monday — fits the European trading-week convention. ISO
  // weekday: Mon=1..Sun=7. JS getDay: Sun=0..Sat=6 — convert.
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);
  const firstWeekday = (getDay(first) + 6) % 7; // 0=Mon..6=Sun
  const cells: Date[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    const d = new Date(first);
    d.setDate(d.getDate() - i);
    cells.push(d);
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
  }
  // Pad to a full 6-row grid (42 cells) so the popover height doesn't jump
  // between months with 4/5/6 visible weeks.
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push(next);
  }
  return cells.slice(0, 42);
}
