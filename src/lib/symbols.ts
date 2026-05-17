/**
 * Canonical list of trading symbols the Blackheart backend supports.
 *
 * This is the **single source of truth** for the frontend. Every dropdown,
 * datalist, placeholder, and default value across the app reads from this
 * file. Adding a new symbol is a one-line change here — followed by a
 * matching update to the backend's `LIVE_SYMBOLS` env var (or the
 * `app.live.symbols` property default in `application.properties`).
 *
 * <h3>Why static and not fetched from the backend?</h3>
 *
 * The list changes rarely (months), is small (≤10 entries), and is needed
 * synchronously at component-render time. Fetching it via TanStack Query
 * adds a network round-trip on every page that picks a symbol, plus a
 * loading state, plus a fallback if the request fails. The static list
 * gives compile-time TypeScript checking (`SupportedSymbol` is a literal
 * union) and zero runtime cost. If the symbol roster ever grows beyond
 * ~10 or starts changing frequently, switch to a `GET /api/v1/symbols`
 * fetch and re-export the result through this same module — call sites
 * won't change.
 *
 * <h3>Coordination with the backend</h3>
 *
 * The backend's WebSocket subscribers (`BinanceWebSocketClient`,
 * `BinanceTradeStreamClient`) read `app.live.symbols` (CSV). Symbols
 * present here but missing from that env var will appear in the UI but
 * have no data flowing. Symbols in the env var but missing here are
 * captured server-side but invisible in the UI. Keep them in sync.
 */
export const SUPPORTED_SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
] as const;

/** Compile-time union of supported symbols. */
export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

/**
 * Default symbol for `useState` initialization. Picks the first entry of
 * {@link SUPPORTED_SYMBOLS} so the default automatically tracks any
 * reordering — if BTCUSDT ever stops being the primary, swap the list
 * order and the rest of the UI follows.
 */
export const DEFAULT_SYMBOL: SupportedSymbol = SUPPORTED_SYMBOLS[0];

/**
 * Comma-separated example list used in form placeholders.
 * Renders as e.g. `"BTCUSDT, ETHUSDT"`. Truncates at 3 entries to keep
 * placeholder lines readable when the supported-symbols list grows.
 */
export const SYMBOL_EXAMPLES: string = SUPPORTED_SYMBOLS.slice(0, 3).join(', ');

/**
 * Pre-built `e.g. {symbols}` string for `<input placeholder>`. Saves
 * call sites from concatenating themselves and keeps the example phrasing
 * uniform across the codebase.
 */
export const SYMBOL_PLACEHOLDER: string = `e.g. ${SYMBOL_EXAMPLES}`;

/** Runtime predicate for narrowing strings to `SupportedSymbol`. */
export function isSupportedSymbol(s: string): s is SupportedSymbol {
    return (SUPPORTED_SYMBOLS as readonly string[]).includes(s);
}

/**
 * Validated strategies per symbol. A strategy code only appears in this map
 * after its defaults have been validated for that symbol (out-of-sample
 * walk-forward + V11/V60 gates passing on backtest history). Listed here →
 * selectable in /strategies "New Strategy" flow; absent → blocked.
 *
 * <h3>Why frontend-only?</h3>
 *
 * The backend has no per-symbol defaults table — defaults are hardcoded in
 * Java and apply to every symbol. This map is the operator's *intent*
 * (which symbols a strategy is approved-to-run on) layered on top. Backtest
 * and research pages do NOT consult this map — that's where validation
 * happens, and gating it would create a chicken-and-egg trap.
 *
 * <h3>Adding ETHUSDT support for a strategy</h3>
 *
 * 1. Validate via /research sweeps on ETH history.
 * 2. Confirm V11+V60 gates pass.
 * 3. Add the strategy code to {@link SUPPORTED_STRATEGIES_BY_SYMBOL.ETHUSDT}.
 *
 * Per the 2026-05-17 ETH validation verdict, LSR/VCB/VBO all FAILED on ETH
 * with BTC-tuned defaults — so ETH starts empty.
 */
export const SUPPORTED_STRATEGIES_BY_SYMBOL: Record<SupportedSymbol, readonly string[]> = {
    // Each code below has *realistic-capital backtest evidence* on BTCUSDT
    // (≥$1k initial, ≥1yr window, ≥30 trades, every run positive). See
    // memory/feedback_proven_profitable_only.md for the methodology and the
    // counter-pattern (averaging tiny-capital parameter sweeps is misleading).
    BTCUSDT: ['DCB', 'LSR', 'VBO', 'VCB'],
    // 2026-05-17: ETH has zero validated codes — LSR/VCB/VBO failed V11+V60
    // gates with BTC-tuned defaults; DCB hasn't been ETH-tested. Add codes
    // here only after fresh ETH-tuned validation.
    ETHUSDT: [],
};

/**
 * Returns the validated strategy codes for a symbol. Unknown symbols return
 * an empty list (fail-closed: no rows can be created on a symbol the
 * frontend doesn't know about).
 */
export function getSupportedStrategies(symbol: string): readonly string[] {
    return (SUPPORTED_STRATEGIES_BY_SYMBOL as Record<string, readonly string[]>)[symbol] ?? [];
}

/** True when at least one validated strategy exists for the symbol. */
export function hasSupportedStrategies(symbol: string): boolean {
    return getSupportedStrategies(symbol).length > 0;
}

/** True when the strategy is validated for the symbol. */
export function isStrategySupportedForSymbol(strategyCode: string, symbol: string): boolean {
    return getSupportedStrategies(symbol).includes(strategyCode);
}
