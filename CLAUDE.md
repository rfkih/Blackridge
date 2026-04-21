# CLAUDE.md — Blackheart Frontend

> Enterprise-grade algo trading dashboard. Design ref: Robinhood + Alpaca, elevated.
> Single source of truth for AI-assisted frontend development.

---

## Project Overview

**Blackheart Frontend** is the web client for the Blackheart algo trading platform — a Java/Spring Boot backend running live trading + backtests on Binance. Frontend must reflect that sophistication: real-time data, complex strategy management, multi-account orchestration, institutional-grade analytics.

**Target user**: a quant trader/operator running one+ Binance accounts with live strategies (LSR, VCB, …) and backtests, monitoring open positions, P&L, equity curves in real time.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR auth, CSR dashboard |
| Language | **TypeScript** (strict) | Type-safe API contracts |
| Styling | **Tailwind v3** + **CSS Variables** | Utility-first w/ token theming |
| Components | **shadcn/ui** (Radix) | Accessible, unstyled base |
| Charts | **TV Lightweight Charts** + **Recharts** | TV for candles; Recharts for equity/metrics |
| Real-time | **STOMP/WebSocket** (`@stomp/stompjs`) | Matches backend STOMP P&L stream |
| State | **Zustand** | Positions, strategies, WS state |
| Server state | **TanStack Query** | Cache, polling, mutations |
| Auth | **JWT** (httpOnly cookie / localStorage fallback) | Backend Bearer auth |
| Forms | **React Hook Form** + **Zod** | Schema validation matching backend DTOs |
| Animation | **Framer Motion** | Transitions, micro-interactions |
| Icons | **Lucide React** | — |
| Date | **date-fns** | Tree-shakable |
| HTTP | **Axios** w/ interceptors | Auth injection, error normalization |
| Testing | **Vitest** + **RTL** | Unit + integration |
| E2E | **Playwright** | Critical trading flows |
| Lint | **ESLint** + **Prettier** (Airbnb base) | — |

---

## Design System

### Aesthetic — "Dark Terminal Luxury"

Bloomberg Terminal meets modern fintech. Intentionally dark, data-dense, never cluttered. Every number has weight; colors have meaning.

- Dark only (no light mode in v1)
- Monospaced numbers — all prices/qty/P&L use `font-variant-numeric: tabular-nums`
- Tight info density — tables, grids, panels; no wasted whitespace
- Surgical color: green `#00C896` profit/long, red `#FF4D6A` loss/short, amber `#F5A623` warning/pending

### Design Tokens

```css
:root {
  /* Backgrounds */
  --bg-base:#0A0B0D; --bg-surface:#111318; --bg-elevated:#1A1D24;
  --bg-overlay:#22262F; --bg-hover:#2A2F3A;
  /* Borders */
  --border-subtle:#1E2230; --border-default:#2A2F3A; --border-strong:#3D4455;
  /* Semantic */
  --color-profit:#00C896; --color-loss:#FF4D6A; --color-warning:#F5A623;
  --color-info:#4E9EFF;   --color-neutral:#8892A4;
  /* Text */
  --text-primary:#E8EBF0; --text-secondary:#8892A4;
  --text-muted:#4A5160;   --text-inverse:#0A0B0D;
  /* Brand */
  --accent-primary:#4E9EFF; --accent-glow:rgba(78,158,255,0.15);
  /* Type */
  --font-display:'DM Mono',monospace;
  --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  /* Radius */
  --radius-sm:4px; --radius-md:8px; --radius-lg:12px;
  /* Shadows */
  --shadow-panel:0 0 0 1px var(--border-subtle),0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-profit:0 0 12px rgba(0,200,150,0.2);
  --shadow-glow-loss:0 0 12px rgba(255,77,106,0.2);
}
```

