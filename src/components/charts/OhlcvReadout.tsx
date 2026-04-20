import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface OhlcvReadoutProps {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  previousClose: number | null;
  volume: number | null;
  symbol: string;
}

function fmt(n: number | null, sym: string): string {
  if (n == null) return '—';
  const decimals = n < 1 ? 4 : n < 100 ? 3 : 2;
  return formatPrice(n, decimals);
}

function fmtVol(v: number | null, sym: string): string {
  if (v == null) return '—';
  // Remove USDT suffix for display; show as BTC value
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

const SEP = <span className="mx-2 text-[var(--border-strong)] select-none">|</span>;
const LBL = 'text-[var(--text-muted)] mr-1 select-none';

export function OhlcvReadout({ open, high, low, close, previousClose, volume, symbol }: OhlcvReadoutProps) {
  const change = close != null && previousClose != null ? ((close - previousClose) / previousClose) * 100 : null;
  const isProfit = (change ?? 0) >= 0;

  return (
    <div className="flex items-center gap-0 overflow-x-auto px-4 py-1.5 font-mono text-xs text-[var(--text-primary)] scrollbar-none">
      <span className={LBL}>O:</span>
      <span className="tabular-nums">{fmt(open, symbol)}</span>
      {SEP}
      <span className={LBL}>H:</span>
      <span className="tabular-nums text-[var(--color-profit)]">{fmt(high, symbol)}</span>
      {SEP}
      <span className={LBL}>L:</span>
      <span className="tabular-nums text-[var(--color-loss)]">{fmt(low, symbol)}</span>
      {SEP}
      <span className={LBL}>C:</span>
      <span className="tabular-nums">{fmt(close, symbol)}</span>
      {SEP}
      {change != null && (
        <span
          className={cn('flex items-center gap-0.5 tabular-nums font-semibold', isProfit ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]')}
        >
          {isProfit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isProfit ? '+' : ''}{change.toFixed(2)}%
        </span>
      )}
      {SEP}
      <span className={LBL}>VOL:</span>
      <span className="tabular-nums text-[var(--text-secondary)]">{fmtVol(volume, symbol)}</span>
    </div>
  );
}
