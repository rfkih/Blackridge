# Live Trade-History Candlestick Chart — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)
**Author:** Claude (with operator)

## Goal

Let the operator see and track **live trades** plotted on real price candles — the
same annotated-chart experience the backtest result page already provides — on:

1. **`/trades` (list page):** a chart panel overlaying every loaded trade for one
   selected symbol, so the operator can scan their executed trades against price.
2. **`/trades/[id]` (detail page):** a chart auto-zoomed to a single trade's
   entry→exit window, with its stop-loss / take-profit levels drawn.

Each real execution is annotated with its **BUY / SELL action** (entry arrow +
action-labeled exit marker), colored by outcome.

## Principle: reuse, don't rebuild

The existing `BacktestAnnotatedChart` (`src/components/backtest/BacktestAnnotatedChart.tsx`)
already renders: candlesticks, entry/exit markers, SL/TP price lines, trade
duration bands, a hover tooltip, a click-to-detail card, indicator overlays
(EMA/BB/KC/RSI/MACD/ATR/ADX), PNG export, and chart↔selection wiring. It is
coupled only to the `BacktestTrade` shape and `CandleData[]` — not to backtests.

Live data sources already exist too:
- `fetchCandlesRange(symbol, interval, fromMs, toMs)` → `GET /api/v1/market` (trading JVM)
- `fetchIndicatorsRange(symbol, interval, fromMs, toMs)` → `GET /api/v1/market/indicators`
- `useBacktestIndicators(...)` and `useEmaWarmupCandles(...)` — already generic over
  `(symbol, interval, range)`; reused as-is.
- `IntervalTabs`, `SymbolPicker`, `IndicatorBar`, `useChartIndicators`.

So the work is **an adapter + a generic candle hook + a thin wrapper + small,
backward-compatible extensions to two shared chart utilities + two wiring points.**
No new charting/canvas code.

## Data model gap (live `Trades` → `BacktestTrade`)

| `BacktestTrade` field | Source from live `Trades` |
|---|---|
| `id`, `strategyCode`, `direction`, `entryTime`, `entryPrice`, `tp1Price`, `tp2Price`, `quantity`, `realizedPnl` | identical |
| `strategyName` | `strategyCode` |
| `interval` | the chart's selected interval (live trades carry no interval) |
| `exitPrice` | `exitAvgPrice` |
| `stopLossPrice` | `stopLossPrice > 0 ? stopLossPrice : null` (collapse 0 → null = signal-exit) |
| `rMultiple` | derived: `move / risk` where `risk = |entry − stop|`, `move = LONG ? exit−entry : entry−exit`; **`NaN` when no fixed stop or still open** (renders `—`) |
| `backtestRunId` | `''` (unused by the chart) |
| `positions[]` | map `TradePosition` → `BacktestTradePosition` (`id`, `type`, `quantity`, `exitTime`, `exitPrice`, `exitReason`, `realizedPnl`); drop `entryPrice`, `feeUsdt` |

Open trades: `exitTime`/`exitPrice` null and open legs have no `exitReason` →
`buildTradeMarkers` emits the entry marker only; SL/TP price lines still draw;
`deriveTradeOutcome` → `Open`. Correct, no special-casing needed.

`PositionExitReason` on live trades includes `MANUAL_CLOSE` and `EMABAND_EXIT`;
both are already handled by `buildTradeMarkers`/`LEG_MARKER_CONFIG` (EMABAND_EXIT
falls through to a generic exit marker).

## Components & files

### New

**1. `src/lib/trades/liveTradeToBacktestTrade.ts`** (+ `liveTradeToBacktestTrade.test.ts`)
Pure adapter `(t: Trades, interval: string) => BacktestTrade` per the table above.
Unit-tested: long/short, open trade, signal-exit (no stop → `rMultiple` NaN),
multi-leg positions.

**2. `src/hooks/useRangeCandles.ts`**
TanStack Query over `fetchCandlesRange(symbol, interval, fromMs, toMs)`. The one
generic candle hook missing today (only `useBacktestCandles` by run-id and
`useEmaWarmupCandles` for warmup exist). Disabled until symbol/interval/range
present. `staleTime` ~60s; key `['range-candles', symbol, interval, fromMs, toMs]`.

**3. `src/components/trades/TradeHistoryChart.tsx`**
Shared wrapper used by both pages.
Props (interval + symbol are **fully controlled** — callers own the state and
seed the initial interval with `defaultIntervalForSpan`):
```ts
interface TradeHistoryChartProps {
  symbol: string;
  trades: Trades[];                 // already scoped to `symbol` by the caller
  interval: ChartInterval;          // controlled
  onIntervalChange: (iv: ChartInterval) => void;
  onSymbolChange?: (s: string) => void; // when set + showControls, renders SymbolPicker
  selectedTradeId?: string | null;
  onTradeSelect?: (id: string | null) => void;
  scrollTrigger?: number;
  height?: number;
  showControls?: boolean;           // render the SymbolPicker(if onSymbolChange)/IntervalTabs row
  bare?: boolean;                   // drop the outer card chrome so a parent (the
                                    // collapsible journal panel) owns border/bg
}
```
Responsibilities:
- Window: always **derived** from `trades` — `[min(entryTime), max(exitTime ?? now)]`,
  padded by ≥30 bars of the chosen interval each side, clamped to ≤1000 bars (keeping
  the most recent slice) and floored at epoch 0. Returns null (→ empty state) when no
  trade has a usable entry time. (No `fromMs/toMs` override prop — deriving from the
  single trade on the detail page is equivalent and simpler.)
