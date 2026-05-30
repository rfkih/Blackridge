# Key Pages & Features

## 1. Dashboard (`/`)
Hero metrics: Total Unrealized P&L, Today's Realized P&L, Open Positions, Win Rate (30d). Open Positions panel (live WS). Recent Trades (last 10). Strategy status cards per active `AccountStrategy` (Live/Paused, last signal, last trade).

## 2. Trades (`/trades`)
Sortable/filterable trade table: Symbol, Strategy, Direction badge, Entry/Exit Price, Realized P&L, Duration, Status, Actions. Detail shows all `TradePosition` legs (SINGLE/TP1/TP2/RUNNER), prices/fees/net P&L per leg.

## 3. Strategies (`/strategies`)
One card per `AccountStrategy`: code badge, interval, capital, allow-long/short, priority, status. Detail edits `LsrParams`/`VcbParams` with defaults shown alongside. PUT/PATCH on save.

**Create / delete**
- "New Strategy" header button → `NewStrategyDialog` → `POST /api/v1/account-strategies`. Disabled when user has no active accounts.
- Trash icon (hover) → `DeleteStrategyDialog` → `DELETE /api/v1/account-strategies/:id`. Backend soft-deletes (sets `is_deleted=true`, `enabled=false`, `deleted_at=now()`); historical trades/P&L still resolve via the row.
- Delete is blocked server-side if `OPEN`/`PARTIALLY_CLOSED` trades exist. Error (`"Cannot delete strategy with N open trade(s)…"`) flows through `normalizeError` and renders inline — do not hide or remap it.

**Status derivation (important)**
Backend `current_status` column is **not maintained** — every row holds seed `"STOPPED"`. Treat as dead. Real liveness is `enabled: boolean` on `BackendAccountStrategy`. `mapAccountStrategy` in `src/lib/api/strategies.ts` derives `status = enabled ? 'LIVE' : 'STOPPED'`. `PAUSED` is unreachable until backend models it.

## 4. Backtest (`/backtest`)
- **Run list**: status (PENDING/RUNNING/COMPLETE/FAILED), strategy, range, return %, Sharpe, MDD. "New Backtest" → wizard.
- **Step 1 Config** (`/backtest/new`): symbol, interval, range, capital, strategy multi-select, `accountStrategyId` per strategy. → step 2 (state in `backtestParamStore`).
- **Step 2 Param Tuning** (`/backtest/new/params`): see `BACKTEST_PARAM_TUNING.md`. "Run Backtest" submits `POST /api/v1/backtest` w/ merged config + param overrides.
- **Run detail** (`/backtest/[id]`): equity curve, drawdown, metrics grid (WR, PF, Avg Win/Loss, MDD, Sharpe, Sortino, Total Trades), trade list + **annotated candlestick chart** (see `BACKTEST_CHART_OVERLAY.md`). "Re-run with params →" pre-fills wizard.

## 5. P&L Analytics (`/pnl`)
Daily/Weekly/Monthly P&L bar charts, cumulative line, per-strategy breakdown. Filter by date/strategy/symbol.

## 6. Portfolio (`/portfolio`)
Account balances, available vs locked, per-asset.

## 7. Market (`/market`)
TV Lightweight Charts candlestick for any symbol/interval. Overlay FeatureStore indicators (EMA/BB/KC) where available.

## 8. Monte Carlo (`/montecarlo`)
Submit sim params → distribution as fan chart (percentile bands).

## 9. Research Dashboard (`/research`)
Single admin-only page consolidating ops + research workflow. Seven panels:

1. **Service health** — trading + research JVM up/down dots, status, last-seen, port. Polls `GET /actuator/health` on each JVM (apiClient + researchClient) every 30s.
2. **JVM telemetry per JVM** — heap used/max with sparkline, non-heap, GC pause p99, live threads, uptime, system + process CPU%. Polls `/actuator/metrics/{jvm.memory.used,jvm.memory.max,jvm.gc.pause,jvm.threads.live,process.uptime,system.cpu.usage,process.cpu.usage}` every 5s. Frame buffer keeps last 60 samples for the sparkline.
3. **Scheduler status** — IP_MONITOR + research-tick last/next run from `/api/v1/scheduler`.
4. **Sweep activity** — queued/running/done counts + top-5 in-flight sweeps with progress bar. Reads existing `/api/v1/research/sweeps`.
5. **Promotion candidates (definition-scope, V40)** — one row per `StrategyDefinition` (NOT per `AccountStrategy`), grouped by current promotion state (PROMOTED / PAPER_TRADE / INACTIVE) derived client-side from `definition.enabled` + `definition.simulated`. Per-row Promote / Demote / Reject opens a confirm dialog (reason + evidence JSON) and calls `POST /api/v1/strategy-promotion/definition/{strategyCode}/promote`. The panel auto-opens the dialog when the URL hash matches `#promote-{strategyCode}` (deep-link from `/research/walk-forward`'s "Ready to promote" badge). The `StrategyDefinition` wire shape carries `enabled: boolean` and `simulated: boolean` (V40-added). Per-account `account_strategy.enabled`/`.simulated` still exist as overrides — the live executor papers an OPEN_* decision when EITHER scope says paper.
6. **Recent promotions feed** — last 50 promotion-log rows across all strategies via `GET /api/v1/strategy-promotion/recent` (added V23 backend).
7. **Research log tail** — last 200 lines of the research-tick log via existing `/api/v1/research/log` (admin-only).

Existing `/research/sweeps` and `/research/log` URLs unchanged. The new index lives at `/research`. Page is gated `hasRole('ADMIN')` to match the underlying endpoints. Polling cadence: 5s telemetry, 30s health/scheduler/sweeps/promotions, manual refresh button.

API modules added:
- `lib/api/strategy-promotion.ts` — promote, currentState, history, paperTrades, recentPromotions.
- `lib/api/actuator.ts` — health, metrics-by-name; dual-client (`apiClient` for trading JVM, `researchClient` for research JVM).

Hooks added:
- `useJvmTelemetry()` returns `{ trading: TelemetrySnapshot, research: TelemetrySnapshot, samples: TelemetryFrame[] }`.
- `useServiceHealth()` returns `{ trading: HealthStatus, research: HealthStatus }`.
- `useStrategyPromote()`, `useRecentPromotions()`.

## 10. Leaderboard (`/leaderboard`)
Public "Top Strategies" board — any authenticated user. Ranks the V102-approved `(symbol, strategy_code)` set by a composite of backtest profitability × robustness; nothing unapproved is ever shown. Each row: rank badge (top-3 green), `StrategyBadge` + symbol + interval + latest walk-forward verdict pill, a 5-metric grid (CAGR / Max DD / PSR / Profit factor / Trades), composite **Score**, a **Deploy** button, and a collapsible chip list of the strategy's winning params. Limit picker (5/10/25, default 10). Max-DD is shown prominently + used as the score tie-break, but deliberately **not** folded into the score.

Deploy is one-click → LIVE: tapping **Deploy** opens `DeployStrategyDialog` (account `Select` over active accounts, editable capital-allocation `Input` defaulting to 5%, validated `0.01–ALLOC_MAX_PCT`), confirms with a green LIVE warning, then `POST /api/v1/leaderboard/deploy`. On success the new `enabled=true` preset lands on the account (params replayed from the approved backtest), a toast directs the user to `/strategies`, and the `['strategies']` query is invalidated. Users can flip the preset to paper afterwards on the strategy page.

**Conflict prompt.** Because the backend allows only one *enabled* preset per `(account, strategy, symbol, interval)` and silently deactivates any sibling (`findActivePresets` filters on `enabled=true` only — LIVE **or** paper), deploying LIVE would silently stop a matching preset. The dialog detects that collision via `useStrategies()` (owned preset on the chosen account with the same tuple whose `status` is `LIVE` or `PAPER`) and surfaces a Replace-vs-Keep choice: **Replace** sends `activate:true` (existing deactivated, new lands LIVE) — **Keep existing** sends `activate:false` (existing keeps running, new lands STOPPED to enable later). With no conflict, `activate` stays `true` (the original behaviour). The LIVE warning, Deploy button label/style, and success toast all switch on the resolved `willActivate`. Submit is gated on the owned-strategies list being loaded (`strategiesKnown`) so a cold cache can't let a LIVE deploy slip past the check; the dialog refetches that list on open to avoid acting on stale state, and a Replace that 400s on the sibling's open trades auto-switches the choice to **Keep existing**.

API module: `lib/api/leaderboard.ts` — `getTopStrategies(limit)`, `deployStrategy(payload)` (maps the created row via `mapAccountStrategy`). Hooks: `useTopStrategies(limit)` (keyed by limit, `strategyParams` staleTime), `useDeployStrategy()` (invalidates `['strategies']`). Domain types in `types/leaderboard.ts`. Sidebar nav entry under TRADE (Trophy icon).