### Type Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display-xl` | DM Mono | 2.5rem | 600 | Hero numbers (total P&L) |
| `display-lg` | DM Mono | 1.75rem | 500 | Panel headers |
| `heading` | Inter | 1rem | 600 | Section headers |
| `body` | Inter | 0.875rem | 400 | Default body |
| `caption` | Inter | 0.75rem | 400 | Labels, metadata |
| `mono` | JetBrains Mono | 0.875rem | 400 | Prices, qty, logs |

---

## Application Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/{login,register}/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar + top nav
│   │   ├── page.tsx              # Overview
│   │   ├── trades/{page.tsx,[id]/page.tsx}
│   │   ├── strategies/{page.tsx,[accountStrategyId]/{page.tsx,params/page.tsx}}
│   │   ├── backtest/
│   │   │   ├── page.tsx                # Run list
│   │   │   ├── new/page.tsx            # Step 1 — config
│   │   │   ├── new/params/page.tsx     # Step 2 — param tuning
│   │   │   └── [id]/page.tsx           # Result
│   │   ├── portfolio/page.tsx
│   │   ├── market/page.tsx
│   │   ├── pnl/page.tsx
│   │   └── montecarlo/page.tsx
│   └── api/                      # Next API routes (proxy if needed)
│
├── components/
│   ├── ui/                       # shadcn base
│   ├── layout/                   # Sidebar, TopNav, CommandPalette (⌘K), NotificationPanel
│   ├── charts/                   # CandlestickChart, EquityCurve, PnlBarChart, DrawdownChart, MonteCarloChart
│   ├── trading/                  # OpenPositionsPanel, TradeCard, TradePositionRow, LivePnlTicker, StrategyBadge
│   ├── backtest/                 # BacktestConfigForm, BacktestParamTuner, BacktestParamDiffBadge,
│   │                             # BacktestParamPresetBar, BacktestResultCard, BacktestMetricsGrid, BacktestEquityPanel
│   ├── strategy/                 # LsrParamsForm, VcbParamsForm, StrategyStatusBadge,
│   │                             # NewStrategyDialog, DeleteStrategyDialog
│   └── shared/                   # PnlCell, PriceCell, StatusIndicator, DataTable, StatCard, EmptyState
│
├── hooks/                        # useWebSocket, useLivePnl, useTrades, useBacktest, useStrategies, useAuth
├── lib/
│   ├── api/                      # client.ts (Axios+auth), trades, backtest, backtest-params,
│   │                             # strategies, portfolio, pnl, market, lsr-params
│   ├── ws/stompClient.ts         # Singleton STOMP client
│   ├── formatters.ts  constants.ts  utils.ts
├── store/                        # authStore, positionStore, backtestParamStore, wsStore (Zustand)
└── types/                        # api, trading, strategy, backtest, market
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

### Endpoint Map (existing backend)

| Module | Endpoint | Method | Notes |
|---|---|---|---|
| Auth | `/api/v1/users/login` `/register` | POST | JWT |
| Profile | `/api/v1/users/me` | GET | — |
| Trades | `/api/v1/trades` `/:id` | GET | List + detail |
| P&L | `/api/v1/pnl` | GET | — |
| Portfolio | `/api/v1/portfolio` | GET | Balances |
| Strategies | `/api/v1/account-strategies` | GET | Excludes soft-deleted |
| Strategies | `/api/v1/account-strategies/:id` | GET/DELETE | Detail / soft-delete (blocked w/ open trades) |
| Strategies | `/api/v1/account-strategies` | POST | Create |
| LSR/VCB params | `/api/v1/{lsr,vcb}-params/:id` | GET/PUT/PATCH/DELETE | CRUD + defaults |
| Backtest | `/api/v1/backtest` `/:id` | GET/POST | List/submit/result |
| Market | `/api/v1/market` | GET | Candles |
| Monte Carlo | `/api/v1/montecarlo` | POST | — |
| Scheduler | `/api/v1/scheduler` | GET/POST | — |

### WebSocket / STOMP

```typescript
// lib/ws/stompClient.ts
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';
client.subscribe('/topic/pnl/:accountId', (m) =>
  usePositionStore.getState().updatePnl(JSON.parse(m.body))
);
```