- Interval: controlled via `interval`/`onIntervalChange`; `IntervalTabs` rendered
  when `showControls` with `intervals={['15m','1h','4h','1d']}`. Callers compute the
  initial value with `defaultIntervalForSpan(span)`.
- Fetch candles (`useRangeCandles`) + indicators (`useBacktestIndicators`, lazy on
  `anyActive`) + EMA-100 warmup (`useEmaWarmupCandles`).
- Adapt `trades` → `BacktestTrade[]` via the adapter (memoized).
- Render `IndicatorBar` + `BacktestAnnotatedChart` with `exitLabelMode="action"`.
- Owns loading / empty ("no candles for this window") / error + retry states.

**4. `src/lib/charts/defaultInterval.ts`** — `defaultIntervalForSpan(spanMs): ChartInterval`
Finest interval keeping the window under ~400 candles, over `['15m','1h','4h','1d']`:
`≤4d → 15m`, `≤16d → 1h`, `≤66d → 4h`, else `1d`.

### Extended (backward-compatible — existing callers unchanged)

**5. `src/types/market.ts`** — widen `ChartInterval` to `'5m' | '15m' | '1h' | '4h' | '1d'`.

**6. `src/components/charts/IntervalTabs.tsx`** — add optional `intervals?: ChartInterval[]`
prop (default `['5m','15m','1h','4h']`, so the **market page is unchanged**). Trades
chart passes `['15m','1h','4h','1d']`.

**7. `src/lib/backtest/buildTradeMarkers.ts`** — add optional
`opts?: { exitLabelMode?: 'reason' | 'action' }` (default `'reason'`). When
`'action'`, exit-leg marker text = executed close side (`LONG → 'SELL'`,
`SHORT → 'BUY'`), keeping the outcome **color** from `LEG_MARKER_CONFIG`. Default
preserves current backtest labels exactly.

**8. `src/components/backtest/BacktestAnnotatedChart.tsx`** — add optional
`exitLabelMode?: 'reason' | 'action'` prop (default `'reason'`), threaded into the
`buildTradeMarkers` call. Zero behavior change for the backtest result page.

### Wiring

**9. `src/app/(dashboard)/trades/[id]/page.tsx`** — `TradeDetailChartSection` after the
summary-cells grid. `trades={[trade]}`, `symbol={trade.symbol}`,
`selectedTradeId={trade.id}` (draws SL/TP lines; the derived window + the chart's
`fitContent()` frame the trade — no `scrollTrigger` needed), local interval state
seeded by `defaultIntervalForSpan(trade span)`. Single symbol.

**10. `src/app/(dashboard)/trades/page.tsx`** — `TradesListChart`: a **collapsible**
(default-open) card between `JournalStatsStrip` and the filter/table section, owning
the border + header toggle, with the chart rendered `bare` inside. Own `SymbolPicker`
(defaults to the active `filters.symbol`, else the most-traded loaded symbol, else
`DEFAULT_SYMBOL`) + `IntervalTabs`. Interval is seeded from the visible symbol's trade
span via `defaultIntervalForSpan` (re-seeds on symbol change until the user picks one).
`trades` = loaded page trades filtered to the chart symbol. Marker click → the chart's
built-in detail card. **No change to the journal `DataTable`** (row click still
navigates to the detail page).

### Supporting fix

**11. `src/lib/api/trades.ts`** + **`BacktestAnnotatedChart` `legSummary`/`legDotColor`** —
`EMABAND_EXIT` was dropped by `narrowExitReason` (whitelist omitted it) and unlabeled in
the leg list. Added it to the whitelist (so signal-exit closes get a SELL marker) and a
`signal exit` label + info dot — surfacing it is what makes the BUY/SELL annotation
complete for EMA_BAND.

## Marker / annotation behavior (the BUY/SELL ask)

- **Entry** (open execution): existing directional arrow, text `BUY` (long) /
  `SELL` (short), green/red.
- **Exit** (close execution), `exitLabelMode="action"`: marker text = `SELL`
  (closing a long) / `BUY` (closing a short), colored by outcome
  (TP green, SL red, runner/other per `LEG_MARKER_CONFIG`).
- Result: every real fill on the chart reads as its actual buy/sell action, with
  outcome conveyed by color and the hover tooltip / detail card.

## Out of scope (v1)

- Full bidirectional table↔chart row-scroll sync on the list page (would require
  reworking the journal `DataTable`'s navigate-on-click behavior).
- Streaming/live candle updates on the chart (uses range snapshot + normal
  query refetch; live mark price is already shown elsewhere on the page).
- Partial scale-in/out marker sizing beyond what `buildTradeMarkers` already does.

## Testing / verification

- Unit: `liveTradeToBacktestTrade` (mappings, open trade, no-stop NaN R, positions);
  `defaultIntervalForSpan` (boundaries).
- `pnpm tsc --noEmit`, `pnpm lint`, existing `src/app/(dashboard)/trades/page.test.tsx`
  stays green, `pnpm build`.
- No unit test for the TV/canvas chart render (consistent with the repo — the
  existing annotated chart has none; jsdom can't exercise the canvas path).
- Manual: detail page shows one trade auto-zoomed with SL/TP + BUY/SELL markers;
  list page shows multiple trades for a symbol; 1d strategy trade defaults to a
  coarse interval; symbol switch + interval switch refetch correctly.
