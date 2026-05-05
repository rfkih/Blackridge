// Shared numeric coercion at the API boundary. Jackson serialises BigDecimal
// as either number or string depending on config, so every numeric field on
// the wire is a union — these helpers normalise it once at the mapper layer.

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
