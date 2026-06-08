# Backtest Chart Technical Indicators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, TradingView-style, individually-toggleable technical-indicator layer (EMA20/50/200, Bollinger, Keltner overlays + RSI/MACD/ATR/ADX oscillator panes) to the backtest trade chart and the market chart, fed by accurate backend feature-store values.

**Architecture:** Extract a shared indicator layer (`indicatorConfig` + `useChartIndicators` + `IndicatorBar` + `useChartIndicatorSeries` + `fetchIndicatorsRange`/`useBacktestIndicators`) consumed by both `BacktestAnnotatedChart` and `CandlestickChart`. Data comes from the existing `/api/v1/market/indicators` endpoint scoped to the backtest's `symbol/interval/start→end`. Purely additive; default off.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, lightweight-charts ^5.1.0, TanStack Query, Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-08-backtest-chart-indicators-design.md`
**Branch:** `feat/backtest-chart-indicators`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/market.ts` | `IndicatorData` (exists) + new `ChartIndicators` superset type | Modify |
| `src/lib/charts/indicatorConfig.ts` | Single source of truth: indicator list, labels, groups, colors, series spec | Create |
| `src/lib/api/market.ts` | add `fetchIndicatorsRange(symbol, interval, fromMs, toMs)` | Modify |
| `src/hooks/useBacktestIndicators.ts` | TanStack Query hook over the range endpoint, lazy-enabled | Create |
| `src/hooks/useChartIndicators.ts` | toggle state + localStorage persistence | Create |
| `src/components/charts/IndicatorBar.tsx` | shared on/off toggle bar | Create |
| `src/lib/charts/useChartIndicatorSeries.ts` | renders overlay lines + oscillator panes onto a TV chart | Create |
| `src/components/backtest/BacktestAnnotatedChart.tsx` | accept `features`/`showIndicators`, call renderer | Modify |
| `src/app/(dashboard)/backtest/[id]/page.tsx` | wire hooks + `IndicatorBar` + pass features | Modify |
| `src/components/charts/CandlestickChart.tsx` | replace inline indicator logic with the shared renderer | Modify |
| `src/app/(dashboard)/market/page.tsx` | replace inline `IndicatorBar`/persistence with shared modules | Modify |

---

## Task 1: `ChartIndicators` type + `indicatorConfig`

**Files:**
- Modify: `src/types/market.ts`
- Create: `src/lib/charts/indicatorConfig.ts`
- Test: `src/lib/charts/__tests__/indicatorConfig.test.ts`

- [ ] **Step 1: Add the `ChartIndicators` superset type** to `src/types/market.ts` (after `IndicatorData`):

```typescript
/** Active-state flags for every supported chart indicator. */
export interface ChartIndicators {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  bollingerBands: boolean;
  keltnerChannel: boolean;
  rsi: boolean;
  macd: boolean;
  atr: boolean;
  adx: boolean;
}

export type ChartIndicatorKey = keyof ChartIndicators;
```

- [ ] **Step 2: Write the failing test** `src/lib/charts/__tests__/indicatorConfig.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { INDICATORS, OVERLAY_KEYS, OSCILLATOR_KEYS, DEFAULT_INDICATORS } from '../indicatorConfig';

