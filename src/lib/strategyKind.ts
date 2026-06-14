/**
 * Shared helper for strategy-kind-aware rendering.
 *
 * HEDGING strategies are spot BTC/USDT allocation tilts — they hold BTC or
 * cash, have no long/short direction, no stop-loss / take-profit / R-multiple,
 * no kelly sizing, no funding rate, and very few trades. Their meaningful
 * metrics are RETURN, MAX DRAWDOWN, and RETURN-PER-DRAWDOWN (Calmar).
 *
 * When isHedging() returns true, UI components MUST hide trading-only chrome
 * (direction toggles, stop-loss, kelly, funding rate) and SHOW
 * allocation/drawdown framing instead.  When it returns false (TRADING or
 * legacy undefined), render exactly as today — zero regressions.
 */

/** Returns true iff the strategy kind is HEDGING (case-insensitive). */
export const isHedging = (k?: string | null): boolean =>
  (k ?? '').toUpperCase() === 'HEDGING';
