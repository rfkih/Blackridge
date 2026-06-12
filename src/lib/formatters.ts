import { format, formatDistanceStrict } from 'date-fns';

/** "3m ago" for an ISO timestamp; {@code fallback} for null/invalid. Parses
 *  via {@link parseIsoUtc} so suffix-less orchestrator timestamps read as UTC. */
export function formatRelativeTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback;
  const ms = parseIsoUtc(iso);
  if (!Number.isFinite(ms)) return fallback;
  return `${formatDistanceStrict(ms, Date.now())} ago`;
}

export function formatPrice(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  // Round to display precision BEFORE deriving the sign so the sign and the
  // shown magnitude agree: a sub-cent negative renders "+0.00" not "-0.00", and
  // -0 renders "+0.00" not "+-0.00" (`|| 0` collapses -0 to 0).
  const rounded = Number(n.toFixed(2)) || 0;
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${formatPrice(Math.abs(rounded), 2)} USDT`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(2)) || 0;
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded).toFixed(2)}%`;
}

/** Parse an ISO 8601 string as UTC. asyncpg serialises TIMESTAMP (no-tz)
 *  columns without a timezone suffix; Date.parse would treat those as local
 *  time in non-UTC environments. Appending 'Z' forces UTC interpretation. */
export function parseIsoUtc(iso: string): number {
  const s =
    iso.endsWith('Z') || iso.includes('+') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return Date.parse(s);
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