> Backend exposes `/ws` (public, no auth on upgrade). STOMP carries identity via JWT in CONNECT header or query param — confirm with backend.

---

## Key Pages & Features

### 1. Dashboard (`/`)
Hero metrics: Total Unrealized P&L, Today's Realized P&L, Open Positions, Win Rate (30d). Open Positions panel (live WS). Recent Trades (last 10). Strategy status cards per active `AccountStrategy` (Live/Paused, last signal, last trade).

### 2. Trades (`/trades`)
Sortable/filterable trade table: Symbol, Strategy, Direction badge, Entry/Exit Price, Realized P&L, Duration, Status, Actions. Detail shows all `TradePosition` legs (SINGLE/TP1/TP2/RUNNER), prices/fees/net P&L per leg.

### 3. Strategies (`/strategies`)
One card per `AccountStrategy`: code badge, interval, capital, allow-long/short, priority, status. Detail edits `LsrParams`/`VcbParams` with defaults shown alongside. PUT/PATCH on save.

**Create / delete**
- "New Strategy" header button → `NewStrategyDialog` → `POST /api/v1/account-strategies`. Disabled when user has no active accounts.
- Trash icon (hover) → `DeleteStrategyDialog` → `DELETE /api/v1/account-strategies/:id`. Backend soft-deletes (sets `is_deleted=true`, `enabled=false`, `deleted_at=now()`); historical trades/P&L still resolve via the row.
- Delete is blocked server-side if `OPEN`/`PARTIALLY_CLOSED` trades exist. Error (`"Cannot delete strategy with N open trade(s)…"`) flows through `normalizeError` and renders inline — do not hide or remap it.

**Status derivation (important)**
Backend `current_status` column is **not maintained** — every row holds seed `"STOPPED"`. Treat as dead. Real liveness is `enabled: boolean` on `BackendAccountStrategy`. `mapAccountStrategy` in `src/lib/api/strategies.ts` derives `status = enabled ? 'LIVE' : 'STOPPED'`. `PAUSED` is unreachable until backend models it.

### 4. Backtest (`/backtest`)
- **Run list**: status (PENDING/RUNNING/COMPLETE/FAILED), strategy, range, return %, Sharpe, MDD. "New Backtest" → wizard.
- **Step 1 Config** (`/backtest/new`): symbol, interval, range, capital, strategy multi-select, `accountStrategyId` per strategy. → step 2 (state in `backtestParamStore`).
- **Step 2 Param Tuning** (`/backtest/new/params`): see full spec below. "Run Backtest" submits `POST /api/v1/backtest` w/ merged config + param overrides.
- **Run detail** (`/backtest/[id]`): equity curve, drawdown, metrics grid (WR, PF, Avg Win/Loss, MDD, Sharpe, Sortino, Total Trades), trade list + **annotated candlestick chart** (see below). "Re-run with params →" pre-fills wizard.

### 5. P&L Analytics (`/pnl`)
Daily/Weekly/Monthly P&L bar charts, cumulative line, per-strategy breakdown. Filter by date/strategy/symbol.

### 6. Portfolio (`/portfolio`)
Account balances, available vs locked, per-asset.

### 7. Market (`/market`)
TV Lightweight Charts candlestick for any symbol/interval. Overlay FeatureStore indicators (EMA/BB/KC) where available.

### 8. Monte Carlo (`/montecarlo`)
Submit sim params → distribution as fan chart (percentile bands).

---

## Backtest Param Tuning Page (`/backtest/new/params`)

Step 2 of backtest wizard. Configure strategy params **before** the run is submitted, without touching live account params.

### Design Philosophy
- **Non-destructive by default**: edits ephemeral, scoped to this run only. They do NOT write to `lsr_strategy_param`/`vcb_strategy_param` unless user clicks "Save as Live Params".
- **Defaults-first**: form initializes from backend `GET /defaults`. Diffs visually marked.
- **Fast iteration loop**: tweak → run → see results → return tweak. "Re-run with same params" on result page feeds back here pre-filled.

