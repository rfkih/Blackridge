// Shared helpers for building Spring-flavoured query-param objects. Most
// list endpoints (alerts, error-log, research log, sweeps, trades) follow
// the same conventions:
//   - `page` / `size` always set, with sensible defaults
//   - optional filters omitted when null/undefined
//   - string filters trimmed; empty strings dropped (backend treats them as
//     "no filter on that column")
//   - `sort` is a free-form Spring sort string ("createdAt,desc")

type ParamValue = string | number | boolean;

/**
 * Append {@code value} under {@code key} when present. Strings are trimmed
 * and empties are dropped — mirrors the backend's "blank means no filter"
 * convention. Numbers and booleans pass through as-is, including 0/false.
 */
export function addOptionalParam(
  params: Record<string, ParamValue>,
  key: string,
  value: string | number | boolean | null | undefined,
): void {
  if (value == null) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    // eslint-disable-next-line no-param-reassign
    params[key] = trimmed;
    return;
  }
  // eslint-disable-next-line no-param-reassign
  params[key] = value;
}

/**
 * Build the standard `{ page, size }` object. `defaultSize` lets each
 * endpoint keep its own default (alerts/error-log: 50, research/sweeps: 25).
 */
export function buildPageParams(
  opts: { page?: number; size?: number } = {},
  defaultSize = 50,
): Record<string, number> {
  return {
    page: opts.page ?? 0,
    size: opts.size ?? defaultSize,
  };
}
