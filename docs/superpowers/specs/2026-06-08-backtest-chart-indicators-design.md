# Backtest Chart Technical Indicators — Design

**Date:** 2026-06-08
**Status:** Approved (Approach B), pending spec review
**Scope:** Add a full, TradingView-style, toggleable technical-indicator layer to the backtest trade chart, reusable across **all** backtest result pages and the market page.

## Goal

The backtest trade chart (`BacktestAnnotatedChart`, used by `backtest/[id]/page.tsx`) shows candles + trade markers + SL/TP lines but **no technical indicators**. Add as many indicators as the platform accurately provides, each individually toggleable on/off, on every backtest chart. Values must be **accurate** (real backend feature-store values, not frontend approximations).

## Approach (B — shared indicator infrastructure)

Indicators currently exist only on the market page (`CandlestickChart` + an inline `IndicatorBar` in `market/page.tsx`, covering a smaller set: EMA20/50, Bollinger, Keltner, RSI). Rather than duplicate that into the backtest chart, extract the indicator layer into shared modules and have **both** charts consume it, expanding to the full available set. This matches the repo DRY rule (indicators now live on 2+ charts).

## Indicator set (everything `/api/v1/market/indicators` provides)

The endpoint returns feature-store values for `IndicatorData`: `ema20, ema50, ema200, bbUpper/Middle/Lower, kcUpper/Middle/Lower, rsi, macd, macdSignal, macdHistogram, atr, adx`, scoped by `symbol, interval, from, to`.

| Indicator | Type | Pane | Series |
|---|---|---|---|
| EMA 20 / 50 / 200 | overlay | main | 3 line series |
| Bollinger Bands | overlay | main | upper/middle/lower (dashed bounds) |
| Keltner Channel | overlay | main | upper/middle/lower (dashed) |
| RSI | oscillator | sub-pane | line + 70/30 guide lines |
| MACD | oscillator | sub-pane | macd line + signal line + histogram |
| ATR | oscillator | sub-pane | line |
| ADX | oscillator | sub-pane | line (+25 guide) |

**Accuracy:** all values come from the backend feature-store (same source strategies read), fetched for the backtest's exact `symbol / interval / start_time→end_time`. Periods are the feature-store standards (20/50/200, etc.); arbitrary user-configurable periods are **out of scope** (would require backend computation).

## Architecture / components

New shared modules under `src/components/charts/indicators/` + `src/lib/charts/` + `src/hooks/`:

1. **`indicatorConfig.ts`** — single source of truth: ordered list of indicators, each `{ key, label, group: 'overlay'|'oscillator', color(s), seriesSpec }`. Drives both the toggle bar and the renderer. Replaces the ad-hoc `CandlestickChartIndicators` flag set with a superset type `ChartIndicators` (back-compatible keys).
2. **`IndicatorBar.tsx`** — shared toggle control (extracted from `market/page.tsx`'s inline `IndicatorBar`); renders an on/off pill per indicator, grouped overlay vs oscillator.
3. **`useChartIndicators(storageKey)`** (hook) — toggle state + `localStorage` persistence + `toggle(key)`. Keys: `blackheart:backtest-indicators` and `blackheart:market-indicators` (separate so the two pages remember independently).
4. **`useChartIndicatorSeries({ chart, tvModule, features, showIndicators, lineStyle })`** (hook/util) — given a TV chart handle + `IndicatorData[]` + active flags, creates/updates/removes overlay line series on the main pane and oscillator series in sub-panes; incremental (toggling one indicator doesn't rebuild the chart). Oscillators use **lightweight-charts v5 native panes** (`addPane`); if panes prove problematic, fall back to the existing synced-subchart approach (as `CandlestickChart` does for RSI today).
5. **`useBacktestIndicators(symbol, interval, fromMs, toMs)`** (hook) — TanStack Query wrapper over the existing `/api/v1/market/indicators` endpoint, scoped to the run window; `enabled` only when ≥1 indicator is active (lazy fetch).

## Data flow

```
backtest/[id]/page.tsx
  ├─ useBacktestRun(id) → symbol, interval, start_time, end_time
  ├─ useChartIndicators('blackheart:backtest-indicators') → {showIndicators, toggle}
  ├─ useBacktestIndicators(symbol, interval, start, end)  [enabled when any active]
  └─ <BacktestAnnotatedChart candles trades features={...} showIndicators={...} />
         └─ useChartIndicatorSeries(...)  // renders overlays + oscillator panes
  └─ <IndicatorBar indicators showIndicators onToggle />
market/page.tsx  → rewired onto the same IndicatorBar + useChartIndicators + (already) CandlestickChart
```

## Consumers rewired

- **`BacktestAnnotatedChart`** — accepts new optional props `features?: IndicatorData[]` + `showIndicators?: ChartIndicators`; calls `useChartIndicatorSeries`. Existing candle/marker/SL-TP behavior untouched (purely additive; default no features → no overlays).
- **`CandlestickChart`** (market) — its inline indicator logic is replaced by `useChartIndicatorSeries`; gains the expanded set (EMA200, MACD, ATR, ADX) for free.
- **`market/page.tsx`** — inline `IndicatorBar` + persistence replaced by the shared component/hook.

## Defaults & UX

- All indicators **off by default** — chart unchanged until the user opts in.
- Toggle state persists per page (separate storage keys).
- Overlays draw on the candle pane; each active oscillator adds a compact sub-pane beneath.
- Colors from `indicatorConfig`, consistent across both charts and the existing `chartTheme` (`TV.*`).

## Out of scope (future)

- Strategy-specific overlay (e.g. the EMA-100 ±band the `EMA_BAND` strategy actually trades) — needs per-run param plumbing; flagged as a follow-up.
- User-configurable indicator periods (needs backend on-demand computation).
- Volume histogram (not in the indicators endpoint).

## Testing

- Unit (Vitest): `indicatorConfig` integrity; `useChartIndicators` persistence + toggle reducer; `IndicatorBar` render + onToggle (RTL).
- Component: `useChartIndicatorSeries` add/remove series on flag changes (mock TV chart handle), and null-value gap handling.
- Regression: `BacktestAnnotatedChart` with no `features` renders identically to today (markers/SL-TP intact); market page still works with the shared bar.
- `pnpm tsc --noEmit` + `pnpm lint` clean.

## Risks

- **v5 panes** API maturity — mitigated by the synced-subchart fallback already proven in `CandlestickChart`.
- **Indicators endpoint window size** — a multi-year 1d run is small (hundreds of points); intraday long runs could be large → cap/downsample if needed (note, not expected to bind for 1d/4h backtests).
- Refactoring the market page is additive-equivalent; covered by the regression check above.
