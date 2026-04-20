'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPnl, formatPercent } from '@/lib/formatters';

interface PnlCellProps {
  value: number | null | undefined;
  showPercent?: boolean;
  percentValue?: number | null;
  className?: string;
  /** Disable the tick-flash animation (use on static tables). */
  noFlash?: boolean;
}

export const PnlCell = memo(function PnlCell({
  value,
  showPercent,
  percentValue,
  className,
  noFlash,
}: PnlCellProps) {
  const isProfit = (value ?? 0) >= 0;
  const color =
    value == null ? 'var(--text-muted)' : isProfit ? 'var(--color-profit)' : 'var(--color-loss)';

  const prevRef = useRef<number | null | undefined>(value);
  const [flash, setFlash] = useState<'profit' | 'loss' | null>(null);

  useEffect(() => {
    if (noFlash) return;
    const prev = prevRef.current;
    if (prev != null && value != null && Number.isFinite(prev) && Number.isFinite(value)) {
      const delta = value - prev;
      if (delta !== 0) {
        setFlash(delta > 0 ? 'profit' : 'loss');
        const t = window.setTimeout(() => setFlash(null), 420);
        prevRef.current = value;
        return () => window.clearTimeout(t);
      }
    }
    prevRef.current = value;
  }, [value, noFlash]);

  return (
    <span
      className={cn(
        'num inline-block rounded-sm px-1 text-[13px]',
        flash === 'profit' && 'flash-profit',
        flash === 'loss' && 'flash-loss',
        className,
      )}
      style={{ color }}
    >
      {formatPnl(value)}
      {showPercent && percentValue !== undefined && (
        <span className="ml-1.5 opacity-70">{formatPercent(percentValue)}</span>
      )}
    </span>
  );
});
