# CLAUDE.md — Blackheart Frontend

> Enterprise-grade algo trading dashboard. Design ref: Robinhood + Alpaca, elevated.

## Project overview

**Blackheart Frontend** is the web client for the Blackheart algo trading platform — a Java/Spring Boot backend (now two JVMs) running live trading + backtests on Binance. Frontend reflects that sophistication: real-time data, complex strategy management, multi-account orchestration, institutional-grade analytics.

**Target user**: a quant trader/operator running one+ Binance accounts with live strategies (LSR, VCB, VBO) and backtests, monitoring positions, P&L, equity curves in real time.

## Where to find more (read on demand — not loaded by default)

| Topic | File |
|---|---|
| Aesthetic, design tokens, type scale, app file tree | `docs/agent-context/DESIGN_SYSTEM.md` |
| Dual-client setup, module assignment, endpoint map, WS, requested endpoints | `docs/agent-context/API.md` |
| Pages 1–9 (dashboard, trades, strategies, backtest, pnl, portfolio, market, montecarlo, research) | `docs/agent-context/PAGES.md` |
| Backtest param-tuning wizard (step 2) | `docs/agent-context/BACKTEST_PARAM_TUNING.md` |
| Backtest annotated chart overlay spec | `docs/agent-context/BACKTEST_CHART_OVERLAY.md` |
| Component patterns, state mgmt, coding rules, server-side list rule, perf | `docs/agent-context/CONVENTIONS.md` |
| Backend full contract | `API_CONTRACT.md`, `SECURITY_REVIEW.md` |
| Trading JVM context (cross-repo) | `../blackheart-trading-engine/CLAUDE.md` |
| Research orchestrator (cross-repo) | `../blackheart-research-orchestrator/CLAUDE.md` |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14** (App Router) |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind v3** + **CSS Variables** |
| Components | **shadcn/ui** (Radix) |
| Charts | **TV Lightweight Charts** + **Recharts** |
| Real-time | **STOMP/WebSocket** (`@stomp/stompjs`) |
| State | **Zustand** (positions, WS, auth) |
| Server state | **TanStack Query** |
| Auth | JWT via httpOnly cookie |
| Forms | **React Hook Form** + **Zod** |
| HTTP | **Axios** w/ interceptors |
| Testing | **Vitest** + **RTL** + **Playwright** |
| Lint | **ESLint** + **Prettier** |

## Topology — two-JVM backend

- `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) — Trading JVM. Live trading, accounts, trades, P&L, portfolio, strategies, params, scheduler, server diagnostics, websocket.
- `NEXT_PUBLIC_RESEARCH_URL` (default `http://localhost:8081`) — Research JVM. `/api/v1/backtest/*`, `/api/v1/research/*`, `/api/v1/montecarlo/*`, `/api/v1/historical/*`. Falls back to `apiUrl` if unset.
- `NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws` (Trading JVM only).
- `INTERNAL_EQUITY_URL` (server-side only, default `http://localhost:8090`) — **blackheart-equity** service. Reached via a same-origin Next rewrite `/equity/:path*` → `${INTERNAL_EQUITY_URL}/api/equity/:path*` (NOT a `NEXT_PUBLIC` var; `equityClient` uses the relative `/equity` base). Powers the **Equities** section (`/equities`, `/equities/positions`): Book Authority books + per-sleeve targets (via the trading JVM `/api/portfolio-books`, live) + equity paper positions/orders (via `equityClient`). Read-only — no mutations/LIVE toggle. ⚠️Ops handoff: set `INTERNAL_EQUITY_URL=http://equity:8090` + add the `equity` compose service so the positions/orders tables populate (they render a distinct empty/"service unavailable" state until then).

`apiClient` vs `researchClient` come from a shared `createApiClient(baseURL)` factory — same auth, envelope unwrap, 401 redirect latch. Module-level redirect latch prevents storms when both clients 401 at once. See `docs/agent-context/API.md`.

## Headline rules

- **TS strict**, no `any`. Type API responses against `types/api.ts`.
- **No raw `fetch`** — always Axios client / TanStack Query wrappers.
- **No `useEffect` for data fetching** — TanStack Query.
- **No client-side pagination/sort/filter** on list-endpoint data — always server-side via query params (`page`, `size`, `sort`, filters). See `CONVENTIONS.md` and the Page-envelope guide below.
- **Dark only** in v1 (no light mode).
- **Mono numbers**: `font-mono tabular-nums` for all prices/qty/P&L.
- **STOMP singleton** in app layout; refetch on reconnect to reconcile.
- **Backtest vs Live** must be visually distinguished.
- **Strategy status**: derive from `enabled: boolean` (backend `current_status` is dead seed `"STOPPED"`).

## Shared utilities — use, don't reinvent

When writing a new API module, hook, or page, reach for these first. Inlining a re-implementation will fail review.

