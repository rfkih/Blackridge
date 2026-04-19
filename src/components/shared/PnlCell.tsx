import { cn } from '@/lib/utils';
import { formatPnl, formatPercent } from '@/lib/formatters';

interface PnlCellProps {
  value: number | null | undefined;
  showPercent?: boolean;
  percentValue?: number | null;
  className?: string;
}

export function PnlCell({ value, showPercent, percentValue, className }: PnlCellProps) {
  const isProfit = (value ?? 0) >= 0;
  const color =
    value == null ? 'var(--text-muted)' : isProfit ? 'var(--color-profit)' : 'var(--color-loss)';

  return (
    <span className={cn('font-mono tabular-nums text-sm', className)} style={{ color }}>
      {formatPnl(value)}
      {showPercent && percentValue !== undefined && (
        <span className="ml-1.5 text-xs opacity-70">{formatPercent(percentValue)}</span>
      )}
    </span>
  );
}
