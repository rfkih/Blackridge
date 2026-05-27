# Strategy Top Runs Dialog — Design Spec
**Date:** 2026-05-27
**Status:** Approved

## Goal

Surface the top 5 historical backtest results for a strategy directly on the strategy list page, so users know the expected return of a parameter configuration before committing to a new backtest run.

---

## Scope

- **In scope:** trigger button on strategy list cards, dialog with ranked table, expandable param rows, loading/empty states
- **Out of scope:** "Run with these params" wizard navigation (deferred), strategy detail page trigger, cross-strategy global leaderboard

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `src/components/strategy/StrategyTopRunsDialog.tsx` | Dialog component — ranked table + expandable rows |

### Modified files

| File | Change |
|---|---|
| `src/hooks/useBacktest.ts` | Add `useTopRunsForStrategy(code, symbol, interval)` hook |
| `src/app/(dashboard)/strategies/page.tsx` | Add "Top runs" trigger button to each strategy card + wire dialog open/close state |

---

## Data Flow

1. User clicks **Top runs** button on a strategy card.
2. Dialog opens; `useTopRunsForStrategy` fires with `{ strategyCode, symbol, interval }`.
3. Hook calls `listBacktestRuns({ status: 'COMPLETED', strategyCode, symbol, interval, size: 50, sortBy: 'createdAt', sortDir: 'DESC' })`.
4. Client-side post-processing:
   - Filter: keep runs where `fromDate ≤ (today − 2 years)` — backtest window started at least 2 years ago.
   - Filter: keep runs where `metrics.profitFactor > 1.0` (profitable only).
   - Sort: by `metrics.geometricReturnPctAtAlloc90` (ag90) descending.
   - Take top 5.
5. Render table. If `< 1` run passes filters, render empty state.

### Hook signature

```ts
export function useTopRunsForStrategy(
  strategyCode: string,
  symbol: string,
  interval: string,
  options?: { enabled?: boolean }
)
```

Returns `{ data: BacktestRun[], isLoading: boolean, isError: boolean }` (unwrapped from the page envelope, already filtered + sorted).

Hook is **disabled** when dialog is closed (`enabled: false`) — no background fetching while the dialog is not open.

---

## Dialog UI

### Trigger button

Placed in the existing action row of each strategy card in `strategies/page.tsx`. Style: small ghost button, same size as existing action buttons.

```
[ ↗ Top runs ]
```

State: one `topRunsTarget` state variable holds `AccountStrategy | null`. Non-null = dialog open for that strategy. Single dialog instance shared across all cards (not one per card).

### Dialog structure

- **Size:** `max-w-2xl`
- **Header:**
  - Title: `Top backtest results`
  - Description: `{strategyCode} · {symbol} · {interval}`

### Table columns

| Column | Source field | Format |
|---|---|---|
| Rank | row index | `#1` … `#5` |
| Period | `fromDate` → `toDate` | `Jan 2024 – May 2026` (MMM yyyy) |
| ag90 | `metrics.geometricReturnPctAtAlloc90` | `+94.2%` colored |
| Sharpe | `metrics.sharpe` | `1.85` or `—` if null |
| PF | `metrics.profitFactor` | `1.63` or `—` if null |
| Max DD | `metrics.maxDrawdownPct` | `13%` |
| Params | derived from `paramSnapshot` | `3 overrides` / `Defaults` |
| Expand | — | `▸` / `▾` toggle |

### Expandable row

Clicking a row (or the ▸ icon) expands an inline panel below that row showing the param overrides as a two-column key/value list:

```
stopLossAtrMultiplier   1.8   (default: 2.5)
takeProfitR             2.0   (default: 1.5)
trailingStopEnabled     true  (default: false)
```

Source: `paramSnapshot[strategyCode]` entries. If `paramSnapshot` is null or empty, show: `Default parameters — no overrides applied.`

### Color coding

| Condition | Color token |
|---|---|
| ag90 ≥ 20% | `--color-profit` |
| ag90 0–19.9% | `--text-primary` |
| ag90 < 0% | `--color-loss` |

### Loading state

3 skeleton rows (`<Skeleton>`) while `isLoading = true`.

### Empty state

> No completed backtests covering 2+ years found for **{strategyCode} · {symbol} · {interval}**.
> Run a backtest with a start date of {2 years ago, formatted} or earlier to build the ranking.

### Error state

> Could not load backtest history. Please try again.

---

## Key constraints

- **No backend changes.** All data comes from the existing `GET /backtest` list endpoint.
- **Single dialog instance** shared across all cards — `topRunsTarget: AccountStrategy | null` in local page state. Avoids N query subscriptions for N cards.
- Hook `enabled` tied to dialog open state — no background polling.
- `geometricReturnPctAtAlloc90` (ag90) is the ranking metric. Falls back to `totalReturnPct` if ag90 is null (pre-V60 legacy runs).
- Runs with `metrics = null` (FAILED, RUNNING) are excluded by the `status=COMPLETED` filter.