| Use case | Module | Helpers |
|---|---|---|
| Coerce wire numbers (Jackson BigDecimal as number-or-string) | `@/lib/api/coerce` | `toNum(v, fallback?)`, `toNumOrNull(v)` |
| Unwrap `T[] \| Page<T>` from list endpoints | `@/lib/api/pageUtils` | `extractList(data)` |
| Build query-param objects (page/size + optional filters) | `@/lib/api/queryParams` | `buildPageParams(opts, defaultSize)`, `addOptionalParam(params, key, value)` — strings are auto-trimmed; empties dropped |
| New strategy-params CRUD module (LSR/VCB/VBO-style) | `@/lib/api/paramsCrud` | `createParamsCrud<T>(basePath)` — returns `{ getDefaults, get, put, patch, remove }` |
| Strategy-params form (merge defaults + initial, diff, equality) | `@/lib/paramsFormHelpers` | `mergeParams`, `paramValuesEqual`, `computeParamsDiff` |
| Idempotency keys for orchestrator/research mutations | `@/lib/idempotency` | `generateIdempotencyKey(prefix)` |
| Debounced search input + auto page-reset for admin lists | `@/hooks/useDebouncedSearchPage` | `useDebouncedSearchPage(debounceMs?)` returns `{ searchInput, setSearchInput, debouncedSearch, page, setPage }` |

## Type system standards

- **Domain types live in `src/types/`**, not in API modules. API modules may re-export for backwards compatibility, but the canonical declaration belongs in `types/`.
  - Examples: `TradeAttribution` → `types/trading.ts`; `SymbolSlippageStats` → `types/market.ts`; `AlertSeverity`/`AlertEvent` → `types/alerts.ts`; `ErrorSeverity`/`ErrorLogRow` → `types/errors.ts`; `ResearchLogQuery`/`SweepsQuery` → `types/research.ts`.
- **`Backend*` wire types** (e.g. `BackendTrade`, `BackendPnlSummary`) stay in their API module — they are private mapper inputs, not domain shapes. If two modules need the same wire shape, give each a distinct name (e.g. `BackendBacktestEquityPoint` vs `BackendPnlEquityPoint`) rather than colliding on `BackendEquityPoint`.
- **Three page envelopes — pick the one the endpoint actually returns:**
  - `PageEnvelope<T>` (`@/types/api`) — `{ content, page, size, totalElements, totalPages }`. Used by admin lists: alerts, error-log, audit, spec-trace, support, walk-forward, strategy-definition-history. Default for new admin endpoints. Compose with `&` for extra fields (see `SupportMessagePage`).
  - `Page<T>` (`@/types/api`) — Spring Data shape: `{ content, totalElements, totalPages, number, size }`. `number` not `page`. Used by research log/sweeps and the promotion log.
  - `PageResponse<T>` (`@/types/api`) — `{ content, page, size, total }`. Used by trades and backtest, often as `T[] | PageResponse<T>` because the same endpoint emits a bare array for unfiltered queries. Pair with `extractList`.
- **No new ad-hoc page types**. If you find yourself writing `interface FooPage { content: Foo[]; page: number; size: number; totalElements: number; totalPages: number }`, alias to `PageEnvelope<Foo>` instead.

## DRY discipline

- Before adding a helper, grep `src/lib/` and `src/hooks/` for an existing one. The shared modules above replaced ~270 lines of duplication; don't re-create them under a new name.
- Three near-identical things is the threshold for extraction. Two is fine; four is overdue. Don't generify a component just because two siblings share JSX — only extract when the contract genuinely matches.
- Don't merge code that *looks* similar but serves different purposes (e.g. `AlertSeverity` vs `ErrorSeverity`, `StabilityVerdict` vs `StatisticalVerdict` — distinct concepts at distinct layers, kept separate on purpose).

## Do not

- Use `useEffect` for data fetching — use TanStack Query.
- Use `any` — type API responses explicitly.
- Display raw UNIX timestamps — format with `date-fns`.
- Use light mode colors / white backgrounds — dark-only in v1.
- Show raw backend errors to users — map to human-readable messages.
- Mutate Zustand state directly — use store actions.
- Hardcode strategy codes — load from backend; fallback labels: `LSR`, `LSR_V2`, `VCB`, `VBO`, `TREND_PULLBACK_SINGLE_EXIT`, `RAHT_V1`, `TSMOM_V1`.
- Use `<form>` HTML elements — controlled `<div>` + `onClick` patterns w/ RHF.
- Bypass auth interceptor with raw `fetch` — always go through Axios client.
- Sort, filter, paginate, or `slice()` lists client-side — always server-side. See `CONVENTIONS.md`.
- Expand `accountClient`/`researchClient` cookie sharing to absolute URLs outside the two known origins (origin-safety belt strips `withCredentials`).

## Environment variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_RESEARCH_URL=http://localhost:8081   # leave unset in single-JVM prod
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

## Development workflow

```bash
pnpm install
pnpm dev
pnpm tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

## If uncertain

- Ask whether the feature is **live** or **backtest** — they often need separate UI treatments.
- For new backend endpoints needed, document in `docs/agent-context/API.md` → "New Backend Endpoints to Request" and mock via TanStack Query `placeholderData`.
- For risky mutations (close trade, pause strategy), always show a confirmation dialog before firing.
- When unsure about data precision, match the backend — prices formatted to Binance precision.
