import { format, formatDistanceStrict } from 'date-fns';

export function formatPrice(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${formatPrice(n, 2)} USDT`;
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDate(ms: number): string {
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss');
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return formatDistanceStrict(0, ms);
}

export function formatRMultiple(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}R`;
}
