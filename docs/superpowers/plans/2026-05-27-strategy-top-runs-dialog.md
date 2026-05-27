# Strategy Top Runs Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Top runs" button to each owned strategy card on the strategy list page that opens a dialog showing the top 5 completed backtest runs for that strategy (by ag90), with expandable rows revealing param overrides.

**Architecture:** New `useTopRunsForStrategy` hook wraps the existing `listBacktestRuns` API with client-side filtering (2-year window + PF > 1.0) and sorting (ag90 desc). A new `StrategyTopRunsDialog` component renders the ranked table. A single dialog instance is shared across all cards via `topRunsTarget: AccountStrategy | null` state in the page component.

**Tech Stack:** React, TanStack Query (`useQuery`), shadcn `Dialog`, `date-fns`, Tailwind CSS + CSS variables, TypeScript strict.

---

## File Map

| Action | File |
|---|---|
| Modify | `src/hooks/useBacktest.ts` — add `useTopRunsForStrategy` |
| Create | `src/components/strategy/StrategyTopRunsDialog.tsx` |
| Modify | `src/app/(dashboard)/strategies/page.tsx` — add prop + button + mount dialog |

---

## Task 1: Add `useTopRunsForStrategy` hook

**Files:**
- Modify: `src/hooks/useBacktest.ts`

- [ ] **Step 1: Add the hook at the bottom of `useBacktest.ts`**

Add after the last export in the file. The hook calls `listBacktestRuns` via `useQuery` directly (not via `useBacktestRuns`) so it can accept an `enabled` flag that suppresses queries while the dialog is closed.

```typescript
export function useTopRunsForStrategy(
  strategyCode: string,
  symbol: string,
  interval: string,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: ['top-runs', strategyCode, symbol, interval],
    queryFn: () =>
      listBacktestRuns({
        status: 'COMPLETED',
        strategyCode,
        symbol,
        interval,
        size: 50,
        sortBy: 'createdAt',
        sortDir: 'DESC',
      }),
    enabled: enabled && Boolean(strategyCode) && Boolean(symbol) && Boolean(interval),
    staleTime: 60_000,
  });

  const topRuns = useMemo(() => {
    if (!query.data) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 2);
    const cutoffStr = cutoff.toISOString();
    return query.data.content
      .filter((r) => {
        if (!r.metrics) return false;
        if ((r.metrics.profitFactor ?? 0) <= 1.0) return false;
        return r.fromDate <= cutoffStr;
      })
      .sort((a, b) => {
        const ag90A =
          a.metrics?.geometricReturnPctAtAlloc90 ?? a.metrics?.totalReturnPct ?? -Infinity;
        const ag90B =
          b.metrics?.geometricReturnPctAtAlloc90 ?? b.metrics?.totalReturnPct ?? -Infinity;
        return ag90B - ag90A;
      })
      .slice(0, 5);
  }, [query.data]);

  return { topRuns, isLoading: query.isLoading, isError: query.isError };
}
```

`useMemo` is already imported at the top of `useBacktest.ts`. Verify it's in the import list; if not, add it to the `import { useEffect, useMemo, useRef }` line.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new hook.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Project/blackridge-frontend" add src/hooks/useBacktest.ts
git -C "C:/Project/blackridge-frontend" commit -m "feat(backtest): add useTopRunsForStrategy hook"
```

---

## Task 2: Create `StrategyTopRunsDialog` component

**Files:**
- Create: `src/components/strategy/StrategyTopRunsDialog.tsx`

- [ ] **Step 1: Create the file with the full component**

```typescript
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopRunsForStrategy } from '@/hooks/useBacktest';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';
import type { BacktestRun } from '@/types/backtest';

interface StrategyTopRunsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
}

