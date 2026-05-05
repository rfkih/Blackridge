/**
 * Generate a Spring-friendly idempotency key for a mutation. The orchestrator
 * uses these to dedupe duplicate POSTs from a flaky network or a double-click.
 * Format: {@code <prefix>-<epoch-ms>-<random6>} — 6 base36 chars are enough
 * to keep collisions vanishingly unlikely within a single millisecond.
 */
export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