### Page Layout (top→bottom)
1. Wizard breadcrumb: Config → Params → Run + Back link.
2. **Run Summary Bar** (read-only): symbol • interval • date range • capital.
3. **Preset Bar**: `[Load preset ▾]` `[Save current as preset…]` `[Reset to defaults]`.
4. **Strategy Tabs** (one per selected strategy) w/ override count badge — e.g. `LSR_V2 · 3 overrides`.
5. **Param Form** (active tab) — collapsible sections per group, with diff dot + default ghost text.
6. Footer: `[Save as Live Params]` (secondary) + `[Run Backtest →]` (primary).

### Wizard State (`backtestParamStore`)

State bridges step 1 → 2 → submission. Never persisted to backend until "Run Backtest".

```typescript
// store/backtestParamStore.ts
interface BacktestWizardState {
  config: {
    symbol: string;
    interval: string;
    fromDate: string;        // ISO
    toDate: string;
    initialCapital: number;
    strategyCodes: string[]; // ['LSR_V2','VCB']
    strategyAccountStrategyIds: Record<string, string>; // code → UUID
  } | null;
  // Per-strategy override map (only non-default values)
  paramOverrides: Record<string, Record<string, unknown>>;
  activePresetName: string | null;
  // Actions
  setConfig: (c: BacktestWizardState['config']) => void;
  setParamOverride: (code: string, key: string, value: unknown) => void;
  resetParamOverrides: (code: string) => void;
  resetAll: () => void;
  loadPreset: (preset: BacktestParamPreset) => void;
}
```

### `BacktestParamTuner` (`components/backtest/BacktestParamTuner.tsx`)

Shell renders: Run summary → Preset bar → Strategy tabs → Active param form (`LsrParamForm` / `VcbParamForm` / fallback `UnknownStrategyParamForm`) → Footer actions.

```typescript
interface BacktestParamTunerProps {
  // All data from backtestParamStore; only props are submission
  onSubmit: (payload: BacktestRunPayload) => void;
  isSubmitting: boolean;
}
```

### Param Forms (shared with live edit)

Same fields/validation but **backtest mode**:
- Initial values = `GET /defaults` merged with current `paramOverrides`.
- On change: `setParamOverride(code, key, value)` — no API call.
- Default value: render normal. Overridden: amber `●` dot + default as ghost text.

```typescript
// components/strategy/LsrParamForm.tsx (shared)
interface LsrParamFormProps {
  mode: 'live' | 'backtest';
  accountStrategyId?: string;   // required in 'live'
  strategyCode?: string;        // required in 'backtest' (store key)
  initialValues: Partial<LsrParams>;
  defaultValues: LsrParams;     // always provided; for diff
  onChange?: (key: string, value: unknown) => void; // backtest mode
}
```

#### LSR field groups (collapsible; only first open by default)

| Section | Fields |
|---|---|
| Entry Conditions | `adxThreshold`, `rsiOverbought`, `rsiOversold`, `adxPeriod`, `rsiPeriod` |
| Volatility Filters | `useErFilter`, `erThreshold`, `erPeriod`, `useRelVolFilter`, `relVolThreshold` |
| Exit & Risk | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner`, `runnerActivationR` |
| Position Sizing | `riskPercentage`, `maxPositionSizeUsdt` |
| Direction | `allowLong`, `allowShort` (read-only — inherited from `AccountStrategy`) |

#### VCB field groups

| Section | Fields |
|---|---|
| Compression Detection | `compressionLookback`, `compressionBbWidth`, `compressionKcWidth`, `useKcFilter` |
| Breakout Filters | `minBreakoutAtr`, `maxBreakoutAtr`, `volumeMultiplier`, `useVolumeFilter` |
| Exit & Risk | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner` |
| Position Sizing | `riskPercentage`, `maxPositionSizeUsdt` |

