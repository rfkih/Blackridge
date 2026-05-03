# Backend API Integration

## Base URLs & Auth (dual-client after Phase 1 decoupling)

The Java backend now runs as **two separate JVMs** (Phase 1 decoupling, 2026-04-29):
- **Trading JVM** on `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) — live trading, accounts, trades, P&L, portfolio, strategies, params, scheduler, server diagnostics, websocket.
- **Research JVM** on `NEXT_PUBLIC_RESEARCH_URL` (default `http://localhost:8081`) — `/api/v1/backtest/*`, `/api/v1/research/*`, `/api/v1/montecarlo/*`, `/api/v1/historical/*`. Falls back to `apiUrl` in production if unset (single-JVM deploys keep working).

```typescript
// lib/api/client.ts
import { apiClient, researchClient } from '@/lib/api/client';

// Trading endpoints — apiClient
apiClient.get('/api/v1/trades');
apiClient.get('/api/v1/account-strategies');

// Research endpoints — researchClient
researchClient.post('/api/v1/backtest', payload);
researchClient.get('/api/v1/research/sweeps');
```

Both clients share identical config + interceptors via the `createApiClient(baseURL)` factory:
- Cookie auth (`withCredentials: true`) — same `blackheart-token` HttpOnly cookie works on both JVMs because they share `JWT_SECRET`.
- Backend envelope unwrap (`{responseCode, data, errorMessage}` → caller sees `data` directly).
- 401 → clear auth store + redirect to `/login`. The redirect latch is module-level so a 401 from EITHER client cannot trigger a redirect storm.
- Origin-safety belt: an absolute URL outside `apiUrl` AND `researchUrl` strips `withCredentials` to prevent cookie leakage.

## Module assignment

| API module | Client | Why |
|---|---|---|
| `accounts.ts` | apiClient | Trading-side (account CRUD, credentials) |
| `auditEvents.ts` | apiClient | Audit trail of trading actions |
| `backtest.ts` | **researchClient** | `/api/v1/backtest/*` |
| `backtest-params.ts` | apiClient | Per-account-strategy params; trading-side LSR/VCB/VBO |
| `emailVerification.ts` | apiClient | User flow |
| `equity.ts` | apiClient | Live P&L equity |
| `historical.ts` | **researchClient** | `/api/v1/historical/*` (heavy I/O, isolated) |
| `lsr-params.ts` / `vcb-params.ts` / `vbo-params.ts` | apiClient | Live strategy param services |
| `market.ts` | apiClient | Market data + indicators |
| `montecarlo.ts` | **researchClient** | `/api/v1/montecarlo/*` |
| `passwordReset.ts` | apiClient | User flow |
| `pnl.ts` | apiClient | Realized P&L queries |
| `portfolio.ts` | apiClient | Account balances |
| `research.ts` | **researchClient** | Sweeps, TPR params, log, analysis |
| `server.ts` | apiClient | IP monitor diagnostics |
| `strategies.ts` | apiClient | Account-strategy lifecycle |
| `strategy-definitions.ts` | apiClient | Admin definitions table |
| `support.ts` | apiClient | Support messages |
| `trades.ts` | apiClient | Trade history + positions |
| `users.ts` | apiClient | Login, register, profile |

## Endpoint Map (existing backend)

| Module | Endpoint | Method | Notes |
|---|---|---|---|
| Auth | `/api/v1/users/login` `/register` | POST | JWT |
| Profile | `/api/v1/users/me` | GET | — |
| Trades | `/api/v1/trades` `/:id` | GET | List + detail |
| P&L | `/api/v1/pnl` | GET | — |
| Portfolio | `/api/v1/portfolio` | GET | Balances. Optional `?accountId=` scopes to one account; omit for the "All accounts" aggregate (sum free/locked per asset, USDT recomputed once on the merged total). `usePortfolio()` reads `useActiveAccount().scopedAccountId` and forwards it. |
| Strategies | `/api/v1/account-strategies` | GET | Excludes soft-deleted |
| Strategies | `/api/v1/account-strategies/:id` | GET/DELETE | Detail / soft-delete (blocked w/ open trades) |
| Strategies | `/api/v1/account-strategies` | POST | Create |
| LSR/VCB params | `/api/v1/{lsr,vcb}-params/:id` | GET/PUT/PATCH/DELETE | CRUD + defaults |
| Backtest | `/api/v1/backtest` `/:id` | GET/POST | List/submit/result |
| Market | `/api/v1/market` | GET | Candles |
| Monte Carlo | `/api/v1/montecarlo` | POST | — |
| Scheduler | `/api/v1/scheduler` | GET/POST | — |
| Research / Sweeps | `/api/v1/research/sweeps` `/:id` `/:id/cancel` | POST/GET/DELETE | User-accessible (not admin-only) — every sweep is owned by the caller's `userId`, list/get/cancel/delete check ownership server-side. The Sweeps nav lives in the regular sidebar `NAV_ITEMS`, not under Admin. |
| Research / TPR params | `/api/v1/research/tpr/params` | GET | User-accessible read-only; sweep wizard reads it as the TPR baseline. PUT/POST mutations stay admin-only. |
| Research / Log + Analysis | `/api/v1/research/log` `/backtest/:id/analysis` | GET | Admin-only — global view + IDOR-unsafe per-run analysis. |
| Server diagnostics | `/api/v1/server/ip` `/ip/status` | GET | `/ip` calls ipify (live); `/ip/status` returns the latest persisted `ServerIpLog` row written by the IP_MONITOR scheduler. The `IpWhitelistBanner` polls `/ip/status` every 60 s and warns when `event === "CHANGED"` so users update their Binance whitelist. |
| Error inbox (admin) | `/api/v1/error-log` `/{id}` `/{id}/status` `/open-count` | GET/PATCH | Fingerprint-deduped error rows. List omits stack; detail returns full stack + redacted MDC. `PATCH /{id}/status` flips NEW/INVESTIGATING/RESOLVED/IGNORED/WONT_FIX — reopen pre-checks the partial-unique-index and 409s if a fresh open row already exists for the fingerprint. `/open-count?minSeverity=` drives the header inbox badge. |
| Spec trace (admin) | `/api/v1/spec-trace` `/{id}` | GET | V19 `spec_trace` viewer. **List requires** `backtestRunId` OR `accountStrategyId` (server rejects unscoped requests — table is hundreds of thousands of rows per backtest). List omits the heavyweight `specSnapshot`; detail returns spec snapshot + per-rule trace. |
| Spec history (admin) | `/api/v1/strategy-definition-history` `/{id}` | GET | V18 audit log of every spec mutation. Each list row carries server-provided `priorHistoryId` so the "diff vs prev" toggle works across pagination boundaries. Detail returns full `specJsonb`. Frontend diff walks objects + arrays element-wise. |

