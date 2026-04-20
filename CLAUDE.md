# CLAUDE.md — Blackheart Frontend

> Enterprise-grade algorithmic trading dashboard. Design reference: Robinhood + Alpaca Markets, elevated.  
> This file is the single source of truth for AI-assisted frontend development on this project.

---

## Project Overview

**Blackheart Frontend** is the web client for the Blackheart algorithmic trading platform — a Java/Spring Boot backend that runs live algo trading and backtests on Binance. The frontend must reflect the sophistication of the platform: real-time data, complex strategy management, multi-account orchestration, and institutional-grade trade analytics.

**Target User**: A quantitative trader / operator managing one or more Binance accounts, running live strategies (LSR, VCB, etc.) and backtests, monitoring open positions, P&L, and equity curves in real time.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR for auth pages, CSR for dashboard; file-based routing |
| Language | **TypeScript** (strict mode) | Type safety across API contracts |
| Styling | **Tailwind CSS v3** + **CSS Variables** | Utility-first with design token theming |
| Component Library | **shadcn/ui** (Radix primitives) | Accessible, unstyled base; we style on top |
| Charts | **TradingView Lightweight Charts** + **Recharts** | TV for candlestick/price; Recharts for equity curves, metrics |
| Real-time | **STOMP over WebSocket** (`@stomp/stompjs`) | Matches backend WebSocket/STOMP for live P&L streaming |
| State Management | **Zustand** | Lightweight global store for positions, strategies, WS state |
| Server State | **TanStack Query (React Query)** | Caching, polling, mutations for REST endpoints |
| Auth | **JWT in httpOnly cookie** (or `localStorage` fallback) | Matches backend Bearer token auth |
| Forms | **React Hook Form** + **Zod** | Schema validation matching backend DTOs |
| Animation | **Framer Motion** | Page transitions, data reveal animations, micro-interactions |
| Icons | **Lucide React** | Consistent icon set |
| Date/Time | **date-fns** | Lightweight, tree-shakable |
| HTTP Client | **Axios** with interceptors | Auth header injection, error normalization |
| Testing | **Vitest** + **React Testing Library** | Unit + integration |
| E2E | **Playwright** | Critical trading flows |
| Linting | **ESLint** + **Prettier** | Airbnb config base |

---

## Design System

### Aesthetic Direction

**"Dark Terminal Luxury"** — Think Bloomberg Terminal meets modern fintech. Not just dark mode — *intentionally* dark. Data-dense but never cluttered. Every number has weight. Green/red have meaning. The UI should feel like a weapon traders trust with real money.

- **Dark by default** — no light mode in v1
- **Monospaced numbers** — all prices, quantities, P&L use tabular numerals (`font-variant-numeric: tabular-nums`)
- **Tight information density** — tables, grids, panels; no wasted whitespace
- **Surgical color use** — green (`#00C896`) for profit/long/bull, red (`#FF4D6A`) for loss/short/bear, amber (`#F5A623`) for warnings/pending

### Design Tokens (CSS Variables)

```css
:root {
  /* Backgrounds */
  --bg-base: #0A0B0D;
  --bg-surface: #111318;
  --bg-elevated: #1A1D24;
  --bg-overlay: #22262F;
  --bg-hover: #2A2F3A;

  /* Borders */
  --border-subtle: #1E2230;
  --border-default: #2A2F3A;
  --border-strong: #3D4455;

  /* Semantic colors */
  --color-profit: #00C896;
  --color-loss: #FF4D6A;
  --color-warning: #F5A623;
  --color-info: #4E9EFF;
  --color-neutral: #8892A4;

  /* Text */
  --text-primary: #E8EBF0;
  --text-secondary: #8892A4;
  --text-muted: #4A5160;
  --text-inverse: #0A0B0D;

  /* Brand accent */
  --accent-primary: #4E9EFF;
  --accent-glow: rgba(78, 158, 255, 0.15);

  /* Typography */
  --font-display: 'DM Mono', monospace;      /* Headers, prices */
  --font-body: 'Inter', sans-serif;          /* Body text, labels */
  --font-mono: 'JetBrains Mono', monospace;  /* Code, logs */

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-panel: 0 0 0 1px var(--border-subtle), 0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-profit: 0 0 12px rgba(0, 200, 150, 0.2);
  --shadow-glow-loss: 0 0 12px rgba(255, 77, 106, 0.2);
}
```

### Typography Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display-xl` | DM Mono | 2.5rem | 600 | Page hero numbers (total P&L) |
| `display-lg` | DM Mono | 1.75rem | 500 | Panel headers |
| `heading` | Inter | 1rem | 600 | Section headers |
| `body` | Inter | 0.875rem | 400 | Default body |
| `caption` | Inter | 0.75rem | 400 | Labels, metadata |
| `mono` | JetBrains Mono | 0.875rem | 400 | Prices, quantities, logs |

---

