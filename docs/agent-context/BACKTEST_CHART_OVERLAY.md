# Backtest Trade Execution Chart Overlay

First-class feature of result page. Every executed trade visible on the candlestick chart for visual trade-by-trade analysis.

## Layout (split, top→bottom)
1. Metrics grid (WR, Sharpe, MDD, …)
2. **Annotated Candlestick Chart** (tall) — TV Lightweight; entry/exit markers, SL/TP lines, highlighted candle range for selected trade
3. Equity Curve | Drawdown Chart (side by side)
4. Trade list table (synced with chart)

## Marker System (`ISeriesApi.setMarkers()`)

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

## Trade Range Highlight
Multi-candle trades get a background band — overlay histogram series at chart min/max covering entry→final exit range. Color: green-tint long, red-tint short.

```typescript
const highlightSeries = chart.addHistogramSeries({
  color: trade.direction === 'LONG'
    ? 'rgba(0,200,150,0.06)' : 'rgba(255,77,106,0.06)',
  priceFormat: { type: 'volume' },
  priceScaleId: '', // overlay scale
});
```

## SL / TP Price Lines
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

## Bidirectional Sync (Chart ↔ Table)

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

## `BacktestAnnotatedChart`

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

## `BacktestTradeTable`
Standard `DataTable` plus:
- `rowRefs = useRef<Record<string, HTMLTableRowElement>>({})` for chart-driven scroll.
- Selected row visual highlight (left accent border + bg).
- Columns: `#`, Direction badge, Entry Time/Price, Exit Time/Price, SL, TP1, TP2, Legs hit (TP1✓ TP2✓ RUNNER✓), P&L, R-multiple, Duration.
- Legs hit: small colored dots showing which legs closed at profit vs stop.

## Required Backend Data Shape

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

## Marker Computation

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

## Marker Hover Tooltip
TV has no native marker tooltip — implement custom floating one:

```typescript
chart.subscribeCrosshairMove((param) => {
  if (!param.point || !param.time) return setHoveredMarker(null);
  const m = markers.find((x) => x.time === param.time);
  if (m) setHoveredMarker({ tradeId: m.id, x: param.point.x, y: param.point.y });
});
```

Render `<TradeMarkerTooltip>` absolutely positioned in chart container. Show: Direction, Entry→Exit price, P&L, legs hit.

## UX Rules for Chart Overlay
- Markers always visible — no toggle in v1. Density is a feature.
- Clicking empty chart space deselects trade (clears price lines + band).
- Multiple trades on same candle: TV stacks markers — tooltip resolves correct trade.
- Zoom: TV manages — markers follow candles automatically.
- Time zone: backend epoch ms UTC → divide by 1000 for TV's `UTCTimestamp`. Configure TV `localization: { timeFormatter }` for user TZ or UTC explicitly.
- Do NOT draw custom canvas overlays — only `setMarkers` + `createPriceLine` to stay compatible w/ TV's renderer.
- 1000+ candles, 200+ trades must not jank — memoize `buildTradeMarkers`, call `setMarkers` only when trade data changes.
