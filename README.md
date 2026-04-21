# Meridian Edge Frontend

Enterprise algo-trading dashboard for the Meridian Edge platform — a Next.js 14 web client that talks to a Spring Boot backend running live trading and backtests on Binance. Dark-only, data-dense, TradingView candles + Recharts analytics, STOMP-over-WebSocket for live P&L.

## Prerequisites

- **Node.js 20+**
- **pnpm** (preferred package manager; `corepack enable` if you don't have it)
- A running **Meridian Edge backend** at a reachable URL (defaults to `http://localhost:8080`)

## Setup

```bash
pnpm install
cp .env.example .env.local   # edit the two URLs to point at your backend
pnpm dev                      # http://localhost:3000
```

## Environment variables

All `NEXT_PUBLIC_*` vars are inlined at build time. `src/lib/env.ts` validates them on import — missing vars throw in production, log a warning + fall back in development.

| Variable                  | Required   | Default                 | Purpose                                     |
| ------------------------- | ---------- | ----------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | prod: yes  | `http://localhost:8080` | Base URL for REST calls (`/api/v1/...`).    |
| `NEXT_PUBLIC_WS_URL`      | prod: yes  | `ws://localhost:8080/ws`| STOMP endpoint for live P&L subscriptions.  |

## Scripts

| Command              | What it does                                         |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | Next.js dev server on :3000.                         |
| `pnpm build`         | Production build (type-checks + bundles).            |
| `pnpm start`         | Serve the built bundle.                              |
| `pnpm typecheck`     | `tsc --noEmit` — catches type errors without building. |
| `pnpm lint`          | ESLint (airbnb + next core web vitals + prettier).   |
| `pnpm format`        | Prettier-write every file.                           |
| `pnpm test`          | Vitest unit tests.                                   |
| `pnpm e2e`           | Playwright end-to-end tests (golden trading flows).  |

## Architecture

- **App Router** (Next.js 14) with a `(dashboard)` route group for authenticated pages and `(auth)` for login/register. Middleware gates the dashboard routes by reading the JWT cookie mirror.
- **Data layer**: TanStack Query for all REST (Axios client with JWT interceptor + envelope unwrapping in `src/lib/api/client.ts`), Zustand for auth/WS/position/wizard state.
- **Real-time**: singleton STOMP client (`src/lib/ws/stompClient.ts`) subscribes to `/topic/pnl/{accountId}` after sending a one-off `/app/pnl.subscribe` message. WS frames feed `positionStore.pnlMap`, which `LivePnlCell` selects per `tradeId` so only the affected row flashes.
- **Charts**: TradingView Lightweight Charts for candles (market page, backtest annotated chart), Recharts for everything else (equity, drawdown, P&L bars, Monte Carlo fan). A shared theme in `src/lib/charts/rechartsTheme.ts` keeps axes and tooltips consistent.

## Key design decisions

- **Dark-only** — no light mode in v1. The design language is "dark terminal luxury" (Bloomberg meets Alpaca), and accommodating a light theme would dilute colour-coding that carries semantic meaning (profit/loss, status).
- **TV charts for OHLCV, Recharts for the rest** — TV is canvas-based and unmatched for zoom/pan on thousands of candles; Recharts composes cleanly with React for metric cards and analytics charts that don't need WebGL.
- **STOMP for live P&L** — matches the backend's Spring WebSocket setup. Each client explicitly opts accounts into the publisher registry; the registry is idempotent so reconnects are safe.
- **Backtest param wizard** — edits are ephemeral until the user clicks "Run Backtest". The backend persists the exact override diff alongside the run, so "Re-run with these params" is a true replay, not a re-tune from defaults.
- **Error boundaries per panel** — a single failing chart or table never takes down the whole route. Each boundary takes a `label` so the fallback can name the area that broke.

## Project structure

```
src/
├── app/                 # Next.js App Router (pages + route layouts)
├── components/
│   ├── backtest/        # Wizard, param tuner, annotated chart, trade table
│   ├── charts/          # TV candlestick wrapper, Recharts wrappers
│   ├── trading/         # Open positions panel, live PnL cells, badges
│   ├── strategy/        # Strategy cards, param forms, create/delete dialogs
│   ├── shared/          # StatCard, PnlCell, ErrorBoundary, DataTable, etc.
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Data hooks (useBacktest, useTrades, ...), WS hooks
├── lib/
│   ├── api/             # Axios client + per-resource REST modules
│   ├── ws/              # STOMP client + helpers
│   ├── charts/          # Chart themes + indicator series helpers
│   └── env.ts           # Validated env accessor
├── store/               # Zustand stores (auth, ws, positions, wizard)
└── types/               # Shared TS types (API, trading, backtest, ...)
```

## Troubleshooting

- **Frontend can't reach the backend in the browser but `curl` works** — CORS on the API. Allow this origin (`http://localhost:3000` in dev) explicitly on the Spring backend.
- **`/backtest/undefined` after submit** — should no longer happen (fixed by routing POST through `BacktestQueryService.getRun`), but if you see it, a legacy backend build is returning the flat `BacktestRunResponse` shape. Pull `BacktestV1Controller` changes on the backend side.
- **Live P&L isn't updating** — verify the WS connects (green dot in the top bar), then verify the account has been opted into the backend publisher registry (the client sends `/app/pnl.subscribe` automatically after subscribing to `/topic/pnl/{accountId}`; on reconnect it re-sends).