export function StrategyTopRunsDialog({
  open,
  onOpenChange,
  strategy,
}: StrategyTopRunsDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { topRuns, isLoading, isError } = useTopRunsForStrategy(
    strategy?.strategyCode ?? '',
    strategy?.symbol ?? '',
    strategy?.interval ?? '',
    { enabled: open && strategy != null },
  );

  if (!strategy) return null;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const cutoffLabel = format(twoYearsAgo, 'MMM yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-bd bg-bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-[15px]">Top backtest results</DialogTitle>
          <DialogDescription className="font-mono text-[12px]">
            {strategy.strategyCode} · {strategy.symbol} · {strategy.interval}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1">
          {isLoading && <LoadingRows />}

          {!isLoading && isError && (
            <p className="py-6 text-center text-[12px] text-[var(--color-loss)]">
              Could not load backtest history. Please try again.
            </p>
          )}

          {!isLoading && !isError && topRuns.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[12px] text-text-secondary">
                No completed backtests covering 2+ years found for{' '}
                <span className="font-mono text-text-primary">
                  {strategy.strategyCode} · {strategy.symbol} · {strategy.interval}
                </span>
                .
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Run a backtest with a start date of {cutoffLabel} or earlier to build the ranking.
              </p>
            </div>
          )}

          {!isLoading && !isError && topRuns.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['#', 'Period', 'ag90', 'Sharpe', 'PF', 'Max DD', 'Params', ''].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'pb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted',
                        h === 'ag90' || h === 'Sharpe' || h === 'PF' || h === 'Max DD'
                          ? 'text-right'
                          : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRuns.map((run, idx) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    rank={idx + 1}
                    strategyCode={strategy.strategyCode}
                    expanded={expandedId === run.id}
                    onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function RunRow({
  run,
  rank,
  strategyCode,
  expanded,
  onToggle,
}: {
  run: BacktestRun;
  rank: number;
  strategyCode: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { metrics, fromDate, toDate, paramSnapshot } = run;
  const ag90 = metrics?.geometricReturnPctAtAlloc90 ?? null;
  const sharpe = metrics?.sharpe ?? null;
  const pf = metrics?.profitFactor ?? null;
  const maxDD = metrics?.maxDrawdownPct ?? null;

  const overrides = (paramSnapshot?.[strategyCode] as Record<string, unknown>) ?? {};
  const overrideCount = Object.keys(overrides).length;

  const periodLabel = `${format(new Date(fromDate), 'MMM yyyy')} – ${format(new Date(toDate), 'MMM yyyy')}`;

  const ag90Color =
    ag90 === null
      ? 'var(--text-muted)'
      : ag90 >= 20
        ? 'var(--color-profit)'
        : ag90 < 0
          ? 'var(--color-loss)'
          : 'var(--text-primary)';

  return (
    <>
      <tr
        className="cursor-pointer border-b border-[var(--border-subtle)]/50 transition-colors hover:bg-[var(--bg-hover)]"
        onClick={onToggle}
      >
        <td className="py-3 pr-3 font-mono text-[11px] text-text-muted">#{rank}</td>
        <td className="py-3 pr-4 font-mono text-[11px] text-text-secondary">{periodLabel}</td>
        <td
          className="py-3 pr-3 text-right font-mono text-[11px] font-semibold tabular-nums"
          style={{ color: ag90Color }}
        >
          {ag90 !== null ? `${ag90 >= 0 ? '+' : ''}${ag90.toFixed(1)}%` : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[11px] tabular-nums text-text-secondary">
          {sharpe !== null ? sharpe.toFixed(2) : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[11px] tabular-nums text-text-secondary">
          {pf !== null ? pf.toFixed(2) : '—'}
        </td>
        <td className="py-3 pr-3 text-right font-mono text-[11px] tabular-nums text-text-secondary">
          {maxDD !== null ? `${maxDD.toFixed(0)}%` : '—'}
        </td>
        <td className="py-3 pr-3 font-mono text-[11px] text-text-muted">
          {overrideCount > 0
            ? `${overrideCount} override${overrideCount !== 1 ? 's' : ''}`
            : 'Defaults'}
        </td>
        <td className="py-3 text-text-muted">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="pb-3 pt-0">
            <ParamDetail overrides={overrides} />
          </td>
        </tr>
      )}
    </>
  );
}

function ParamDetail({ overrides }: { overrides: Record<string, unknown> }) {
  const entries = Object.entries(overrides);
  if (entries.length === 0) {
    return (
      <div className="rounded-md bg-[var(--bg-base)] px-4 py-3 text-[11px] text-text-muted">
        Default parameters — no overrides applied.
      </div>
    );
  }
  return (
    <div className="rounded-md bg-[var(--bg-base)] px-4 py-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] text-text-muted">{key}</span>
            <span className="font-mono text-[11px] tabular-nums text-text-primary">
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Project/blackridge-frontend" add src/components/strategy/StrategyTopRunsDialog.tsx
git -C "C:/Project/blackridge-frontend" commit -m "feat(strategy): add StrategyTopRunsDialog component"
```

---

## Task 3: Wire trigger button and dialog into strategies page

**Files:**
- Modify: `src/app/(dashboard)/strategies/page.tsx`

This task has three sub-steps: (A) add `onTopRuns` prop to `StrategyCard` + `IntervalGroupSortable`, (B) add the trigger button inside `StrategyCard`, (C) add page-level state + mount the dialog.

- [ ] **Step 1: Add `onTopRuns` to `StrategyCard` interface and body**

In the `StrategyCard` component (around line 112), add `onTopRuns` to the props interface:

```typescript
// Add to the interface block after onSwitchToLive:
onTopRuns: (s: AccountStrategy) => void;
```

Destructure it in the function signature:

```typescript
// Add to the destructured props after onSwitchToLive:
onTopRuns,
```

Then add the "Top runs" button inside the bottom action row (`!isReadOnlyPublic` block, around line 333). Place it between the status pill and the Start/Switch menu — replace the existing `<div className="-mt-2 flex items-center justify-between gap-3 border-t pt-3" ...>` block with:

```tsx
{!isReadOnlyPublic && (
  <div
    className="-mt-2 flex items-center justify-between gap-3 border-t pt-3"
    style={{ borderColor: 'var(--mm-hair-2)' }}
  >
    {isRunning ? (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{
          color: isPaper ? 'var(--color-warning)' : 'var(--color-profit)',
          backgroundColor: isPaper ? 'rgba(245,166,35,0.12)' : 'rgba(22,179,100,0.12)',
        }}
      >
        <Radio size={11} className={isLive ? 'animate-pulse' : ''} />
        {groupHasOtherPreset ? 'Active preset' : 'Running'} · {isPaper ? 'paper' : 'live'}
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Inactive
      </span>
    )}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTopRuns(strategy);
        }}
        className="inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 text-[11px] text-text-secondary transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-text-primary"
      >
        <TrendingUp size={11} strokeWidth={1.75} />
        Top runs
      </button>
      {isRunning ? (
        <SwitchModeButton
          strategy={strategy}
          onSwitchToPaper={onSwitchToPaper}
          onSwitchToLive={onSwitchToLive}
          isPending={isActivating || isPromoting}
        />
      ) : (
        <StartStrategyMenu
          strategy={strategy}
          onStartAsPaper={onStartAsPaper}
          onStartAsLive={onStartAsLive}
          isPending={isActivating || isPromoting}
        />
      )}
    </div>
  </div>
)}
```

Add `TrendingUp` to the lucide-react import at the top of the file:

```typescript
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Radio,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
```

- [ ] **Step 2: Thread `onTopRuns` through `IntervalGroupSortable`**

Add `onTopRuns` to `IntervalGroupSortable`'s props interface (around line 725):

```typescript
onTopRuns: (s: AccountStrategy) => void;
```

Destructure it in the function signature and pass it through to each `<StrategyCard>`:

```typescript
// In IntervalGroupSortable destructured props:
onTopRuns,

// In each <StrategyCard> inside IntervalGroupSortable (around line 777):
onTopRuns={onTopRuns}
```

For `PublicStrategiesSection`, add `onTopRuns` to its interface, destructure it, and pass it to each StrategyCard there too:

```typescript
// PublicStrategiesSection interface:
onTopRuns: (s: AccountStrategy) => void;

// In PublicStrategiesSection's StrategyCard usages, add:
onTopRuns={onTopRuns}
```

In the `PublicStrategiesSection` call site in the main page, pass `noop` initially (will be replaced in Step 3).

- [ ] **Step 3: Add page state, import dialog, mount it**

In `StrategiesPage` (around line 931), add the new state and import:

Add to imports at top of file:
```typescript
import { StrategyTopRunsDialog } from '@/components/strategy/StrategyTopRunsDialog';
```

Add state in `StrategiesPage` after the existing dialog states:
```typescript
const [topRunsTarget, setTopRunsTarget] = useState<AccountStrategy | null>(null);
```

Add handler:
```typescript
const handleTopRuns = (strategy: AccountStrategy) => setTopRunsTarget(strategy);
```

Pass `onTopRuns={handleTopRuns}` to each `<IntervalGroupSortable>` usage and `onTopRuns={handleTopRuns}` to `<PublicStrategiesSection>`.

Mount the dialog once at the bottom of the JSX, alongside the other dialogs:
```tsx
<StrategyTopRunsDialog
  open={topRunsTarget != null}
  onOpenChange={(open) => { if (!open) setTopRunsTarget(null); }}
  strategy={topRunsTarget}
/>
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Project/blackridge-frontend" add src/app/"(dashboard)"/strategies/page.tsx
git -C "C:/Project/blackridge-frontend" commit -m "feat(strategy): wire Top runs button and dialog into strategy list page"
```

---

## Task 4: Push and deploy

- [ ] **Step 1: Push to origin master**

```bash
git -C "C:/Project/blackridge-frontend" push origin master
```

- [ ] **Step 2: Verify CI picks up the build**

Check that the container on the VPS updates (CI auto-deploys on push to master based on prior deploy behaviour). The new "Top runs" button should appear on each owned strategy card.