## Application Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar + top nav shell
│   │   ├── page.tsx              # Dashboard overview
│   │   ├── trades/
│   │   │   ├── page.tsx          # Trade list
│   │   │   └── [id]/page.tsx     # Trade detail
│   │   ├── strategies/
│   │   │   ├── page.tsx          # Strategy overview
│   │   │   └── [accountStrategyId]/
│   │   │       ├── page.tsx      # Strategy detail + params
│   │   │       └── params/page.tsx
│   │   ├── backtest/
│   │   │   ├── page.tsx               # Backtest list
│   │   │   ├── new/
│   │   │   │   ├── page.tsx           # Step 1 — Backtest config (symbol, dates, capital, strategy)
│   │   │   │   └── params/page.tsx    # Step 2 — Strategy param tuning before run
│   │   │   └── [id]/page.tsx          # Backtest results
│   │   ├── portfolio/page.tsx    # Portfolio balances
│   │   ├── market/page.tsx       # Market data / candles
│   │   ├── pnl/page.tsx          # P&L analytics
│   │   └── montecarlo/page.tsx   # Monte Carlo simulation
│   └── api/                      # Next.js API routes (proxy if needed)
│
├── components/
│   ├── ui/                       # shadcn/ui base components (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopNav.tsx
│   │   ├── CommandPalette.tsx     # ⌘K global search
│   │   └── NotificationPanel.tsx
│   ├── charts/
│   │   ├── CandlestickChart.tsx  # TradingView Lightweight Charts
│   │   ├── EquityCurve.tsx       # Recharts line chart
│   │   ├── PnlBarChart.tsx
│   │   ├── DrawdownChart.tsx
│   │   └── MonteCarloChart.tsx
│   ├── trading/
│   │   ├── OpenPositionsPanel.tsx
│   │   ├── TradeCard.tsx
│   │   ├── TradePositionRow.tsx  # TP1 / TP2 / RUNNER legs
│   │   ├── LivePnlTicker.tsx     # Real-time WebSocket P&L
│   │   └── StrategyBadge.tsx
│   ├── backtest/
│   │   ├── BacktestConfigForm.tsx         # Step 1 form — symbol, dates, capital, strategies
│   │   ├── BacktestParamTuner.tsx         # Step 2 — param editing shell (tabs per strategy)
│   │   ├── BacktestParamDiffBadge.tsx     # Shows "N overrides" vs defaults
│   │   ├── BacktestParamPresetBar.tsx     # Load / save named presets
│   │   ├── BacktestResultCard.tsx
│   │   ├── BacktestMetricsGrid.tsx
│   │   └── BacktestEquityPanel.tsx
│   ├── strategy/
│   │   ├── LsrParamsForm.tsx
│   │   ├── VcbParamsForm.tsx
│   │   ├── StrategyStatusBadge.tsx
│   │   ├── NewStrategyDialog.tsx       # Create a new AccountStrategy
│   │   └── DeleteStrategyDialog.tsx    # Soft-delete confirmation
│   └── shared/
│       ├── PnlCell.tsx           # Green/red formatted P&L
│       ├── PriceCell.tsx         # Monospaced price display
│       ├── StatusIndicator.tsx   # Live/offline dot
│       ├── DataTable.tsx         # Reusable sortable/filterable table
│       ├── StatCard.tsx          # Metric card (Sharpe, WR, etc.)
│       └── EmptyState.tsx
│
├── hooks/
│   ├── useWebSocket.ts           # STOMP connection manager
│   ├── useLivePnl.ts             # Subscribe to live P&L stream
│   ├── useTrades.ts              # TanStack Query: trades
│   ├── useBacktest.ts            # TanStack Query: backtest CRUD
│   ├── useStrategies.ts          # TanStack Query: strategies + create/delete mutations
│   └── useAuth.ts                # JWT auth state
│
├── lib/
│   ├── api/
│   │   ├── client.ts             # Axios instance with auth interceptor
│   │   ├── trades.ts             # Trade API functions
│   │   ├── backtest.ts           # Backtest API functions
│   │   ├── backtest-params.ts    # Param defaults + preset CRUD
│   │   ├── strategies.ts         # Strategy API functions
│   │   ├── portfolio.ts          # Portfolio API functions
│   │   ├── pnl.ts                # P&L API functions
│   │   ├── market.ts             # Market data API functions
│   │   └── lsr-params.ts         # LSR/VCB param API functions
│   ├── ws/
│   │   └── stompClient.ts        # Singleton STOMP client
│   ├── formatters.ts             # Price, % , P&L formatters
│   ├── constants.ts              # API base URL, WS URL, intervals
│   └── utils.ts
│
├── store/
│   ├── authStore.ts              # Zustand: JWT, user info
│   ├── positionStore.ts          # Zustand: open positions from WS
│   ├── backtestParamStore.ts     # Zustand: ephemeral param overrides during backtest wizard
│   └── wsStore.ts                # Zustand: WS connection status
│
└── types/
    ├── api.ts                    # API request/response types (match backend DTOs)
    ├── trading.ts                # Trade, TradePosition, Trades types
    ├── strategy.ts               # AccountStrategy, LsrParams, VcbParams
    ├── backtest.ts               # BacktestRun, BacktestTrade, BacktestMetrics
    └── market.ts                 # MarketData, FeatureStore types
```

---

## Backend API Integration

### Base URL & Auth

```typescript
// lib/api/client.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Endpoint Map (matches existing backend)

| Frontend Module | Backend Endpoint | Method | Notes |
|---|---|---|---|
| Auth | `POST /api/v1/users/login` | POST | Returns JWT |
| Auth | `POST /api/v1/users/register` | POST | — |
| Profile | `GET /api/v1/users/me` | GET | — |
| Trades | `GET /api/v1/trades` | GET | List trades |
| Trades | `GET /api/v1/trades/:id` | GET | Trade detail |
| P&L | `GET /api/v1/pnl` | GET | P&L queries |
| Portfolio | `GET /api/v1/portfolio` | GET | Balances |
| Strategies | `GET /api/v1/account-strategies` | GET | User strategies (excludes soft-deleted) |
| Strategies | `GET /api/v1/account-strategies/:id` | GET | Single strategy detail |
| Strategies | `POST /api/v1/account-strategies` | POST | Create new strategy on an account |
| Strategies | `DELETE /api/v1/account-strategies/:id` | DELETE | Soft-delete (blocked if open trades exist) |
| LSR Params | `GET/PUT/PATCH/DELETE /api/v1/lsr-params/:id` | * | CRUD + defaults |
| VCB Params | `GET/PUT/PATCH/DELETE /api/v1/vcb-params/:id` | * | CRUD + defaults |
| Backtest | `POST /api/v1/backtest` | POST | Submit backtest |
| Backtest | `GET /api/v1/backtest` | GET | List runs |
| Backtest | `GET /api/v1/backtest/:id` | GET | Run result |
| Market | `GET /api/v1/market` | GET | Candle data |
| Monte Carlo | `POST /api/v1/montecarlo` | POST | Run simulation |
| Scheduler | `GET/POST /api/v1/scheduler` | * | Manage scheduler |

### WebSocket / STOMP (Live P&L)

