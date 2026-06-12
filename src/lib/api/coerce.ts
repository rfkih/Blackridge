/** Required numeric field — null/empty/NaN fall back to {@code fallback} (default 0). */
export function toNum(v: number | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Optional numeric field — null/empty/NaN stay {@code null}, never collapse to 0. */
export function toNumOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
