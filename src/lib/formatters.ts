import { format, formatDistanceStrict } from 'date-fns';

export function formatPrice(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${formatPrice(n, 2)} USDT`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDate(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss');
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  return formatDistanceStrict(0, ms);
}

export function formatRMultiple(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}R`;
}

export function formatAge(openedAtMs: number | null | undefined): string {
  if (openedAtMs == null || !Number.isFinite(openedAtMs)) return '—';
  return formatDistanceStrict(new Date(openedAtMs), new Date(), { addSuffix: false });
}