```typescript
// lib/ws/stompClient.ts
import { Client } from '@stomp/stompjs';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';

// Subscribe to live P&L
client.subscribe('/topic/pnl/:accountId', (message) => {
  const pnl = JSON.parse(message.body);
  usePositionStore.getState().updatePnl(pnl);
});
```

> **Note**: Backend exposes `/ws` as the WebSocket endpoint (public, no auth header on upgrade). STOMP frames carry identity via the JWT in a CONNECT header or query param — confirm with backend.

---

## Key Pages & Features

### 1. Dashboard (/)

**Hero metrics row**: Total Unrealized P&L, Today's Realized P&L, Open Positions count, Win Rate (30d).  
**Open Positions panel**: Live-updating table of open trades with real-time P&L via WebSocket.  
**Recent Trades**: Last 10 closed trades with P&L color coding.  
**Strategy Status**: Cards per active `AccountStrategy` showing Live/Paused, last signal, last trade.

### 2. Trades (/trades)

Full sortable/filterable trade table. Columns: Symbol, Strategy, Direction (LONG/SHORT badge), Entry Price, Exit Price, Realized P&L, Duration, Status, Actions.  
Click → Trade Detail: shows all `TradePosition` legs (SINGLE / TP1 / TP2 / RUNNER), entry/exit prices per leg, fees, net P&L.

### 3. Strategies (/strategies)

One card per `AccountStrategy`. Shows: strategy code badge (LSR/VCB/etc.), interval, capital allocated, allow-long/short flags, priority order, current status.  
Click → Strategy Detail: view and edit `LsrParams` or `VcbParams` with a live form. Show param defaults alongside current values. PUT/PATCH on save.

**Create / delete**
- **"New Strategy" button** in the page header opens `NewStrategyDialog` → `POST /api/v1/account-strategies`. Disabled when the user has no active accounts.
- **Trash icon** on each card (visible on hover) opens `DeleteStrategyDialog` → `DELETE /api/v1/account-strategies/:id`. The backend soft-deletes: the row is flagged `is_deleted=true`, `enabled=false`, `deleted_at=now()`; historical trades and P&L continue to resolve the strategy via the preserved row.
- **Delete is blocked server-side** if the strategy has `OPEN` / `PARTIALLY_CLOSED` trades. The error message (`"Cannot delete strategy with N open trade(s)…"`) flows through `normalizeError` and renders inline in the confirmation dialog — do not hide or remap it.

**Status field derivation (important)**
The backend's `current_status` DB column is **not maintained** — every row holds the seed value `"STOPPED"`. Treat it as dead. The real liveness flag is the `enabled: boolean` field on `BackendAccountStrategy`. `mapAccountStrategy` in `src/lib/api/strategies.ts` derives `status` as `enabled ? 'LIVE' : 'STOPPED'`. `PAUSED` is unreachable on the live path until the backend models it explicitly.

### 4. Backtest (/backtest)

**Run list** (`/backtest`): Table of past runs with status (PENDING / RUNNING / COMPLETE / FAILED), strategy, date range, total return %, Sharpe, max drawdown. "New Backtest" CTA → wizard step 1.

**Step 1 — Config** (`/backtest/new`): Symbol, interval, date range, initial capital, strategy code multi-select, `accountStrategyId` per strategy. "Next: Configure Params →" advances to step 2 (state persisted in `backtestParamStore`).

**Step 2 — Param Tuning** (`/backtest/new/params`): Strategy parameter editor — see full spec in **Backtest Param Tuning Page** section below. "Run Backtest" submits `POST /api/v1/backtest` with merged config + param overrides → redirects to result page.

**Run detail** (`/backtest/[id]`): Equity curve chart, drawdown chart, metrics grid (Win Rate, Profit Factor, Avg Win/Loss, Max Drawdown, Sharpe, Sortino, Total Trades), trade list + **annotated candlestick chart** (see section below). "Re-run with params →" pre-fills the wizard with this run's param snapshot.

### 5. P&L Analytics (/pnl)

Daily/Weekly/Monthly P&L bar charts. Cumulative P&L line. Per-strategy breakdown. Filter by date range, strategy, symbol.

### 6. Portfolio (/portfolio)

Account balances table. Available vs locked funds. Per-asset breakdown.

### 7. Market (/market)

TradingView Lightweight Charts candlestick for any symbol/interval. Overlay FeatureStore indicators (EMA, BB, KC) where the backend exposes them.

### 8. Monte Carlo (/montecarlo)

Submit simulation parameters → display distribution of outcomes as a fan chart (percentile bands).

---

## Backtest Param Tuning Page (`/backtest/new/params`)

This page is **Step 2 of the backtest creation wizard**. It lets the user configure strategy parameters before the run is submitted — without touching their live account params.

### Design Philosophy

- **Non-destructive by default**: edits here are ephemeral and scoped to this backtest run only. They do not write to `lsr_strategy_param` / `vcb_strategy_param` live tables unless the user explicitly clicks "Save as Live Params".
- **Defaults-first**: the form initializes from the backend's `GET /defaults` endpoint for each strategy. Changed values are shown with a visual diff indicator.
- **Fast iteration loop**: the user should be able to tweak → run → see results → come back and tweak again. The "Re-run with same params" shortcut on the result page feeds back into this page pre-filled.

### Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Config    [Wizard breadcrumb: Config → Params → Run]  │
├──────────────────────────────────────────────────────────────────┤
│  RUN SUMMARY BAR (read-only)                                     │
│  BTCUSDT  •  1h  •  2024-01-01 → 2024-06-30  •  $10,000         │
├──────────────────────────────────────────────────────────────────┤
│  PRESET BAR                                                      │
│  [Load preset ▾]  [Save current as preset…]  [Reset to defaults] │
├──────────────────────────────────────────────────────────────────┤
│  STRATEGY TABS  (one tab per selected strategy)                  │
│  [ LSR_V2 · 3 overrides ]  [ VCB · defaults ]                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PARAM FORM  (active tab's strategy)                             │
│                                                                  │
│  ┌─ Entry Conditions ──────────────────────────────────────┐    │
│  │  adxThreshold         [  25  ]  ← default: 25           │    │
│  │  rsiOverbought        [  70  ]  ← modified ●            │    │
│  │  ...                                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌─ Exit & Risk ───────────────────────────────────────────┐    │
│  │  stopLossAtr          [ 1.5  ]  ← default: 2.0  ●       │    │
│  │  tp1RMultiple         [ 1.0  ]  ← default: 1.0           │    │
│  │  ...                                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Save as Live Params]              [Run Backtest →]             │
└──────────────────────────────────────────────────────────────────┘
```

### Wizard State (`backtestParamStore`)

The wizard state bridges step 1 → step 2 → submission. Never persisted to the backend until "Run Backtest" is clicked.

```typescript
// store/backtestParamStore.ts
interface BacktestWizardState {
  // Step 1 config (carried forward from /backtest/new)
  config: {
    symbol: string;
    interval: string;
    fromDate: string;        // ISO date
    toDate: string;
    initialCapital: number;
    strategyCodes: string[]; // e.g. ['LSR_V2', 'VCB']
    strategyAccountStrategyIds: Record<string, string>; // strategyCode → accountStrategyId UUID
  } | null;

  // Step 2 — per-strategy param overrides (only non-default values)
  // key: strategyCode ('LSR_V2' | 'VCB' | etc.)
  paramOverrides: Record<string, Record<string, unknown>>;

  // Loaded preset name (if any), for display only
  activePresetName: string | null;

  // Actions
  setConfig: (config: BacktestWizardState['config']) => void;
  setParamOverride: (strategyCode: string, key: string, value: unknown) => void;
  resetParamOverrides: (strategyCode: string) => void;
  resetAll: () => void;
  loadPreset: (preset: BacktestParamPreset) => void;
}
```

### Component: `BacktestParamTuner`

**File**: `components/backtest/BacktestParamTuner.tsx`

The shell component for step 2. Renders:
1. **Run summary bar** — read-only display of step 1 config (symbol, interval, dates, capital).
2. **Preset bar** — load/save/reset controls (see below).
3. **Strategy tabs** — one tab per `strategyCode` in `config.strategyCodes`. Tab label shows strategy code + override count badge (e.g. `LSR_V2 · 3`).
4. **Active param form** — `LsrParamForm` or `VcbParamForm` (or a generic `UnknownStrategyParamForm` fallback) for the selected tab.
5. **Footer actions** — "Save as Live Params" (secondary) + "Run Backtest →" (primary CTA).

```typescript
interface BacktestParamTunerProps {
  // All data comes from backtestParamStore; no props needed
  // except the onSubmit callback
  onSubmit: (payload: BacktestRunPayload) => void;
  isSubmitting: boolean;
}
```

### Param Forms per Strategy

These forms are **reused** from the live param editing feature but rendered in **backtest mode** — same fields, same validation, but:
- Initial values come from `GET /api/v1/lsr-params/defaults` (or VCB equivalent), merged with any existing `paramOverrides` in the store.
- On field change: call `setParamOverride(strategyCode, fieldKey, value)` — do NOT call the API.
- Fields at default value: render normally.
- Fields overriding default: show a `●` amber dot beside the field + the default value as ghost text below.

```typescript
// components/strategy/LsrParamForm.tsx  (shared between live edit + backtest tuner)
interface LsrParamFormProps {
  mode: 'live' | 'backtest';         // controls whether onChange writes to API or store
  accountStrategyId?: string;         // required in 'live' mode; unused in 'backtest'
  strategyCode?: string;              // required in 'backtest' mode for store key
  initialValues: Partial<LsrParams>;
  defaultValues: LsrParams;           // always provided; used to compute diff
  onChange?: (key: string, value: unknown) => void;  // 'backtest' mode callback
}
```

#### LSR Param Field Groups

Organize fields into collapsible sections matching their logical role. Collapsed by default except the first:

| Section | Fields |
|---|---|
| **Entry Conditions** | `adxThreshold`, `rsiOverbought`, `rsiOversold`, `adxPeriod`, `rsiPeriod` |
| **Volatility Filters** | `useErFilter`, `erThreshold`, `erPeriod`, `useRelVolFilter`, `relVolThreshold` |
| **Exit & Risk** | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner`, `runnerActivationR` |
| **Position Sizing** | `riskPercentage`, `maxPositionSizeUsdt` |
| **Direction** | `allowLong`, `allowShort` (read-only — inherited from `AccountStrategy`; shown for reference) |

#### VCB Param Field Groups

