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
    'SOLUSDT',
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
 * Validated strategies per symbol — now sourced from the backend
 * `symbol_strategy_approval` table (V102+). The static
 * `SUPPORTED_STRATEGIES_BY_SYMBOL` constant was removed: approvals are
 * managed via `/admin/strategies` (the symbol-approvals section embedded
 * there) and read at runtime via {@link useSymbolApprovals}.
 *
 * <p>Pickers must fetch the approval list themselves and pass it to these
 * helpers. The functions are pure; they don't hit the query cache directly,
 * which keeps them SSR-safe and trivially unit-testable.
 *
 * <p>Adding a symbol/strategy pair: validate via /research sweeps + walk-
 * forward, then approve via the admin UI (the backend gate enforces the
 * per-symbol thresholds).
 */

/** Minimal shape required by the helpers — re-typed locally to avoid a
 *  cycle with the `useSymbolApprovals` module. */
interface ApprovalLike {
    symbol: string;
    strategyCode: string;
}

/**
 * Returns the validated strategy codes for a symbol. Unknown symbols return
 * an empty list (fail-closed: no rows can be created on a symbol the
 * approval table has no entries for).
 */
export function getSupportedStrategies(symbol: string, approvals: readonly ApprovalLike[]): string[] {
    return approvals.filter((a) => a.symbol === symbol).map((a) => a.strategyCode);
}

/** True when at least one validated strategy exists for the symbol. */
export function hasSupportedStrategies(symbol: string, approvals: readonly ApprovalLike[]): boolean {
    return approvals.some((a) => a.symbol === symbol);
}

/** True when the strategy is validated for the symbol. */
export function isStrategySupportedForSymbol(
    strategyCode: string,
    symbol: string,
    approvals: readonly ApprovalLike[],
): boolean {
    return approvals.some((a) => a.symbol === symbol && a.strategyCode === strategyCode);
}
