# Trade Execution History tab — design

**Date:** 2026-06-11
**Status:** Approved (brainstorm), pending implementation plan
**Repos touched:** `blackridge-frontend` (primary) + `blackheart-trading-engine` (backend endpoint)

## Goal

Add a second tab to the `/trades` page — **Execution History** — so a user can diagnose *why* trade executions fail. It leads with a failure-cause breakdown (true totals over a date range), then drills into the individual failed executions, with a detail drawer exposing the raw engine error.

## Why / user problem

Today the trades Journal only shows trades that opened. When a strategy fires but no trade appears (e.g. min-notional reject, insufficient balance, LIMIT_MAKER timeout), the user has no visibility — the rejection is logged server-side but never surfaced. This tab turns that silent log into a diagnosis tool.

## Current state (what already exists)

**Backend — the data and a basic endpoint already exist:**
- Table `trade_execution_log` (`V1__baseline.sql`): columns `trade_execution_log_id, execution_type (OPEN|CLOSE), side (LONG|SHORT), status (SUCCESS|FAILED|DIVERTED), account_id, username, asset, strategy_name, execution_reason, trade_id (nullable), error_message (TEXT), executed_at`. Indexed on `account_id` and `executed_at DESC`.
- Entity `model/TradeExecutionLog.java`; repo `repository/TradeExecutionLogRepository.java`; write service `service/trade/TradeExecutionLogService.java`; query service `service/trade/TradeExecutionQueryService.java`.
- Endpoint `GET /api/v1/trade-executions?page&size` (`controller/TradeExecutionController.java`) → paginated `TradeExecutionEventResponse` `{id, executionType, side, status, accountId, username, asset, strategyName, executionReason, errorMessage, tradeId, executedAt}`. **Scoped to the caller's accounts; excludes `DIVERTED` server-side. Supports only page/size — no other filters, no aggregation.**

**Frontend — `/trades` page (`src/app/(dashboard)/trades/page.tsx`):**
- Single view today (no tabs). Radix tab primitives exist at `@/components/ui/tabs`.
- Data via `apiClient` (axios) + TanStack Query hooks (`src/hooks/useTrades.ts`), API layer `src/lib/api/trades.ts`.
- Renders `DataTable` (TanStack Table v8, `src/components/shared/DataTable.tsx`).
- Filters (status pills, symbol search, strategy `<select>`, `DatePicker` range) are URL-synced via `patchFilters`.
- Account scope from `useActiveAccount()` → `scopedAccountId`. A single **HEDGING** account currently renders `RebalancesMonitor` instead of the journal.

## Scope

### In scope
1. Backend: extend the execution endpoint with filters + a summary aggregation, and a server-side failure-cause classifier.
2. Frontend: a new **Execution History** tab on `/trades` with breakdown panel + filterable table + row-detail drawer.

### Out of scope (YAGNI)
- The `order_audit` (V66) ML-decision plane — not wired, not needed here.
- CSV export, alerting on failure spikes, charts beyond the horizontal cause bars.
- Changing how/when rejections are *written* (write path is untouched).

## Decisions (locked in brainstorm)

| Decision | Choice |
|---|---|
| Layout | **B + A combined** — cause breakdown on top, full execution log underneath |
| Breakdown accuracy | **True totals over the date range** (backend aggregation), not loaded-window |
| Cause categories | **6 buckets** (below) |
| Categorizer location | **Backend** — so summary counts and per-row category stay consistent |
| Row detail | **Side drawer** (not modal/navigation — rejected rows often have no trade page) |
| DIVERTED rows | **Excluded by default** (paper diversions are not real failures) |
| Hedging accounts | Tab **also shown** there (they execute real orders): `Rebalances \| Execution History` |

## Failure-cause categories (the classifier)

Server-side function maps `error_message` → one of 6 `failureCategory` values. Match is ordered (first hit wins), case-insensitive, on substrings of `error_message`:

| Category | Match heuristics (from real engine strings) |
|---|---|
| `MIN_NOTIONAL` | "below minimum notional", "Min-notional floor" |
| `INSUFFICIENT_BALANCE` | "insufficient balance", "cannot afford" |
| `QUANTITY_PRECISION` | "quantity is zero after step", "invalid for step size", "below minimum position quantity", "LOT_SIZE", "precision" |
| `NO_FILL_TIMEOUT` | "LIMIT_MAKER no fill", "CANCELED_ON_TIMEOUT", "REJECTED_NO_FALLBACK" |
| `EXCHANGE_API_ERROR` | non-empty error that matched none of the above AND does **not** start with `"Pre-trade validation:"` (i.e. a raw exchange/runtime message) |
| `OTHER` | empty error, or a remaining `"Pre-trade validation: …"` message not matched above |

