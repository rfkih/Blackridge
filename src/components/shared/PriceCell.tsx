import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/formatters';

interface PriceCellProps {
  value: number | null | undefined;
  decimals?: number;
  className?: string;
}

export function PriceCell({ value, decimals = 2, className }: PriceCellProps) {
  return (
    <span
      className={cn('font-mono tabular-nums text-sm text-[var(--text-primary)]', className)}
    >
      {formatPrice(value, decimals)}
    </span>
  );
}