| Section | Fields |
|---|---|
| **Compression Detection** | `compressionLookback`, `compressionBbWidth`, `compressionKcWidth`, `useKcFilter` |
| **Breakout Filters** | `minBreakoutAtr`, `maxBreakoutAtr`, `volumeMultiplier`, `useVolumeFilter` |
| **Exit & Risk** | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner` |
| **Position Sizing** | `riskPercentage`, `maxPositionSizeUsdt` |

> **Note**: Exact field names must match `LsrParams` / `VcbParams` Java classes. Confirm with backend team if fields differ.

#### Field Renderers

Map param types to input components:

| Type | Component | Notes |
|---|---|---|
| `number` (decimal) | `<NumericInput step={0.1} />` | Monospaced, right-aligned value |
| `number` (integer) | `<NumericInput step={1} />` | Same, no decimal |
| `boolean` | `<Toggle />` | shadcn Switch component |
| `number` (percentage) | `<SliderInput min={0} max={100} step={0.5} />` + numeric display | Show as `%` |
| `number` (R-multiple) | `<SliderInput min={0.5} max={5} step={0.25} />` | Show as `×` |

Each field shows:
- Label (human-readable, not camelCase)
- Input control
- Default value ghost text: `default: 25` in `var(--text-muted)` color
- `●` amber dot if overridden
- Optional tooltip icon with field description

### Default Diff Indicator (`BacktestParamDiffBadge`)

Shown on each strategy tab and in the section headers:

```typescript
// components/backtest/BacktestParamDiffBadge.tsx
interface BacktestParamDiffBadgeProps {
  overrideCount: number;  // number of fields that differ from defaults
}
// Renders: "3 overrides" in amber if > 0, "defaults" in muted if 0
```

### Preset System (`BacktestParamPresetBar`)

Presets are **named snapshots** of `paramOverrides` saved to `localStorage` (client-side only in v1 — no backend required). Key: `blackheart:backtest-presets`.

```typescript
interface BacktestParamPreset {
  id: string;               // nanoid
  name: string;             // user-defined
  strategyCode: string;     // 'LSR_V2' | 'VCB' | etc.
  overrides: Record<string, unknown>;
  createdAt: string;        // ISO
}
```

**Preset bar controls:**

| Control | Behavior |
|---|---|
| `[Load preset ▾]` | Dropdown of saved presets filtered by current strategy tab. Selecting one merges its `overrides` into the store for that strategy. |
| `[Save current as preset…]` | Opens a small popover with a name input → saves current overrides as a new preset. |
| `[Reset to defaults]` | Calls `resetParamOverrides(activeStrategyCode)` — clears all overrides for this tab. Confirm dialog if overrides exist. |

### Submission: Building the Payload

When "Run Backtest →" is clicked, merge wizard state into the `BacktestRunPayload`:

```typescript
// lib/backtest/buildBacktestPayload.ts
export function buildBacktestPayload(
  config: WizardConfig,
  paramOverrides: Record<string, Record<string, unknown>>,
  defaultParams: Record<string, Record<string, unknown>>
): BacktestRunPayload {
  return {
    symbol: config.symbol,
    interval: config.interval,
    fromDate: config.fromDate,
    toDate: config.toDate,
    initialCapital: config.initialCapital,
    strategyCode: config.strategyCodes.join(','),
    strategyAccountStrategyIds: config.strategyAccountStrategyIds,
    // Per-strategy param overrides — only send keys that differ from defaults
    // Backend merges these on top of its own defaults via LsrParams.merge() / VcbParams.merge()
    strategyParamOverrides: Object.fromEntries(
      config.strategyCodes.map((code) => [
        code,
        computeDiff(defaultParams[code], paramOverrides[code] ?? {}),
      ])
    ),
  };
}

// Only include keys where override !== default (avoids bloating the payload)
function computeDiff(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([k, v]) => v !== defaults[k])
  );
}
```

### "Re-run with Params" — Result Page Integration

On the backtest result page (`/backtest/[id]`), add a **"Re-run with these params"** button in the header. It:
1. Reads the `BacktestRun`'s stored `strategyAccountStrategyIds` + whatever param snapshot is available.
2. Pre-fills `backtestParamStore.config` and `paramOverrides` from the run's stored data.
3. Navigates to `/backtest/new` (step 1) — user can adjust config then proceed to step 2 with params pre-loaded.

> **Backend note**: For "Re-run with params" to work, the backend must persist param overrides alongside the `BacktestRun` record. Request: add a `paramSnapshot` JSONB column to `BacktestRun` that stores the exact `strategyParamOverrides` map used for that run.

### New Backend Endpoints Required (Param Tuning)

Add to the **"New Backend Endpoints to Request"** table:

| Priority | Endpoint | Purpose |
|---|---|---|
| P0 | `GET /api/v1/lsr-params/defaults` | Fetch `LsrParams.defaults()` as JSON for form initialization |
| P0 | `GET /api/v1/vcb-params/defaults` | Fetch `VcbParams.defaults()` as JSON for form initialization |
| P0 | `POST /api/v1/backtest` accepts `strategyParamOverrides` field | Backend must accept + merge per-strategy param overrides into the run |
| P1 | `GET /api/v1/backtest/:id` returns `paramSnapshot` | Stored override map for "Re-run with params" feature |

> The `GET /defaults` endpoints likely already exist per the CLAUDE.md backend API contract (`GET /api/v1/lsr-params/defaults`). Confirm they return the full default object, not just changed fields.

### UX Rules for Param Tuning Page

- **Never auto-submit** — param changes are always explicit. No debounced API calls on this page.
- **"Run Backtest" is the only write action** — all intermediate state is local.
- **Show field descriptions** — each param should have a `?` tooltip explaining what it controls, especially thresholds and multipliers. Populate from a static `paramMeta` map in `lib/constants.ts`.
- **Validation before submission**: all params must pass Zod schema. Block submission and highlight invalid fields with the same error treatment as live param forms.
- **Section collapse state** is per-session (sessionStorage) — remembers which sections were open, resets on page reload.
- **Keyboard shortcut**: `Cmd/Ctrl + Enter` triggers "Run Backtest →" when the form is valid.
- **Dirty state warning**: if the user navigates away with unsaved overrides (Back to Config or browser back), show a `beforeunload` confirmation.
- **"Save as Live Params" confirmation**: this is a destructive write to the live strategy params — always show a confirmation dialog: *"This will overwrite the live params for [strategy] on account [X]. Backtests will use the same params going forward."*

---

## Backtest Trade Execution Chart Overlay

This is a first-class feature of the backtest result page. Every executed trade must be visible directly on the candlestick chart so the user can perform visual trade-by-trade analysis.

### Layout

The backtest result page (`/backtest/[id]`) uses a **split layout**:

```
┌─────────────────────────────────────────────────────┐
│  METRICS GRID (Win Rate, Sharpe, MDD, etc.)         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ANNOTATED CANDLESTICK CHART          [tall panel]  │
│  (TradingView Lightweight Charts)                   │
│  - Trade entry/exit markers on candles              │
│  - SL / TP horizontal lines per trade               │
│  - Highlighted candle range per selected trade      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  EQUITY CURVE          │  DRAWDOWN CHART            │
├─────────────────────────────────────────────────────┤
│  TRADE LIST TABLE (synchronized with chart above)   │
└─────────────────────────────────────────────────────┘
```

### Chart Marker System

Use TradingView Lightweight Charts' `ISeriesApi.setMarkers()` to place markers on the candlestick series.

#### Marker Types

| Event | Shape | Color | Position | Label |
|---|---|---|---|---|
| LONG entry | `arrowUp` | `#00C896` (profit green) | `belowBar` | `L` |
| SHORT entry | `arrowDown` | `#FF4D6A` (loss red) | `aboveBar` | `S` |
| TP1 hit | `circle` | `#00C896` | `aboveBar` (long) / `belowBar` (short) | `T1` |
| TP2 hit | `circle` | `#00C896` brighter | same as TP1 | `T2` |
| RUNNER close | `circle` | `#4E9EFF` (info blue) | same as TP | `R` |
| Stop loss hit | `circle` | `#FF4D6A` | opposite of entry | `SL` |
| Partial close | `circle` | `#F5A623` (amber) | above/below bar | `P` |

