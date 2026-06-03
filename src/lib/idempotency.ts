/**
 * Generate a Spring-friendly idempotency key for a mutation. The orchestrator
 * uses these to dedupe duplicate POSTs from a flaky network or a double-click.
 * Format: {@code <prefix>-<epoch-ms>-<uuid>}.
 *
 * The random suffix is a full UUID via {@code crypto.randomUUID()}, not
 * {@code Math.random().toString(36).slice(2,8)} — that could yield FEWER than 6
 * chars (a short or trailing-zero base36 fraction), so two distinct mutations
 * fired in the same millisecond could collide and the second be silently
 * deduped/dropped by the orchestrator.
 */
export function generateIdempotencyKey(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${Date.now()}-${rand}`;
}