> Field names must match `LsrParams`/`VcbParams` Java classes — confirm with backend.

#### Field Renderers

| Type | Component | Notes |
|---|---|---|
| number (decimal) | `<NumericInput step={0.1}/>` | Mono, right-aligned |
| number (integer) | `<NumericInput step={1}/>` | — |
| boolean | `<Toggle/>` | shadcn Switch |
| number (%) | `<SliderInput min={0} max={100} step={0.5}/>` + numeric | Show as `%` |
| number (R) | `<SliderInput min={0.5} max={5} step={0.25}/>` | Show as `×` |

Each field shows: human-readable label, control, default ghost text (`default: 25` in `var(--text-muted)`), amber `●` if overridden, optional `?` tooltip.

### Diff Indicator (`BacktestParamDiffBadge`)
Shown on tabs and section headers.
```typescript
interface BacktestParamDiffBadgeProps { overrideCount: number; }
// "N overrides" amber if >0, "defaults" muted if 0
```

### Preset System (`BacktestParamPresetBar`)
Named snapshots of `paramOverrides` in `localStorage` (no backend in v1). Key: `blackheart:backtest-presets`.

```typescript
interface BacktestParamPreset {
  id: string;            // nanoid
  name: string;
  strategyCode: string;
  overrides: Record<string, unknown>;
  createdAt: string;
}
```

| Control | Behavior |
|---|---|
| `[Load preset ▾]` | Dropdown filtered by current strategy tab. Selecting merges `overrides` into store. |
| `[Save current as preset…]` | Popover w/ name input → save current overrides. |
| `[Reset to defaults]` | `resetParamOverrides(activeStrategyCode)`. Confirm if overrides exist. |

### Submission Payload (`buildBacktestPayload`)

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
    // Only keys that differ from defaults — backend merges via LsrParams.merge()/VcbParams.merge()
    strategyParamOverrides: Object.fromEntries(
      config.strategyCodes.map((code) => [
        code, computeDiff(defaultParams[code], paramOverrides[code] ?? {}),
      ])
    ),
  };
}
const computeDiff = (defaults: Record<string, unknown>, overrides: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(overrides).filter(([k, v]) => v !== defaults[k]));
```

### "Re-run with Params" — Result Page Integration
Result page (`/backtest/[id]`) header has "Re-run with these params" button:
1. Reads `BacktestRun`'s stored `strategyAccountStrategyIds` + param snapshot.
2. Pre-fills `backtestParamStore.config` and `paramOverrides`.
3. Navigates to `/backtest/new` (step 1).

> Backend: persist param overrides alongside `BacktestRun` — request `paramSnapshot` JSONB column storing the exact `strategyParamOverrides` map.

### UX Rules
- Never auto-submit — param changes always explicit; no debounced API on this page.
- "Run Backtest" is the only write action — all intermediate state is local.
- Field descriptions: `?` tooltip per param explaining thresholds/multipliers, sourced from a static `paramMeta` map in `lib/constants.ts`.
- Validate via Zod before submit; block + highlight invalid fields like live forms.
- Section collapse state per-session in sessionStorage; reset on reload.
- Keyboard: `Cmd/Ctrl + Enter` triggers Run when valid.
- Dirty state: `beforeunload` warning if leaving with unsaved overrides.
- "Save as Live Params" — destructive: confirm dialog *"This will overwrite the live params for [strategy] on account [X]. Backtests will use the same params going forward."*

---

## Backtest Trade Execution Chart Overlay

First-class feature of result page. Every executed trade visible on the candlestick chart for visual trade-by-trade analysis.

### Layout (split, top→bottom)
1. Metrics grid (WR, Sharpe, MDD, …)
2. **Annotated Candlestick Chart** (tall) — TV Lightweight; entry/exit markers, SL/TP lines, highlighted candle range for selected trade
3. Equity Curve | Drawdown Chart (side by side)
4. Trade list table (synced with chart)

### Marker System (`ISeriesApi.setMarkers()`)

| Event | Shape | Color | Position | Label |
|---|---|---|---|---|
| LONG entry | `arrowUp` | `#00C896` | belowBar | `L` |
| SHORT entry | `arrowDown` | `#FF4D6A` | aboveBar | `S` |
| TP1 hit | `circle` | `#00C896` | aboveBar (long)/belowBar (short) | `T1` |
| TP2 hit | `circle` | `#00C896` brighter | same as TP1 | `T2` |
| RUNNER close | `circle` | `#4E9EFF` | same as TP | `R` |
| Stop loss | `circle` | `#FF4D6A` | opposite of entry | `SL` |
| Partial close | `circle` | `#F5A623` | above/below bar | `P` |

