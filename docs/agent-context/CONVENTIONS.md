# Coding Conventions

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

### Pagination, Sorting, Filtering — Server-Side Only

Lists are **always** paginated, sorted, and filtered by the backend. The frontend forwards user-selected page/size/sort/filter through query params and renders the resulting page envelope as-is. **Never** reorder, slice, search, or otherwise narrow a list client-side.

- **Why**: a panel showing "top 5" of a client-side `slice(0, 5)` is wrong as soon as the list exceeds the page size — items beyond page 1 are invisible to the sort. The backend has the full set, the right indexes, and the canonical ordering.
- **Page envelope**: backend list endpoints return Spring Data's `Page<T>` shape — `{ content, totalElements, totalPages, number, size }`. Treat `content` as the rendered page and `totalElements` as the source of truth for counts. Do not derive totals from `content.length`.
- **Sort param**: pass `sort=field,asc|desc` (Spring's convention). When a column header is clicked, update the query param and refetch — do not call `Array.prototype.sort()` on the result.
- **Filter / search**: pass filters as discrete query params (e.g. `?strategyCode=LSR&toState=PROMOTED`). The query key must include every filter value so each filter combination forms its own cache entry. Debounce text inputs (250 ms) before re-keying. Do not run `.filter()`/`.includes()` over `content` to narrow the list.
- **TanStack Query keys**: include `page`, `size`, `sort`, and every filter param verbatim — `['recent', { page, size, sort, strategyCode, toState }]`. `placeholderData: (prev) => prev` keeps the previous page visible during refetch so the table doesn't flicker empty.
- **If the backend doesn't support a needed sort/filter**: do not work around it client-side. Add the endpoint to **API.md → New Backend Endpoints to Request**, ship the backend change, then wire the UI.
- **Narrow exception**: pure visual reordering with no semantic meaning (e.g. drag-to-reorder dashboard cards stored in localStorage, or zipping two parallel arrays for a chart) is not a list query — that's UI state, not data. Server-side rule applies to anything that came from a list endpoint.

### Performance
- Virtualize lists >100 rows (trades, backtest trades) — `react-virtual`.
- Memoize chart data transformations — equity arrays can be large.
- Debounce param form auto-save by 500ms.
- TanStack Query `staleTime`:
  - Open positions: `0`
  - Closed trades: `30_000`
  - Backtest results: `Infinity` (immutable once complete)
  - Strategy params: `60_000`