Each marker carries a `id` (the `backtestTradeId`) in its `tooltip` field so click events can resolve back to the trade row.

#### Trade Range Highlight

When a trade spans multiple candles, render a **background highlight band** using a `ISeriesApi` histogram series with near-zero opacity overlaid at the chart's min/max price range, covering the candle range from entry time → final exit time. Color: green-tint for long, red-tint for short.

```typescript
// Conceptual — use a separate histogram or custom primitive
const highlightSeries = chart.addHistogramSeries({
  color: trade.direction === 'LONG'
    ? 'rgba(0, 200, 150, 0.06)'
    : 'rgba(255, 77, 106, 0.06)',
  priceFormat: { type: 'volume' },
  priceScaleId: '',  // overlay scale
});
```

#### SL / TP Price Lines

For the **selected/hovered trade**, draw horizontal price lines using `series.createPriceLine()`:

```typescript
// Draw these only for the active selected trade
const slLine = candleSeries.createPriceLine({
  price: trade.stopLossPrice,
  color: '#FF4D6A',
  lineWidth: 1,
  lineStyle: LineStyle.Dashed,
  axisLabelVisible: true,
  title: 'SL',
});

const tp1Line = candleSeries.createPriceLine({
  price: trade.tp1Price,
  color: '#00C896',
  lineWidth: 1,
  lineStyle: LineStyle.Dashed,
  axisLabelVisible: true,
  title: 'TP1',
});
// Repeat for TP2, RUNNER trailing stop if applicable
```

Remove and re-draw price lines whenever selected trade changes. Store refs to remove them: `series.removePriceLine(ref)`.

### Bidirectional Synchronization (Chart ↔ Trade Table)

This is the core interaction model — clicking in either panel must update the other.

#### Chart → Table
```typescript
chart.subscribeClick((param) => {
  if (!param.time) return;
  // Find marker at this time
  const clickedMarker = markers.find(m => m.time === param.time);
  if (clickedMarker?.id) {
    setSelectedTradeId(clickedMarker.id);
    // Scroll trade table row into view
    tableRowRefs[clickedMarker.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
```

#### Table → Chart
```typescript
// On table row click
const handleTradeRowClick = (trade: BacktestTrade) => {
  setSelectedTradeId(trade.id);
  // Scroll chart to the trade's entry candle
  chart.timeScale().scrollToPosition(
    chart.timeScale().coordinateToLogical(
      chart.timeScale().timeToCoordinate(trade.entryTime / 1000) ?? 0
    ) - 10,  // offset left for context
    false
  );
};
```

Selected trade row: highlight with `bg-[var(--bg-hover)] border-l-2 border-[var(--accent-primary)]`.

### Component: `BacktestAnnotatedChart`

**File**: `components/backtest/BacktestAnnotatedChart.tsx`

**Props**:
```typescript
interface BacktestAnnotatedChartProps {
  backtestRunId: string;
  candles: MarketData[];              // OHLCV from backend
  trades: BacktestTrade[];            // All trades in this run
  positions: BacktestTradePosition[]; // All position legs (TP1/TP2/RUNNER)
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
}
```

**Internal logic**:
1. On mount: create chart, add candlestick series, set candle data.
2. `useMemo`: compute `SeriesMarker[]` array from all trades + positions. Sort by time (required by TV).
3. `useEffect([trades, positions])`: call `series.setMarkers(markers)`.
4. `useEffect([selectedTradeId])`: remove old price lines, draw new SL/TP lines for selected trade.
5. `useEffect([selectedTradeId])`: remove old highlight band, draw new range highlight.
6. On unmount: `chart.remove()`.

**Performance**: `trades` arrays in backtests can be hundreds of entries → memoize marker computation. Do not recompute markers on every render.

### Component: `BacktestTradeTable`

**File**: `components/backtest/BacktestTradeTable.tsx`

Standard `DataTable` with these additional behaviors:
- Row ref map: `rowRefs = useRef<Record<string, HTMLTableRowElement>>({})` — used by chart click to scroll.
- Selected row: visual highlight (left accent border + bg).
- Columns: `#`, Direction badge, Entry Time, Entry Price, Exit Time, Exit Price, SL, TP1, TP2, Legs hit (TP1✓ TP2✓ RUNNER✓), P&L, R-multiple, Duration.
- **Legs hit indicators**: small colored dots showing which legs closed at profit vs stop.

### Data Requirements from Backend

The following is needed to power the overlay. Add to the **"New Backend Endpoints to Request"** table:

| Priority | Endpoint | Response | Purpose |
|---|---|---|---|
| P0 | `GET /api/v1/backtest/:id/trades` | `BacktestTrade[]` with nested `positions: BacktestTradePosition[]` | All trade + leg data for overlay markers |
| P0 | `GET /api/v1/backtest/:id/candles` | `MarketData[]` (OHLCV for the run's symbol+interval+dateRange) | Candle data for the chart |

If nesting positions inside the trade response is not feasible, an alternative is:  
`GET /api/v1/backtest/:id/trades/:tradeId/positions` — but the nested response is strongly preferred to avoid N+1 fetching on the frontend.

**Required fields on `BacktestTrade`** for the overlay to work:

```typescript
interface BacktestTrade {
  id: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;          // epoch ms
  entryPrice: number;
  exitTime: number | null;    // null if still open at backtest end
  exitPrice: number | null;
  stopLossPrice: number;
  tp1Price: number | null;
  tp2Price: number | null;
  realizedPnl: number;
  positions: BacktestTradePosition[];
}

interface BacktestTradePosition {
  id: string;
  type: 'SINGLE' | 'TP1' | 'TP2' | 'RUNNER';
  exitTime: number | null;
  exitPrice: number | null;
  exitReason: 'TP_HIT' | 'SL_HIT' | 'RUNNER_CLOSE' | 'BACKTEST_END' | null;
  realizedPnl: number;
}
```

If `stopLossPrice`, `tp1Price`, `tp2Price` are not currently on `BacktestTrade`, request these as additions to the persistence layer.

### Marker Computation Logic

```typescript
// lib/backtest/buildTradeMarkers.ts
export function buildTradeMarkers(
  trades: BacktestTrade[]
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];

  for (const trade of trades) {
    const isLong = trade.direction === 'LONG';

    // Entry marker
    markers.push({
      time: (trade.entryTime / 1000) as Time,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#00C896' : '#FF4D6A',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: isLong ? 'L' : 'S',
      id: trade.id,
    });

    // Per-leg exit markers
    for (const pos of trade.positions) {
      if (!pos.exitTime || !pos.exitReason) continue;

      const markerConfig = LEG_MARKER_CONFIG[pos.type]?.[pos.exitReason];
      if (!markerConfig) continue;

      markers.push({
        time: (pos.exitTime / 1000) as Time,
        position: isLong ? 'aboveBar' : 'belowBar',
        color: markerConfig.color,
        shape: 'circle',
        text: markerConfig.label,
        id: trade.id,  // link back to parent trade
      });
    }
  }

  // TV requires markers sorted by time ascending
  return markers.sort((a, b) => (a.time as number) - (b.time as number));
}

const LEG_MARKER_CONFIG: Record<
  BacktestTradePosition['type'],
  Partial<Record<BacktestTradePosition['exitReason'], { color: string; label: string }>>
> = {
  SINGLE: {
    TP_HIT:        { color: '#00C896', label: 'TP' },
    SL_HIT:        { color: '#FF4D6A', label: 'SL' },
    BACKTEST_END:  { color: '#8892A4', label: 'E'  },
  },
  TP1: {
    TP_HIT:        { color: '#00C896', label: 'T1' },
    SL_HIT:        { color: '#FF4D6A', label: 'SL' },
  },
  TP2: {
    TP_HIT:        { color: '#00E5B0', label: 'T2' },
    SL_HIT:        { color: '#FF4D6A', label: 'SL' },
  },
  RUNNER: {
    RUNNER_CLOSE:  { color: '#4E9EFF', label: 'R'  },
    SL_HIT:        { color: '#FF4D6A', label: 'SL' },
    BACKTEST_END:  { color: '#8892A4', label: 'E'  },
  },
};
```

### Tooltip on Marker Hover

TradingView Lightweight Charts does not provide a native hover tooltip on markers. Implement a custom floating tooltip:

```typescript
chart.subscribeCrosshairMove((param) => {
  if (!param.point || !param.time) {
    setHoveredMarker(null);
    return;
  }
  const marker = markers.find(m => m.time === param.time);
  if (marker) {
    setHoveredMarker({
      tradeId: marker.id,
      x: param.point.x,
      y: param.point.y,
    });
  }
});
```

Render a `<TradeMarkerTooltip>` absolutely positioned inside the chart container. Show: Direction, Entry → Exit price, P&L, legs hit.

### UX Rules for Trade Chart Overlay

- **Markers are always visible** — do not hide them behind a toggle in v1. Density is a feature, not a bug.
- **Clicking empty chart space** deselects the active trade (clears price lines and highlight band).
- **Multiple trades on same candle**: TV stacks markers — this is acceptable; the tooltip resolves the correct trade.
- **Zoom behavior**: markers follow the candle they're pinned to — no special handling needed, TV manages this.
- **Time zone**: backend timestamps are epoch ms in UTC — divide by 1000 for TV's `UTCTimestamp`. The TV chart must be configured with `localization: { timeFormatter }` matching the user's local TZ or UTC explicitly.
- **Do not** try to draw custom canvas overlays on top of TV — use only the official `setMarkers` and `createPriceLine` APIs to stay compatible with TV's internal rendering pipeline.
- **Long backtest runs** (1000+ candles, 200+ trades) must not cause janky rendering — memoize `buildTradeMarkers`, call `setMarkers` only when trade data changes (not on every chart interaction).

---

## Component Patterns

### PnlCell
```tsx
// Always monospaced, always color-coded
const PnlCell = ({ value }: { value: number }) => (
  <span
    className="font-mono tabular-nums text-sm"
    style={{ color: value >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
  >
    {value >= 0 ? '+' : ''}{value.toFixed(2)} USDT
  </span>
);
```

### LivePnlTicker
Subscribe to STOMP topic on mount; unsubscribe on unmount. Animate number changes with Framer Motion `AnimatePresence` for flash-green / flash-red transitions.

### DataTable
Built on TanStack Table v8. Features: column sorting, column visibility toggle, pagination, row selection, search/filter. Virtualized for large datasets (react-virtual).

### BacktestForm
Multi-strategy support: `strategyCode` is a comma-separated multi-select (e.g. `LSR_V2,VCB`). `strategyAccountStrategyIds` is a dynamic key-value builder mapping each strategy code to a UUID.

---

## State Management

```typescript
// store/positionStore.ts (Zustand)
interface PositionStore {
  positions: LivePosition[];          // Open positions from WS
  pnlMap: Record<string, number>;     // tradeId → live unrealized P&L
  updatePnl: (update: PnlUpdate) => void;
  setPositions: (positions: LivePosition[]) => void;
}

// store/wsStore.ts
interface WsStore {
  connected: boolean;
  setConnected: (v: boolean) => void;
}
```

TanStack Query handles all REST state. Zustand handles WS-derived real-time state and auth.

---

## New Backend Endpoints to Request

The following endpoints are **not in the current backend** but are needed for the frontend. Request these from the backend team:

| Priority | Endpoint | Purpose |
|---|---|---|
| P0 | `GET /api/v1/trades?status=OPEN&accountId=:id` | Filter trades by status + account for dashboard |
| P0 | `GET /api/v1/pnl/summary?period=today|week|month` | Aggregated P&L summary for dashboard hero |
| P0 | `GET /api/v1/backtest/:id/equity-points` | Equity curve data points for chart |
| P0 | `GET /api/v1/backtest/:id/trades` | `BacktestTrade[]` with nested `positions[]` — required for chart trade overlay markers |
| P0 | `GET /api/v1/backtest/:id/candles` | `MarketData[]` OHLCV for the run's symbol+interval+dateRange — required for annotated chart |
| P0 | `GET /api/v1/lsr-params/defaults` | Full `LsrParams.defaults()` object for backtest param tuning form initialization |
| P0 | `GET /api/v1/vcb-params/defaults` | Full `VcbParams.defaults()` object for backtest param tuning form initialization |
| P0 | `POST /api/v1/backtest` (add `strategyParamOverrides` field) | Accept per-strategy param overrides at run submission time; merge via `LsrParams.merge()` / `VcbParams.merge()` |
| ✅ Done | `POST /api/v1/account-strategies` | Create new strategy on an account (validates user ownership + strategy code) |
| ✅ Done | `DELETE /api/v1/account-strategies/:id` | Soft-delete (sets `is_deleted=true`, `enabled=false`, `deleted_at=now()`). Blocked if open trades exist |
| P1 | `GET /api/v1/account-strategies?userId=:id` | Already exists; confirm filter param |
| P1 | `GET /api/v1/trades/:id/positions` | TradePosition legs for trade detail page |
| P1 | `POST /api/v1/scheduler/pause` / `/resume` | Manual strategy pause/resume from UI |
| P1 | `GET /api/v1/backtest/:id/trades` | Paginated backtest trade list |
| P1 | `GET /api/v1/backtest/:id` returns `paramSnapshot` JSONB | Stored param override map used for the run — enables "Re-run with params" feature |
| P2 | `GET /api/v1/market/indicators?symbol&interval` | FeatureStore indicators for chart overlay |
| P2 | `GET /api/v1/pnl/by-strategy` | Per-strategy P&L breakdown |
| P2 | `GET /api/v1/pnl/daily?from&to` | Daily P&L series for bar chart |

---

## Coding Rules

### General
- **TypeScript strict mode** — no `any`; type all API responses against `types/api.ts`.
- **No raw fetch** — use the Axios client or TanStack Query wrappers.
- **Co-locate types** — API response types live in `types/`; component-local types stay in the component file.
- **Never hardcode URLs** — always `process.env.NEXT_PUBLIC_API_URL`.

### Trading Domain Rules (Frontend)
- **P&L is always USDT** unless explicitly labeled otherwise — always show the asset symbol.
- **Direction badges**: LONG = `var(--color-profit)` tint; SHORT = `var(--color-loss)` tint.
- **Status badges**:
  - `OPEN` → blue
  - `PARTIALLY_CLOSED` → amber
  - `CLOSED` → neutral gray
- **Prices must be monospaced** — use `font-mono tabular-nums` for all numeric cells.
- **Backtest vs Live** — always visually distinguish backtest data from live data (subtle `[SIM]` badge or border treatment).
- **TradePosition legs** — display in order: TP1 → TP2 → RUNNER. Runner leg should visually indicate trailing nature.

### Real-time Rules
- STOMP client is a **singleton** — initialize once in app layout, expose via Zustand `wsStore`.
- Always show a **connection status indicator** (green dot = connected, amber = reconnecting, red = disconnected).
- On reconnect, re-fetch position data via REST to reconcile any missed updates.
- Flash animation on P&L update: green flash for improvement, red flash for deterioration.

### Component Rules
- **No business logic in pages** — pages compose components; logic lives in hooks.
- **Data tables are always sortable** by default on numeric columns.
- **Forms validate on submit AND on blur** — use Zod schemas matching backend DTO constraints.
- **Loading states**: use skeleton loaders (not spinners) for table/chart content.
- **Error states**: show inline error with retry button, not full-page errors, for data fetch failures.

### Performance
- **Virtualize** any list that can exceed 100 rows (trades, backtest trades) — use `react-virtual`.
- **Memoize** chart data transformations — equity point arrays can be large.
- **Debounce** param form auto-save by 500ms.
- TanStack Query stale times:
  - Open positions: `staleTime: 0` (always fresh)
  - Closed trades: `staleTime: 30_000`
  - Backtest results: `staleTime: Infinity` (immutable once complete)
  - Strategy params: `staleTime: 60_000`

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

---

## Development Workflow

```bash
# Install
pnpm install

# Dev server
pnpm dev

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Test
pnpm test

# Build
pnpm build
```

---

## Do Not

- Do not use `useEffect` for data fetching — use TanStack Query.
- Do not use `any` TypeScript type — always type API responses explicitly.
- Do not display raw UNIX timestamps — always format with `date-fns`.
- Do not use light mode colors or white backgrounds — the design is dark-only in v1.
- Do not show raw backend error messages to users — map errors to human-readable messages.
- Do not mutate Zustand state directly — always use store actions.
- Do not hardcode strategy codes — load them from the backend; but use the known set (`LSR`, `LSR_V2`, `VCB`, `TREND_PULLBACK_SINGLE_EXIT`, `RAHT_V1`, `TSMOM_V1`) as fallback display labels.
- Do not use `<form>` HTML elements in React — use controlled `<div>` + `onClick` patterns with RHF.
- Do not bypass auth interceptor by using raw `fetch` — always go through the Axios client.

---

## If Uncertain

- Ask whether a feature is for **live trading** or **backtest** context — they often need separate UI treatments.
- For any new API endpoint needed, document it in the **"New Backend Endpoints to Request"** section and implement a mock in the meantime using TanStack Query's `placeholderData`.
- For risky UI mutations (close trade, pause strategy), always show a **confirmation dialog** before firing the API call.
- When in doubt about data precision, **match the backend** — prices are formatted to the precision returned by Binance.