Each marker carries `id = backtestTradeId` in `tooltip` so clicks resolve to the trade row.

### Trade Range Highlight
Multi-candle trades get a background band — overlay histogram series at chart min/max covering entry→final exit range. Color: green-tint long, red-tint short.

```typescript
const highlightSeries = chart.addHistogramSeries({
  color: trade.direction === 'LONG'
    ? 'rgba(0,200,150,0.06)' : 'rgba(255,77,106,0.06)',
  priceFormat: { type: 'volume' },
  priceScaleId: '', // overlay scale
});
```

### SL / TP Price Lines
For the selected trade, draw via `series.createPriceLine()`:

```typescript
const slLine = candleSeries.createPriceLine({
  price: trade.stopLossPrice, color: '#FF4D6A', lineWidth: 1,
  lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL',
});
const tp1Line = candleSeries.createPriceLine({
  price: trade.tp1Price, color: '#00C896', lineWidth: 1,
  lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP1',
});
// Repeat TP2, RUNNER trailing stop. Track refs; remove via series.removePriceLine(ref).
```

### Bidirectional Sync (Chart ↔ Table)

```typescript
// Chart → Table
chart.subscribeClick((param) => {
  if (!param.time) return;
  const m = markers.find((x) => x.time === param.time);
  if (m?.id) {
    setSelectedTradeId(m.id);
    tableRowRefs[m.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// Table → Chart
const handleTradeRowClick = (trade: BacktestTrade) => {
  setSelectedTradeId(trade.id);
  const ts = chart.timeScale();
  ts.scrollToPosition(
    ts.coordinateToLogical(ts.timeToCoordinate(trade.entryTime / 1000) ?? 0) - 10,
    false,
  );
};
```

Selected row highlight: `bg-[var(--bg-hover)] border-l-2 border-[var(--accent-primary)]`.

### `BacktestAnnotatedChart`

```typescript
interface BacktestAnnotatedChartProps {
  backtestRunId: string;
  candles: MarketData[];
  trades: BacktestTrade[];
  positions: BacktestTradePosition[];
  selectedTradeId: string | null;
  onTradeSelect: (id: string | null) => void;
}
```

Logic:
1. Mount: create chart, add candle series, set data.
2. `useMemo`: compute `SeriesMarker[]` from trades+positions, sorted by time (TV requirement).
3. `useEffect([trades, positions])`: `series.setMarkers(markers)`.
4. `useEffect([selectedTradeId])`: remove old SL/TP lines + highlight band; draw new ones for selected trade.
5. Unmount: `chart.remove()`.

Performance: trade arrays can hit hundreds → memoize marker computation, do not recompute on every render.

### `BacktestTradeTable`
Standard `DataTable` plus:
- `rowRefs = useRef<Record<string, HTMLTableRowElement>>({})` for chart-driven scroll.
- Selected row visual highlight (left accent border + bg).
- Columns: `#`, Direction badge, Entry Time/Price, Exit Time/Price, SL, TP1, TP2, Legs hit (TP1✓ TP2✓ RUNNER✓), P&L, R-multiple, Duration.
- Legs hit: small colored dots showing which legs closed at profit vs stop.

### Required Backend Data Shape

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

