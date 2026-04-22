import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/formatters';

interface PriceCellProps {
  value: number | null | undefined;
  /** Number of decimals — 4 for spot crypto, 2 for USDT P&L. */
  decimals?: number;
  /** Trailing unit label (e.g. `USDT`, `BTC`). Omit for bare numbers. */
  symbol?: string;
  className?: string;
}

/**
 * Render a price or null. Null/undefined/NaN all render as an em-dash in the
 * muted tone so the column never looks "wrong" when data is missing.
 */
export const PriceCell = memo(function PriceCell({
  value,
  decimals = 2,
  symbol,
  className,
}: PriceCellProps) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span
        className={cn('font-mono text-[13px] tabular-nums text-[var(--text-muted)]', className)}
      >
        —
      </span>
    );
  }
  return (
    <span
      className={cn('font-mono text-[13px] tabular-nums text-[var(--text-primary)]', className)}
    >
      {formatPrice(value, decimals)}
      {symbol && <span className="ml-1 text-[var(--text-muted)]">{symbol}</span>}
    </span>
  );
});