describe('indicatorConfig', () => {
  it('covers all ChartIndicators keys exactly once', () => {
    const keys = INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(
      ['adx', 'atr', 'bollingerBands', 'ema20', 'ema50', 'ema200', 'keltnerChannel', 'macd', 'rsi'].sort(),
    );
  });
  it('partitions into overlay and oscillator groups', () => {
    expect(OVERLAY_KEYS).toEqual(expect.arrayContaining(['ema20', 'ema50', 'ema200', 'bollingerBands', 'keltnerChannel']));
    expect(OSCILLATOR_KEYS).toEqual(expect.arrayContaining(['rsi', 'macd', 'atr', 'adx']));
    expect(OVERLAY_KEYS.some((k) => OSCILLATOR_KEYS.includes(k))).toBe(false);
  });
  it('defaults every indicator to off', () => {
    expect(Object.values(DEFAULT_INDICATORS).every((v) => v === false)).toBe(true);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** — `pnpm vitest run src/lib/charts/__tests__/indicatorConfig.test.ts` → fails "Cannot find module '../indicatorConfig'".

- [ ] **Step 4: Create `src/lib/charts/indicatorConfig.ts`:**

```typescript
import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';

export type IndicatorGroup = 'overlay' | 'oscillator';

export interface IndicatorDef {
  key: ChartIndicatorKey;
  label: string;
  group: IndicatorGroup;
  /** Primary colour for the toggle pill + main line. */
  color: string;
}

export const INDICATORS: readonly IndicatorDef[] = [
  { key: 'ema20', label: 'EMA 20', group: 'overlay', color: '#3B82F6' },
  { key: 'ema50', label: 'EMA 50', group: 'overlay', color: '#F5A623' },
  { key: 'ema200', label: 'EMA 200', group: 'overlay', color: '#A855F7' },
  { key: 'bollingerBands', label: 'Bollinger', group: 'overlay', color: '#8892A4' },
  { key: 'keltnerChannel', label: 'Keltner', group: 'overlay', color: '#22D3EE' },
  { key: 'rsi', label: 'RSI', group: 'oscillator', color: '#EC4899' },
  { key: 'macd', label: 'MACD', group: 'oscillator', color: '#34D399' },
  { key: 'atr', label: 'ATR', group: 'oscillator', color: '#FBBF24' },
  { key: 'adx', label: 'ADX', group: 'oscillator', color: '#60A5FA' },
] as const;

export const OVERLAY_KEYS = INDICATORS.filter((i) => i.group === 'overlay').map((i) => i.key);
export const OSCILLATOR_KEYS = INDICATORS.filter((i) => i.group === 'oscillator').map((i) => i.key);

export const DEFAULT_INDICATORS: ChartIndicators = {
  ema20: false, ema50: false, ema200: false, bollingerBands: false,
  keltnerChannel: false, rsi: false, macd: false, atr: false, adx: false,
};
```

- [ ] **Step 5: Run test, expect PASS.** `pnpm vitest run src/lib/charts/__tests__/indicatorConfig.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/types/market.ts src/lib/charts/indicatorConfig.ts src/lib/charts/__tests__/indicatorConfig.test.ts
git commit -m "feat(charts): ChartIndicators type + shared indicatorConfig"
```

---

## Task 2: `fetchIndicatorsRange` + `useBacktestIndicators`

**Files:**
- Modify: `src/lib/api/market.ts`
- Create: `src/hooks/useBacktestIndicators.ts`
- Test: `src/lib/api/__tests__/market.indicators.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/api/__tests__/market.indicators.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import { fetchIndicatorsRange } from '../market';

vi.mock('../client', () => ({ apiClient: { get: vi.fn() } }));

describe('fetchIndicatorsRange', () => {
  beforeEach(() => vi.clearAllMocks());
  it('calls the indicators endpoint with the explicit from/to window (ms)', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [
      { time: 1704067200, ema20: 100, rsi: 55 },
    ]});
    const out = await fetchIndicatorsRange('BTCUSDT', '1d', 1704067200000, 1717804800000);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/market/indicators', {
      params: { symbol: 'BTCUSDT', interval: '1d', from: 1704067200000, to: 1717804800000 },
    });
    expect(out[0]).toMatchObject({ time: 1704067200, ema20: 100, rsi: 55, ema50: null });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (`fetchIndicatorsRange` not exported).

- [ ] **Step 3: Implement `fetchIndicatorsRange` in `src/lib/api/market.ts`.** Refactor the existing `fetchIndicators` to delegate, to keep one mapper (DRY). Replace the existing `fetchIndicators` function body with:

```typescript
/** Map a backend indicator row → IndicatorData (shared by both fetchers). */
function mapIndicator(d: BackendIndicator): IndicatorData {
  return {
    time: resolveTimeSec(d),
    ema20: d.ema20 ?? null, ema50: d.ema50 ?? null, ema200: d.ema200 ?? null,
    bbUpper: d.bbUpper ?? null, bbMiddle: d.bbMiddle ?? null, bbLower: d.bbLower ?? null,
    kcUpper: d.kcUpper ?? null, kcMiddle: d.kcMiddle ?? null, kcLower: d.kcLower ?? null,
    rsi: d.rsi ?? null, macd: d.macd ?? null, macdSignal: d.macdSignal ?? null,
    macdHistogram: d.macdHistogram ?? null, atr: d.atr ?? null, adx: d.adx ?? null,
  };
}

export async function fetchIndicatorsRange(
  symbol: string, interval: string, fromMs: number, toMs: number,
): Promise<IndicatorData[]> {
  const { data } = await apiClient.get<BackendIndicator[]>('/api/v1/market/indicators', {
    params: { symbol, interval, from: fromMs, to: toMs },
  });
  return data.map(mapIndicator).filter((d) => Number.isFinite(d.time)).sort((a, b) => a.time - b.time);
}

export async function fetchIndicators(
  symbol: string, interval: string, count: number,
): Promise<IndicatorData[]> {
  const to = Date.now();
  const from = to - count * (INTERVAL_SECONDS[interval] ?? 3_600) * 1_000;
  return fetchIndicatorsRange(symbol, interval, from, to);
}
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Create `src/hooks/useBacktestIndicators.ts`:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchIndicatorsRange } from '@/lib/api/market';

/**
 * Indicator series for a backtest's exact window. Lazy: only fetches when at
 * least one indicator is active (`enabled`). Times are TV seconds.
 */
export function useBacktestIndicators(
  symbol: string | undefined,
  interval: string | undefined,
  fromMs: number | undefined,
  toMs: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['backtest', 'indicators', symbol, interval, fromMs, toMs],
    queryFn: () => fetchIndicatorsRange(symbol as string, interval as string, fromMs as number, toMs as number),
    enabled: enabled && !!symbol && !!interval && fromMs != null && toMs != null,
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/market.ts src/hooks/useBacktestIndicators.ts src/lib/api/__tests__/market.indicators.test.ts
git commit -m "feat(charts): fetchIndicatorsRange + useBacktestIndicators (run-scoped, lazy)"
```

---

## Task 3: `useChartIndicators` (toggle state + persistence)

**Files:**
- Create: `src/hooks/useChartIndicators.ts`
- Test: `src/hooks/__tests__/useChartIndicators.test.ts`

- [ ] **Step 1: Write failing test** `src/hooks/__tests__/useChartIndicators.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartIndicators } from '../useChartIndicators';

describe('useChartIndicators', () => {
  beforeEach(() => localStorage.clear());
  it('starts all-off and toggles a key', () => {
    const { result } = renderHook(() => useChartIndicators('test:key'));
    expect(result.current.indicators.rsi).toBe(false);
    act(() => result.current.toggle('rsi'));
    expect(result.current.indicators.rsi).toBe(true);
    expect(result.current.anyActive).toBe(true);
  });
  it('persists to localStorage and rehydrates', () => {
    const { result, unmount } = renderHook(() => useChartIndicators('test:key'));
    act(() => result.current.toggle('ema20'));
    unmount();
    const { result: r2 } = renderHook(() => useChartIndicators('test:key'));
    expect(r2.current.indicators.ema20).toBe(true);
  });
  it('ignores unknown keys from stale storage', () => {
    localStorage.setItem('test:key', JSON.stringify({ ema20: true, bogus: true }));
    const { result } = renderHook(() => useChartIndicators('test:key'));
    expect(result.current.indicators.ema20).toBe(true);
    expect((result.current.indicators as Record<string, boolean>).bogus).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Create `src/hooks/useChartIndicators.ts`:**

```typescript
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';

function load(key: string): ChartIndicators {
  if (typeof window === 'undefined') return { ...DEFAULT_INDICATORS };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_INDICATORS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...DEFAULT_INDICATORS };
    for (const k of Object.keys(next) as ChartIndicatorKey[]) {
      if (typeof parsed[k] === 'boolean') next[k] = parsed[k] as boolean;
    }
    return next;
  } catch {
    return { ...DEFAULT_INDICATORS };
  }
}

export function useChartIndicators(storageKey: string) {
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);

  // Rehydrate on mount (SSR-safe: avoids hydration mismatch by reading after mount).
  useEffect(() => { setIndicators(load(storageKey)); }, [storageKey]);

  const toggle = useCallback((key: ChartIndicatorKey) => {
    setIndicators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const anyActive = Object.values(indicators).some(Boolean);
  return { indicators, toggle, anyActive };
}
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useChartIndicators.ts src/hooks/__tests__/useChartIndicators.test.ts
git commit -m "feat(charts): useChartIndicators toggle+persistence hook"
```

---

## Task 4: `IndicatorBar` shared toggle component

**Files:**
- Create: `src/components/charts/IndicatorBar.tsx`
- Test: `src/components/charts/__tests__/IndicatorBar.test.tsx`

- [ ] **Step 1: Write failing test** `src/components/charts/__tests__/IndicatorBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndicatorBar } from '../IndicatorBar';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';

describe('IndicatorBar', () => {
  it('renders a pill per indicator and fires onToggle with the key', () => {
    const onToggle = vi.fn();
    render(<IndicatorBar indicators={DEFAULT_INDICATORS} onToggle={onToggle} />);
    const ema20 = screen.getByRole('button', { name: /EMA 20/i });
    expect(ema20).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ema20);
    expect(onToggle).toHaveBeenCalledWith('ema20');
  });
  it('marks active indicators as pressed', () => {
    render(<IndicatorBar indicators={{ ...DEFAULT_INDICATORS, rsi: true }} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /RSI/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Create `src/components/charts/IndicatorBar.tsx`:**

```typescript
'use client';
import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';
import { INDICATORS } from '@/lib/charts/indicatorConfig';

interface IndicatorBarProps {
  indicators: ChartIndicators;
  onToggle: (key: ChartIndicatorKey) => void;
}

export function IndicatorBar({ indicators, onToggle }: IndicatorBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2" role="group" aria-label="Chart indicators">
      {INDICATORS.map((ind) => {
        const active = indicators[ind.key];
        return (
          <button
            key={ind.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(ind.key)}
            className={[
              'rounded px-2 py-0.5 text-[11px] font-mono border transition-colors',
              active
                ? 'border-transparent text-black'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
            style={active ? { backgroundColor: ind.color } : undefined}
          >
            {ind.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/IndicatorBar.tsx src/components/charts/__tests__/IndicatorBar.test.tsx
git commit -m "feat(charts): shared IndicatorBar toggle component"
```

---

## Task 5: `useChartIndicatorSeries` renderer

**Files:**
- Create: `src/lib/charts/useChartIndicatorSeries.ts`
- Test: `src/lib/charts/__tests__/useChartIndicatorSeries.test.ts`

This hook is given a (already-created) TV chart + the loaded `lightweight-charts` module + `features` + active flags, and reconciles the indicator series. It owns ONLY indicator series — never the candle series. Overlay lines attach to the main pane (paneIndex 0); each active oscillator gets its own pane via `chart.addPane()` (v5). Pure series add/update/remove keyed by indicator; toggling one indicator never rebuilds others.

- [ ] **Step 1: Write failing test** (logic-only: a fake chart records series lifecycle) `src/lib/charts/__tests__/useChartIndicatorSeries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reconcileIndicatorSeries, type IndicatorSeriesState } from '../useChartIndicatorSeries';
import { DEFAULT_INDICATORS } from '../indicatorConfig';
import type { IndicatorData } from '@/types/market';

function fakeTv() {
  const removed: string[] = [];
  const created: string[] = [];
  const paneCount = { n: 1 };
  const chart = {
    addSeries: (_type: unknown, _opts: unknown, paneIndex?: number) => {
      const id = `s${created.length}@${paneIndex ?? 0}`;
      created.push(id);
      return { setData: () => {}, _id: id } as never;
    },
    removeSeries: (s: { _id: string }) => removed.push(s._id),
    addPane: () => ({ paneIndex: () => paneCount.n++ }),
    panes: () => Array.from({ length: paneCount.n }, (_v, i) => ({ paneIndex: () => i })),
  };
  const tv = { LineSeries: 'Line', HistogramSeries: 'Hist', LineStyle: { Dashed: 2, Solid: 0 } };
  return { chart, tv, created, removed };
}

const FEATURES: IndicatorData[] = [
  { time: 1, ema20: 10, ema50: 11, ema200: 12, bbUpper: 13, bbMiddle: 12, bbLower: 11,
    kcUpper: 14, kcMiddle: 12, kcLower: 10, rsi: 55, macd: 1, macdSignal: 0.5,
    macdHistogram: 0.5, atr: 2, adx: 25 },
];

describe('reconcileIndicatorSeries', () => {
  it('creates overlay series on the main pane when toggled on', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: true }, FEATURES);
    expect(created.some((id) => id.endsWith('@0'))).toBe(true);
    expect(state.ema20).toBeTruthy();
  });
  it('removes a series when toggled off', () => {
    const { chart, tv, removed } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: true }, FEATURES);
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, ema20: false }, FEATURES);
    expect(removed.length).toBeGreaterThan(0);
    expect(state.ema20).toBeUndefined();
  });
  it('puts oscillators on a non-zero pane', () => {
    const { chart, tv, created } = fakeTv();
    const state: IndicatorSeriesState = {};
    reconcileIndicatorSeries(chart as never, tv as never, state, { ...DEFAULT_INDICATORS, rsi: true }, FEATURES);
    expect(created.some((id) => !id.endsWith('@0'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Create `src/lib/charts/useChartIndicatorSeries.ts`** with a pure `reconcileIndicatorSeries` core + a thin React hook wrapper:

```typescript
'use client';
import { useEffect } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ChartIndicators, ChartIndicatorKey, IndicatorData } from '@/types/market';
import { INDICATORS } from './indicatorConfig';

type AnySeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;
export type IndicatorSeriesState = Partial<Record<ChartIndicatorKey, AnySeries[]>>;

interface TvLike {
  LineSeries: unknown; HistogramSeries: unknown;
  LineStyle: { Dashed: number; Solid: number };
}

// Each indicator → the IndicatorData fields it draws, as line specs.
const FIELD_MAP: Record<ChartIndicatorKey, Array<{ field: keyof IndicatorData; color: string; dashed?: boolean; histogram?: boolean }>> = {
  ema20: [{ field: 'ema20', color: '#3B82F6' }],
  ema50: [{ field: 'ema50', color: '#F5A623' }],
  ema200: [{ field: 'ema200', color: '#A855F7' }],
  bollingerBands: [
    { field: 'bbUpper', color: '#8892A4', dashed: true },
    { field: 'bbMiddle', color: '#8892A4' },
    { field: 'bbLower', color: '#8892A4', dashed: true },
  ],
  keltnerChannel: [
    { field: 'kcUpper', color: '#22D3EE', dashed: true },
    { field: 'kcLower', color: '#22D3EE', dashed: true },
  ],
  rsi: [{ field: 'rsi', color: '#EC4899' }],
  macd: [
    { field: 'macd', color: '#34D399' },
    { field: 'macdSignal', color: '#F87171' },
    { field: 'macdHistogram', color: '#5B6472', histogram: true },
  ],
  atr: [{ field: 'atr', color: '#FBBF24' }],
  adx: [{ field: 'adx', color: '#60A5FA' }],
};

const GROUP = Object.fromEntries(INDICATORS.map((i) => [i.key, i.group])) as Record<ChartIndicatorKey, 'overlay' | 'oscillator'>;

function lineData(features: IndicatorData[], field: keyof IndicatorData) {
  return features
    .filter((d) => d[field] != null && Number.isFinite(d.time))
    .map((d) => ({ time: d.time as Time, value: d[field] as number }));
}

/** Pure reconciler — add/update/remove indicator series to match `active`. */
export function reconcileIndicatorSeries(
  chart: IChartApi,
  tv: TvLike,
  state: IndicatorSeriesState,
  active: ChartIndicators,
  features: IndicatorData[],
): void {
  for (const def of INDICATORS) {
    const key = def.key;
    const on = active[key];
    if (on) {
      // Oscillators get their own pane; overlays use pane 0.
      let paneIndex = 0;
      if (GROUP[key] === 'oscillator' && !state[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pane = (chart as any).addPane?.() ?? null;
        paneIndex = pane?.paneIndex?.() ?? (chart.panes().length - 1);
      }
      const specs = FIELD_MAP[key];
      if (!state[key]) {
        state[key] = specs.map((spec) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (chart as any).addSeries(
            spec.histogram ? tv.HistogramSeries : tv.LineSeries,
            {
              color: spec.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: GROUP[key] === 'oscillator',
              ...(spec.dashed ? { lineStyle: tv.LineStyle.Dashed } : {}),
            },
            GROUP[key] === 'oscillator' ? paneIndex : 0,
          ),
        );
      }
      state[key]!.forEach((series, i) => series.setData(lineData(features, specs[i].field) as never));
    } else if (state[key]) {
      state[key]!.forEach((series) => {
        try { chart.removeSeries(series); } catch {}
      });
      delete state[key];
    }
  }
}

/** React wrapper: reconciles whenever features or active flags change. */
export function useChartIndicatorSeries(
  chartRef: React.MutableRefObject<IChartApi | null>,
  tvRef: React.MutableRefObject<TvLike | null>,
  stateRef: React.MutableRefObject<IndicatorSeriesState>,
  ready: boolean,
  active: ChartIndicators,
  features: IndicatorData[],
): void {
  useEffect(() => {
    const chart = chartRef.current;
    const tv = tvRef.current;
    if (!ready || !chart || !tv) return;
    reconcileIndicatorSeries(chart, tv, stateRef.current, active, features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, features, active.ema20, active.ema50, active.ema200, active.bollingerBands,
      active.keltnerChannel, active.rsi, active.macd, active.atr, active.adx]);
}
```

> NOTE for implementer: lightweight-charts v5 `addSeries(SeriesType, options, paneIndex?)` supports a pane index; `chart.addPane()` returns an `IPaneApi` with `.paneIndex()`. If the installed v5.1 build's pane API differs, fall back to the synced-subchart pattern already in `CandlestickChart.tsx` (lines ~318-396) for oscillators — keep overlays on pane 0 regardless. Verify against `node_modules/lightweight-charts/dist/typings.d.ts` before implementing Step 3.

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/charts/useChartIndicatorSeries.ts src/lib/charts/__tests__/useChartIndicatorSeries.test.ts
git commit -m "feat(charts): useChartIndicatorSeries renderer (overlays + oscillator panes)"
```

---

## Task 6: Wire `BacktestAnnotatedChart`

**Files:**
- Modify: `src/components/backtest/BacktestAnnotatedChart.tsx`
- Test: `src/components/backtest/__tests__/BacktestAnnotatedChart.indicators.test.tsx`

- [ ] **Step 1: Read** `BacktestAnnotatedChart.tsx` fully to locate (a) the props interface (~line 27), (b) the chart-init effect where `chartRef`/`seriesRef` and the TV module are set (~line 45-195), and (c) the cleanup. Confirm a ref to the loaded `tv` module exists or add one (`tvRef`).

- [ ] **Step 2: Add props** to `BacktestAnnotatedChartProps`:

```typescript
  features?: IndicatorData[];
  showIndicators?: ChartIndicators;
```
Add imports: `import type { ChartIndicators, IndicatorData } from '@/types/market';`, `import { useChartIndicatorSeries, type IndicatorSeriesState } from '@/lib/charts/useChartIndicatorSeries';`, and `useRef`.

- [ ] **Step 3: Add refs** alongside the existing `chartRef`/`seriesRef`:

```typescript
  const tvRef = useRef<{ LineSeries: unknown; HistogramSeries: unknown; LineStyle: { Dashed: number; Solid: number } } | null>(null);
  const indicatorStateRef = useRef<IndicatorSeriesState>({});
```
In the chart-init effect, after `const tv = await import('lightweight-charts');`, set `tvRef.current = tv;`. In cleanup, set `tvRef.current = null; indicatorStateRef.current = {};`.

- [ ] **Step 4: Call the renderer hook** in the component body (after the chart-init effect), passing the existing `ready` flag (BacktestAnnotatedChart already tracks readiness; reuse it):

```typescript
  useChartIndicatorSeries(chartRef, tvRef, indicatorStateRef, ready, showIndicators ?? DEFAULT_INDICATORS, features ?? EMPTY_FEATURES);
```
Add `import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';` and a module-const `const EMPTY_FEATURES: IndicatorData[] = [];`.

- [ ] **Step 5: Write the regression + indicator test** `src/components/backtest/__tests__/BacktestAnnotatedChart.indicators.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BacktestAnnotatedChart } from '../BacktestAnnotatedChart';

// lightweight-charts is dynamically imported; mock it so the chart mounts in jsdom.
vi.mock('lightweight-charts', () => {
  const series = { setData: vi.fn(), setMarkers: vi.fn(), createPriceLine: vi.fn(), removePriceLine: vi.fn() };
  const chart = {
    addSeries: vi.fn(() => series), removeSeries: vi.fn(), addPane: vi.fn(() => ({ paneIndex: () => 1 })),
    panes: vi.fn(() => [{ paneIndex: () => 0 }, { paneIndex: () => 1 }]),
    timeScale: () => ({ fitContent: vi.fn(), subscribeVisibleLogicalRangeChange: vi.fn(), unsubscribeVisibleLogicalRangeChange: vi.fn() }),
    subscribeClick: vi.fn(), unsubscribeClick: vi.fn(), applyOptions: vi.fn(), remove: vi.fn(),
  };
  return { createChart: () => chart, CandlestickSeries: 'C', LineSeries: 'L', HistogramSeries: 'H',
    ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2, Solid: 0 } };
});

describe('BacktestAnnotatedChart indicators', () => {
  const candles = [{ time: 1, open: 1, high: 2, low: 1, close: 1.5 }];
  it('renders without features (regression: no indicators)', () => {
    const { container } = render(<BacktestAnnotatedChart candles={candles} trades={[]} />);
    expect(container).toBeTruthy();
  });
  it('accepts features + showIndicators without throwing', () => {
    const features = [{ time: 1, ema20: 1.4, ema50: null, ema200: null, bbUpper: null, bbMiddle: null,
      bbLower: null, kcUpper: null, kcMiddle: null, kcLower: null, rsi: 55, macd: null, macdSignal: null,
      macdHistogram: null, atr: null, adx: null }];
    const { container } = render(
      <BacktestAnnotatedChart candles={candles} trades={[]} features={features}
        showIndicators={{ ema20: true, ema50: false, ema200: false, bollingerBands: false,
          keltnerChannel: false, rsi: true, macd: false, atr: false, adx: false }} />,
    );
    expect(container).toBeTruthy();
  });
});
```

> NOTE: match the `trades` prop name/shape to the real `BacktestAnnotatedChartProps` (read in Step 1; the example assumes `trades` — adjust if different).

- [ ] **Step 6: Run tests, expect PASS** — `pnpm vitest run src/components/backtest/__tests__/BacktestAnnotatedChart.indicators.test.tsx`. Then `pnpm tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add src/components/backtest/BacktestAnnotatedChart.tsx src/components/backtest/__tests__/BacktestAnnotatedChart.indicators.test.tsx
git commit -m "feat(backtest): indicator overlays/panes in BacktestAnnotatedChart (additive)"
```

---

## Task 7: Wire the backtest detail page

**Files:**
- Modify: `src/app/(dashboard)/backtest/[id]/page.tsx`

- [ ] **Step 1: Read** the page to find: the `runQ`/`useBacktestRun` data (for `symbol`, `interval`, `startTime`, `endTime`), the `candlesQ` usage, and the JSX block around the `<BacktestAnnotatedChart ...>` (~line 350). Confirm the run fields names for symbol/interval/start/end (likely `runQ.data?.asset`, `.interval`, `.startTime`, `.endTime`).

- [ ] **Step 2: Add hooks** near the other hooks in the component:

```typescript
const { indicators, toggle, anyActive } = useChartIndicators('blackheart:backtest-indicators');
const run = runQ.data;
const fromMs = run?.startTime ? new Date(run.startTime).getTime() : undefined;
const toMs = run?.endTime ? new Date(run.endTime).getTime() : undefined;
const indicatorsQ = useBacktestIndicators(run?.asset, run?.interval, fromMs, toMs, anyActive);
```
Imports: `useChartIndicators`, `useBacktestIndicators`, `IndicatorBar`. (Use the real field names confirmed in Step 1.)

- [ ] **Step 3: Render `<IndicatorBar>`** immediately above the `<BacktestAnnotatedChart>` and pass features/flags into the chart:

```tsx
<IndicatorBar indicators={indicators} onToggle={toggle} />
<BacktestAnnotatedChart
  candles={candlesQ.data ?? EMPTY_CANDLES}
  /* ...existing props... */
  features={indicatorsQ.data ?? EMPTY_FEATURES}
  showIndicators={indicators}
/>
```
Add `const EMPTY_FEATURES: IndicatorData[] = [];` near the existing `EMPTY_CANDLES`.

- [ ] **Step 4: Verify** — `pnpm tsc --noEmit` and `pnpm lint`. Manually load `/backtest/<id>` in `pnpm dev`; toggling each pill shows/hides the indicator; default view unchanged.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/backtest/[id]/page.tsx"
git commit -m "feat(backtest): IndicatorBar + run-scoped indicators on backtest detail page"
```

---

## Task 8: Rewire `CandlestickChart` + market page onto shared modules

**Files:**
- Modify: `src/components/charts/CandlestickChart.tsx`
- Modify: `src/app/(dashboard)/market/page.tsx`

- [ ] **Step 1: Refactor `CandlestickChart`** to use `useChartIndicatorSeries` instead of its inline ema/bb/kc/rsi effects (lines ~206-396). Keep the candle-init + candle-data effects. Add `tvRef`/`indicatorStateRef` (set `tvRef.current = tv` in init), and replace the indicator effects with one `useChartIndicatorSeries(chartRef, tvRef, indicatorStateRef, ready, showIndicators ?? DEFAULT_INDICATORS, features ?? [])`. Change `showIndicators` prop type from `CandlestickChartIndicators` to `ChartIndicators`. Remove the now-dead per-indicator refs.

- [ ] **Step 2: Update market page** `src/app/(dashboard)/market/page.tsx`: delete the inline `IndicatorBar` (lines ~189-end of that component) + `INDICATOR_STORAGE_KEY`/`loadIndicators`/`toggleIndicator`/`indicators` state; replace with `const { indicators, toggle, anyActive } = useChartIndicators('blackheart:market-indicators');` and import the shared `IndicatorBar`. Pass `indicators`/`toggle` to `<IndicatorBar>` and `showIndicators={indicators}` to `<CandlestickChart>`. Gate the indicator query with `enabled: anyActive`.

- [ ] **Step 3: Verify** — `pnpm tsc --noEmit`, `pnpm lint`, `pnpm vitest run`. Manually: market page indicators still work and now include EMA200/MACD/ATR/ADX.

- [ ] **Step 4: Commit**

```bash
git add src/components/charts/CandlestickChart.tsx "src/app/(dashboard)/market/page.tsx"
git commit -m "refactor(charts): market chart uses shared indicator layer (gains MACD/ATR/ADX/EMA200)"
```

---

## Task 9: Final verification

- [ ] **Step 1:** `pnpm tsc --noEmit` — clean.
- [ ] **Step 2:** `pnpm lint` — clean.
- [ ] **Step 3:** `pnpm vitest run` — all green.
- [ ] **Step 4:** `pnpm build` — succeeds.
- [ ] **Step 5:** Manual smoke (`pnpm dev`): `/backtest/<id>` — toggle each of the 9 indicators on/off; overlays draw on the candle pane, oscillators in sub-panes; reload persists; trade markers/SL-TP unaffected. `/market` — unchanged behavior + new indicators present.
- [ ] **Step 6:** Open PR `feat/backtest-chart-indicators` → master.

---

## Self-review notes
- **Spec coverage:** full set (Task 1/5), accurate run-scoped data (Task 2), toggles+persistence (Task 3/4), both charts wired (Task 6/7/8), oscillator panes with fallback (Task 5 note), default-off + additive regression (Task 6 test). ✓
- **Out-of-scope** (strategy EMA-100 band, custom periods, volume) intentionally excluded. ✓
- **Type consistency:** `ChartIndicators`/`ChartIndicatorKey` (Task 1) used everywhere; `IndicatorSeriesState`/`reconcileIndicatorSeries` (Task 5) consumed by Task 6/8; `fetchIndicatorsRange` (Task 2) used by Task 2 hook. ✓
- **Risk:** v5 pane API — Task 5 note mandates verifying `typings.d.ts` and provides the synced-subchart fallback.