If `stopLossPrice`/`tp1Price`/`tp2Price` not on `BacktestTrade`, request additions. Nested `positions` strongly preferred over an N+1 fetch.

### Marker Computation

```typescript
// lib/backtest/buildTradeMarkers.ts
export function buildTradeMarkers(trades: BacktestTrade[]): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (const trade of trades) {
    const isLong = trade.direction === 'LONG';
    markers.push({
      time: (trade.entryTime / 1000) as Time,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#00C896' : '#FF4D6A',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: isLong ? 'L' : 'S',
      id: trade.id,
    });
    for (const pos of trade.positions) {
      if (!pos.exitTime || !pos.exitReason) continue;
      const cfg = LEG_MARKER_CONFIG[pos.type]?.[pos.exitReason];
      if (!cfg) continue;
      markers.push({
        time: (pos.exitTime / 1000) as Time,
        position: isLong ? 'aboveBar' : 'belowBar',
        color: cfg.color, shape: 'circle', text: cfg.label, id: trade.id,
      });
    }
  }
  return markers.sort((a, b) => (a.time as number) - (b.time as number));
}

const LEG_MARKER_CONFIG: Record<
  BacktestTradePosition['type'],
  Partial<Record<BacktestTradePosition['exitReason'], { color: string; label: string }>>
> = {
  SINGLE: {
    TP_HIT:       { color:'#00C896', label:'TP' },
    SL_HIT:       { color:'#FF4D6A', label:'SL' },
    BACKTEST_END: { color:'#8892A4', label:'E'  },
  },
  TP1: { TP_HIT:{color:'#00C896',label:'T1'}, SL_HIT:{color:'#FF4D6A',label:'SL'} },
  TP2: { TP_HIT:{color:'#00E5B0',label:'T2'}, SL_HIT:{color:'#FF4D6A',label:'SL'} },
  RUNNER: {
    RUNNER_CLOSE: { color:'#4E9EFF', label:'R'  },
    SL_HIT:       { color:'#FF4D6A', label:'SL' },
    BACKTEST_END: { color:'#8892A4', label:'E'  },
  },
};
```

### Marker Hover Tooltip
TV has no native marker tooltip — implement custom floating one:

```typescript
chart.subscribeCrosshairMove((param) => {
  if (!param.point || !param.time) return setHoveredMarker(null);
  const m = markers.find((x) => x.time === param.time);
  if (m) setHoveredMarker({ tradeId: m.id, x: param.point.x, y: param.point.y });
});
```

Render `<TradeMarkerTooltip>` absolutely positioned in chart container. Show: Direction, Entry→Exit price, P&L, legs hit.

### UX Rules for Chart Overlay
- Markers always visible — no toggle in v1. Density is a feature.
- Clicking empty chart space deselects trade (clears price lines + band).
- Multiple trades on same candle: TV stacks markers — tooltip resolves correct trade.
- Zoom: TV manages — markers follow candles automatically.
- Time zone: backend epoch ms UTC → divide by 1000 for TV's `UTCTimestamp`. Configure TV `localization: { timeFormatter }` for user TZ or UTC explicitly.
- Do NOT draw custom canvas overlays — only `setMarkers` + `createPriceLine` to stay compatible w/ TV's renderer.
- 1000+ candles, 200+ trades must not jank — memoize `buildTradeMarkers`, call `setMarkers` only when trade data changes.

---

## Component Patterns

### PnlCell
```tsx
const PnlCell = ({ value }: { value: number }) => (
  <span className="font-mono tabular-nums text-sm"
    style={{ color: value >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
    {value >= 0 ? '+' : ''}{value.toFixed(2)} USDT
  </span>
);
```

### LivePnlTicker
Subscribe to STOMP topic on mount; unsubscribe on unmount. Animate number changes via Framer Motion `AnimatePresence` for flash-green/red transitions.

### DataTable
TanStack Table v8: column sorting, visibility toggle, pagination, row selection, search/filter. Virtualized via `react-virtual` for large datasets.

