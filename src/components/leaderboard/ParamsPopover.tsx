'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Inline expand/collapse chip list for a strategy's effective parameter map.
 * Shared by every leaderboard tab (Conviction / Backtest / Papers) so the
 * params display stays identical across the funnel. Self-contained — uses the
 * same chip styling as the original `TopStrategiesSection` inline params block.
 */
interface ParamsPopoverProps {
  params: Record<string, unknown>;
  /** Optional caption noun, e.g. "best parameters" (default) or "parameters". */
  label?: string;
  className?: string;
}

function fmtParamValue(v: unknown): string {
  if (typeof v === 'number')
    return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (v == null) return '—';
  return String(v);
}

export function ParamsPopover({
  params,
  label = 'best parameters',
  className,
}: ParamsPopoverProps) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(params ?? {});

  if (entries.length === 0) {
    return <span className="font-mono text-[11px] text-[var(--text-muted)]">—</span>;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        aria-expanded={open}
      >
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
        {open ? 'Hide' : 'Show'} {label} · {entries.length}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px]"
            >
              <span className="text-[var(--text-muted)]">{k}</span>
              <span className="tabular-nums text-[var(--text-primary)]">{fmtParamValue(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
