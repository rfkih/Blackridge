# Design System

## Aesthetic — "Dark Terminal Luxury"

Bloomberg Terminal meets modern fintech. Intentionally dark, data-dense, never cluttered. Every number has weight; colors have meaning.

- Dark only (no light mode in v1)
- Monospaced numbers — all prices/qty/P&L use `font-variant-numeric: tabular-nums`
- Tight info density — tables, grids, panels; no wasted whitespace
- Surgical color: green `#00C896` profit/long, red `#FF4D6A` loss/short, amber `#F5A623` warning/pending

## Design Tokens

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
  /* Type — IBM Plex (institutional grotesque + matching mono). Loaded via
     next/font as --font-plex-sans / --font-plex-mono; these tokens chain to them. */
  --font-display:var(--font-plex-sans),system-ui,sans-serif;
  --font-body:var(--font-plex-sans),system-ui,sans-serif;
  --font-mono:var(--font-plex-mono),ui-monospace,monospace;
  /* Radius */
  --radius-sm:4px; --radius-md:8px; --radius-lg:12px;
  /* Shadows */
  --shadow-panel:0 0 0 1px var(--border-subtle),0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-profit:0 0 12px rgba(0,200,150,0.2);
  --shadow-glow-loss:0 0 12px rgba(255,77,106,0.2);
}
```

## Type Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display-xl` | IBM Plex Sans | 2.5rem | 700 | Hero numbers (total P&L) |
| `display-lg` | IBM Plex Sans | 1.75rem | 600 | Panel headers |
| `heading` | IBM Plex Sans | 1rem | 600 | Section headers |
| `body` | IBM Plex Sans | 0.875rem | 400 | Default body |
| `caption` | IBM Plex Sans | 0.75rem | 400 | Labels, metadata |
| `mono` | IBM Plex Mono | 0.875rem | 400 | Prices, qty, logs |

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
│   │   ├── montecarlo/page.tsx
│   │   ├── alerts/page.tsx                 # Alert inbox (gated by header badge count)
│   │   └── admin/                          # All admin-only pages — gated `hasRole('ADMIN')`
│   │       ├── error-log/page.tsx          # /api/v1/error-log inbox + status flip
│   │       ├── audit-log/page.tsx          # audit_event viewer
│   │       ├── spec-trace/page.tsx         # V19 spec_trace viewer (mounts SpecTraceViewer)
│   │       ├── strategy-history/page.tsx   # V18 strategy_definition_history diff browser
│   │       ├── walk-forward/page.tsx       # Operator walk-forward runs + scheduler controls
│   │       └── paper-trade/page.tsx        # PROMOTED vs paper-trade comparison surface
│   └── api/                      # Next API routes (proxy if needed)
│
├── components/
│   ├── ui/                       # shadcn base
│   ├── layout/                   # Sidebar, TopNav, CommandPalette (⌘K), NotificationPanel, IpWhitelistBanner
│   ├── charts/                   # CandlestickChart, EquityCurve, PnlBarChart, DrawdownChart, MonteCarloChart
│   ├── trading/                  # OpenPositionsPanel, TradeCard, TradePositionRow, LivePnlTicker, StrategyBadge
│   ├── backtest/                 # BacktestConfigForm, BacktestParamTuner, BacktestParamDiffBadge,
│   │                             # BacktestParamPresetBar, BacktestResultCard, BacktestMetricsGrid, BacktestEquityPanel
│   ├── strategy/                 # LsrParamsForm, VcbParamsForm, StrategyStatusBadge,
│   │                             # NewStrategyDialog, DeleteStrategyDialog
│   ├── research/                 # SpecTraceViewer (decision-tree drilldown, errors-only, spec snapshot)
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