Concrete order: try `MIN_NOTIONAL` → `INSUFFICIENT_BALANCE` → `QUANTITY_PRECISION` → `NO_FILL_TIMEOUT`; if none match, branch on the `"Pre-trade validation:"` prefix → `OTHER`, else → `EXCHANGE_API_ERROR`. This is fully determined by `error_message` text alone (no need to know the failure's source at read time).

Notes:
- Classifier lives in one place in the JVM (e.g. `FailureCategoryClassifier`) and is applied both when building list rows (`failureCategory` field on the row) and when computing the summary, so they can never disagree.
- `SUCCESS` rows have `failureCategory = null`.

## Backend changes (`blackheart-trading-engine`)

1. **Classifier** — `FailureCategoryClassifier.classify(status, errorMessage) → FailureCategory` (enum + `OTHER`/null). Unit-tested against the known reason strings.
2. **List endpoint filters** — extend `GET /api/v1/trade-executions` query params: `status` (default behavior preserved: still excludes DIVERTED; new `status=FAILED|SUCCESS|ALL` narrows), `symbol`, `strategyName`, `from`, `to`, `executionType` (OPEN|CLOSE|ALL). Add `failureCategory` filter (drill-down from a clicked bar). Add `failureCategory` to `TradeExecutionEventResponse`. Repository gains a filtered query (Specification or explicit JPQL); DIVERTED stays excluded unless explicitly requested (we will NOT expose DIVERTED in this feature).
3. **Summary endpoint** — `GET /api/v1/trade-executions/summary`, returning `{ totalExecutions, failedCount, successCount, successRatePct, topCategory, byCategory: [{category, count, pct}] }`. **Filters honored: date range + symbol + strategy + executionType only — NOT `status` and NOT `failureCategory`.** (The summary must see both successes and failures to compute `successRatePct`, and it always groups *all* failures by category regardless of which bar the table is drilled into.) `byCategory` counts are over the failed subset; `successRatePct = successCount / totalExecutions`. Same account-scope as the list; DIVERTED excluded.
4. **Parity / safety** — read-only endpoints; no change to the write path or any trading logic. Per operator rule, mirror the migration-free change to dev and verify there first; deploy via GitHub Actions.

> Note: classification runs at read time over `error_message`. No schema change is required (we are not persisting the category). If volume later makes read-time classification expensive, a materialized `failure_category` column is a future optimization — out of scope now.

## Frontend changes (`blackridge-frontend`)

**Page restructure (`trades/page.tsx`):**
- Wrap the page body in `Tabs`. Tab set depends on account type:
  - TRADING / "All" accounts: `Journal` (existing view) + `Execution History` (new).
  - Single HEDGING account: `Rebalances` (existing `RebalancesMonitor`) + `Execution History` (new).
- Active tab persisted in the URL (`?tab=executions`), consistent with the existing URL-synced filters.
- Extract the current journal body into a `JournalTab` component so `page.tsx` stays a thin shell (the file is already ~900 lines — this split is part of the work, not optional).

**New components (under `src/components/trades/execution-history/` or similar):**
- `ExecutionHistoryTab` — orchestrates filters + summary + table + drawer; reads `scopedAccountId`.
- `ExecutionFilterBar` — reuses existing status-pill / symbol / strategy / `DatePicker` patterns; adds an OPEN/CLOSE toggle. Default status = **Failed**, default range = last 30d.
- `FailureBreakdownPanel` — summary strip (Executions / Failed / Success rate / Top cause) + the 6 horizontal cause bars (count + %). Clicking a bar sets the `failureCategory` filter (toggles off on re-click). Bars sorted desc by count; zero-count categories shown dimmed.
- `ExecutionTable` — `DataTable` with columns: Time, Type (OPEN/CLOSE), Symbol, Strategy, Side, **Cause** badge, Detail (truncated `error_message` or `executionReason` for success rows). Server-paginated. Active-cause chip with an `✕` to clear.
- `ExecutionDetailDrawer` — slide-over showing full row: timestamp, cause, symbol·strategy·type·side, signal reason (`executionReason`), full `error_message`, and a link to the trade **iff** `tradeId` present (else an explicit "rejected before a trade was created" note).

**API + hooks:**
- `src/lib/api/tradeExecutions.ts` — `getExecutions(filters)` and `getExecutionSummary(filters)` typed against the new responses.
- `src/hooks/useTradeExecutions.ts` — `useExecutionsList(filters)` + `useExecutionSummary(filters)` (TanStack Query, keyed on all filter fields incl. `scopedAccountId`).

**Interaction model:**
- Breakdown is always computed over (date range + symbol + strategy), independent of the table's row-status toggle.
- Table defaults to Failed; the status pill can switch to All/Success (= direction A, the full log). A clicked cause bar adds a `failureCategory` filter to the table only.
- Empty states: "No executions in this range" (no data) vs "No failures 🎉 — all executions succeeded" (range has executions, zero failures).

## Edge cases

- **Row with no `tradeId`** (rejected pre-trade): drawer shows the explicit note, no broken trade link.
- **`error_message` null on SUCCESS rows**: Detail column falls back to `executionReason`; Cause column shows a success dot, not a category.
- **Long error strings**: truncate in the table cell, full text in the drawer.
- **HEDGING vs TRADING tab sets**: driven off `activeAccount.accountType` + `isAll`, same source the page already uses.
- **"All" accounts aggregate**: endpoint already scopes to all of the caller's accounts; summary + list both honor `scopedAccountId` (undefined ⇒ all).
- **DIVERTED**: never surfaced in this feature (endpoint keeps excluding it).

## Testing

**Backend:**
- `FailureCategoryClassifier` unit tests: one assertion per known reason string → expected category, plus null/empty → `OTHER`, plus SUCCESS → null.
- Endpoint tests: filter combinations (status, symbol, strategy, from/to, executionType, failureCategory); account-scope isolation (user A cannot see user B); DIVERTED excluded; summary counts == list counts for the same filter; `successRatePct` math.

**Frontend:**
- Component tests: breakdown bar click sets/clears `failureCategory`; status toggle Failed↔All; empty-state branches (no data vs no failures); drawer renders no-trade note when `tradeId` absent; tab set differs by account type.
- The existing Journal view is untouched and still renders under its tab (regression guard).

## Rollout

1. Backend endpoint + classifier → verify on **dev** first (operator rule), then deploy via GitHub Actions.
2. Frontend tab → can ship after the backend is live on the target environment; gate nothing behind a flag (read-only, additive).
3. No DB migration. No change to live trading behavior.