### BacktestForm
Multi-strategy: `strategyCode` is comma-separated multi-select (e.g. `LSR_V2,VCB`). `strategyAccountStrategyIds` is dynamic key-value mapping each code to UUID.

---

## State Management

```typescript
// store/positionStore.ts
interface PositionStore {
  positions: LivePosition[];
  pnlMap: Record<string, number>;       // tradeId → live unrealized P&L
  updatePnl: (u: PnlUpdate) => void;
  setPositions: (p: LivePosition[]) => void;
}
// store/wsStore.ts
interface WsStore { connected: boolean; setConnected: (v: boolean) => void; }
```

TanStack Query handles all REST. Zustand handles WS-derived real-time + auth.

---

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

> `GET /defaults` likely already exists per backend contract — confirm returns full defaults, not just diffs.

---

## Coding Rules

### General
- TS strict — no `any`; type all responses against `types/api.ts`.
- No raw `fetch` — always Axios client / TanStack Query wrappers.
- Co-locate types: API types in `types/`; component-local stay in component file.
- Never hardcode URLs — always `process.env.NEXT_PUBLIC_API_URL`.

### Trading Domain (Frontend)
- P&L is always USDT unless labeled otherwise — show asset symbol.
- Direction badges: LONG = `var(--color-profit)` tint; SHORT = `var(--color-loss)` tint.
- Status badges: `OPEN` blue, `PARTIALLY_CLOSED` amber, `CLOSED` neutral gray.
- Prices monospaced — `font-mono tabular-nums` for all numeric cells.
- Backtest vs Live — visually distinguish (subtle `[SIM]` badge or border treatment).
- TradePosition legs displayed TP1 → TP2 → RUNNER. Runner indicates trailing nature.

### Real-time
- STOMP client is a **singleton** — init once in app layout, expose via Zustand `wsStore`.
- Always show connection status indicator (green=connected, amber=reconnecting, red=disconnected).
- On reconnect, refetch positions via REST to reconcile missed updates.
- Flash animation on P&L update: green for improvement, red for deterioration.

### Components
- No business logic in pages — pages compose components; logic lives in hooks.
- Data tables sortable by default on numeric columns.
- Forms validate on submit AND blur — Zod schemas matching backend DTO constraints.
- Loading states: skeleton loaders (not spinners) for table/chart content.
- Error states: inline w/ retry button, not full-page, for fetch failures.

### Performance
- Virtualize lists >100 rows (trades, backtest trades) — `react-virtual`.
- Memoize chart data transformations — equity arrays can be large.
- Debounce param form auto-save by 500ms.
- TanStack Query `staleTime`:
  - Open positions: `0`
  - Closed trades: `30_000`
  - Backtest results: `Infinity` (immutable once complete)
  - Strategy params: `60_000`

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
pnpm install
pnpm dev
pnpm tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

---

## Do Not

- Use `useEffect` for data fetching — use TanStack Query.
- Use `any` — type API responses explicitly.
- Display raw UNIX timestamps — format with `date-fns`.
- Use light mode colors / white backgrounds — dark-only in v1.
- Show raw backend errors to users — map to human-readable messages.
- Mutate Zustand state directly — use store actions.
- Hardcode strategy codes — load from backend; fallback labels: `LSR`, `LSR_V2`, `VCB`, `TREND_PULLBACK_SINGLE_EXIT`, `RAHT_V1`, `TSMOM_V1`.
- Use `<form>` HTML elements — controlled `<div>` + `onClick` patterns w/ RHF.
- Bypass auth interceptor with raw `fetch` — always go through Axios client.

---

## If Uncertain

- Ask whether the feature is **live** or **backtest** — they often need separate UI treatments.
- For any new endpoint needed, document in **"New Backend Endpoints to Request"** and mock via TanStack Query `placeholderData`.
- For risky mutations (close trade, pause strategy), always show a confirmation dialog before firing.
- When unsure about data precision, match the backend — prices formatted to Binance precision.