## WebSocket / STOMP

```typescript
// lib/ws/stompClient.ts
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';
client.subscribe('/topic/pnl/:accountId', (m) =>
  usePositionStore.getState().updatePnl(JSON.parse(m.body))
);
```

> Backend exposes `/ws` (public, no auth on upgrade). STOMP carries identity via JWT in CONNECT header or query param — confirm with backend.

## New Backend Endpoints to Request

| Priority | Endpoint | Purpose |
|---|---|---|
| P0 | `GET /api/v1/trades?status=OPEN&accountId=:id` | Filter trades for dashboard |
| P0 | `GET /api/v1/pnl/summary?period=today\|week\|month` | Aggregated P&L for hero |
| P0 | `GET /api/v1/backtest/:id/equity-points` | Equity curve points |
| P0 | `GET /api/v1/backtest/:id/trades` | `BacktestTrade[]` w/ nested `positions[]` — chart overlay markers |
| P0 | `GET /api/v1/backtest/:id/candles` | OHLCV for run's symbol+interval+range — annotated chart |
| P0 | `GET /api/v1/lsr-params/defaults` | Full `LsrParams.defaults()` for tuning form init |
| P0 | `GET /api/v1/vcb-params/defaults` | Full `VcbParams.defaults()` for tuning form init |
| P0 | `POST /api/v1/backtest` accepts `strategyParamOverrides` | Merge per-strategy overrides via `*Params.merge()` |
| ✅ | `POST /api/v1/account-strategies` | Create strategy |
| ✅ | `DELETE /api/v1/account-strategies/:id` | Soft-delete; blocked w/ open trades |
| P1 | `GET /api/v1/account-strategies?userId=:id` | Confirm filter param |
| P1 | `GET /api/v1/trades/:id/positions` | TradePosition legs for trade detail |
| P1 | `POST /api/v1/scheduler/{pause,resume}` | Manual pause/resume from UI |
| P1 | `GET /api/v1/backtest/:id` returns `paramSnapshot` JSONB | "Re-run with params" |
| P2 | `GET /api/v1/market/indicators?symbol&interval` | FeatureStore overlay |
| P2 | `GET /api/v1/pnl/by-strategy` | Per-strategy P&L breakdown |
| P2 | `GET /api/v1/pnl/daily?from&to` | Daily P&L bars |
| P1 | `GET /api/v1/research/sweeps?status=&sort=&page=&size=` | Server-side filter+sort+page for sweep list. Status accepts CSV (`RUNNING,PENDING`) for the in-flight scope. Without these params, `/research`'s Sweep activity panel cannot offer status pills / sort dropdown without violating the **Pagination, Sorting, Filtering — Server-Side Only** rule. |
| P1 | `GET /api/v1/research/log?strategyCode=&asset=&interval=&page=&size=` | Server-side filter+page for the research log tail. Required before `/research`'s Research log panel can re-introduce the strategy/symbol/interval filter input. |
| P1 | `GET /api/v1/strategy-definitions?query=&sort=&page=&size=` | Server-side substring filter (`query` matches strategy code or name, ILIKE) and sort (`strategyCode`, `strategyType`, `archetype`). Required before `/research`'s Promotion candidates panel can re-introduce the filter input + sortable column headers. |

> `GET /defaults` likely already exists per backend contract — confirm returns full defaults, not just diffs.
