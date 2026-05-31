# Paper Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Run backtest" and "Apply to strategy" buttons to the research paper detail page, each opening a dialog that uses the paper's best-iteration params.

**Architecture:** A single new `PaperActionButtons` component holds both buttons and both dialogs (run + apply). The component is passed the full `PaperDetail` object and returns `null` when no best iteration exists. "Run backtest" calls `useCreateBacktestRun` with the paper's params as `strategyParamOverrides` then navigates to `/backtest`. "Apply to strategy" calls `createStrategyParam` with `activate: true` to create + activate a preset in one round-trip.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · TanStack Query `useMutation` · shadcn `Dialog` · `useStrategies` hook · `useCreateBacktestRun` hook · `createStrategyParam` API

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `src/components/research/papers/PaperActionButtons.tsx` |
| **Modify** | `src/app/(dashboard)/research/papers/[id]/page.tsx` |

---

### Task 1: PaperActionButtons component

**Files:**
- Create: `src/components/research/papers/PaperActionButtons.tsx`

#### Context you need before starting

- `PaperDetail` lives in `src/types/papers.ts`. `paper.best_iteration` is `BestIteration | Record<string, never>`. `BestIteration.params` is `Record<string, unknown>` — the full best-iteration param set. `paper.metadata` has `strategy_code`, `instrument`, `interval_name`.
- `AccountStrategy` lives in `src/types/strategy.ts`. Fields used here: `id`, `strategyCode`, `symbol`, `interval`, `presetName`, `allowLong`, `allowShort`.
- `BacktestRunPayload` lives in `src/types/backtest.ts`. `accountStrategyId` is NOT NULL in the DB — must always be set.
- `useStrategies()` from `src/hooks/useStrategies.ts` → `{ data: AccountStrategy[] | undefined, isLoading }`.
- `useCreateBacktestRun()` from `src/hooks/useBacktest.ts` → TanStack `useMutation` wrapping `createBacktestRun`. Returns `{ mutateAsync, isPending }`.
- `createStrategyParam(request)` from `src/lib/api/strategy-params.ts`. Request shape: `{ accountStrategyId: string; name: string; overrides: Record<string, unknown>; activate?: boolean }`. Returns a `StrategyParamPreset`.
- `toast.success({ title, description? })` and `toast.error({ title, description? })` from `src/hooks/useToast.ts` (called as `toast.xxx`, not as a hook).
- `normalizeError(err)` from `src/lib/api/client.ts` — returns a human-readable string from an Axios error.
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `src/components/ui/dialog`.

- [ ] **Step 1: Create the file**

Create `src/components/research/papers/PaperActionButtons.tsx` with the following complete content:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2, Settings2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStrategies } from '@/hooks/useStrategies';
import { useCreateBacktestRun } from '@/hooks/useBacktest';
import { createStrategyParam } from '@/lib/api/strategy-params';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { BestIteration, PaperDetail } from '@/types/papers';
import type { AccountStrategy } from '@/types/strategy';
import type { BacktestRunPayload } from '@/types/backtest';

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

const TODAY = new Date().toISOString().slice(0, 10);
const TWO_YEARS_AGO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
})();

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

interface PaperActionButtonsProps {
  paper: PaperDetail;
}

export function PaperActionButtons({ paper }: PaperActionButtonsProps) {
  const [runOpen, setRunOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;

  if (!best) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setRunOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-info)] transition-colors hover:bg-[var(--color-info)]/20"
      >
        <FlaskConical size={13} strokeWidth={1.75} />
        Run backtest
      </button>
      <button
        type="button"
        onClick={() => setApplyOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <Settings2 size={13} strokeWidth={1.75} />
        Apply to strategy
      </button>

      <RunBacktestDialog
        open={runOpen}
        paper={paper}
        best={best}
        onClose={() => setRunOpen(false)}
      />
      <ApplyParamsDialog
        open={applyOpen}
        paper={paper}
        best={best}
        onClose={() => setApplyOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared: strategy selector (filters by strategyCode)
// ---------------------------------------------------------------------------

interface StrategySelectorProps {
  strategyCode: string;
  value: string;
  onChange: (id: string) => void;
}

function StrategySelector({ strategyCode, value, onChange }: StrategySelectorProps) {
  const { data: all = [], isLoading } = useStrategies();
  const matching: AccountStrategy[] = all.filter((s) => s.strategyCode === strategyCode);

  if (isLoading) {
    return (
      <div
        className="h-9 animate-pulse rounded-sm"
        style={{ background: 'var(--bg-hover)' }}
      />
    );
  }

  if (!matching.length) {
    return (
      <p className="text-[11px] text-text-muted">
        No strategies with code{' '}
        <span className="font-mono">{strategyCode}</span> found. Create one on
        the Strategies page first.
      </p>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
    >
      <option value="">Pick a strategy…</option>
      {matching.map((s) => (
        <option key={s.id} value={s.id}>
          {s.presetName} — {s.symbol} {s.interval}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Run backtest dialog
// ---------------------------------------------------------------------------

interface RunBacktestDialogProps {
  open: boolean;
  paper: PaperDetail;
  best: BestIteration;
  onClose: () => void;
}

function RunBacktestDialog({ open, paper, best, onClose }: RunBacktestDialogProps) {
  const router = useRouter();
  const meta = paper.metadata;
  const { data: all = [] } = useStrategies();
  const { mutateAsync: createRun, isPending } = useCreateBacktestRun();

  const [strategyId, setStrategyId] = useState('');
  const [fromDate, setFromDate] = useState(TWO_YEARS_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [capital, setCapital] = useState('10000');

  async function handleSubmit() {
    const strategy = all.find((s) => s.id === strategyId);
    if (!strategy) {
      toast.error({ title: 'Pick a strategy first' });
      return;
    }
    const payload: BacktestRunPayload = {
      accountStrategyId: strategy.id,
      strategyAccountStrategyIds: { [meta.strategy_code]: strategy.id },
      strategyCodes: [meta.strategy_code],
      asset: meta.instrument,
      interval: meta.interval_name,
      startTime: `${fromDate}T00:00:00`,
      endTime: `${toDate}T00:00:00`,
      initialCapital: Number(capital) || 10_000,
      riskPerTradePct: 0.9,
      feeRate: 0.00075,
      slippageRate: 0,
      minNotional: 7,
      minQty: 0.000001,
      qtyStep: 0.000001,
      maxOpenPositions: 1,
      allowLong: strategy.allowLong,
      allowShort: strategy.allowShort,
      strategyParamOverrides: { [meta.strategy_code]: best.params },
    };
    try {
      await createRun(payload);
      toast.success({ title: 'Backtest queued', description: 'Redirecting to backtest list…' });
      onClose();
      router.push('/backtest');
    } catch (err) {
      toast.error({ title: 'Launch failed', description: normalizeError(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run backtest from paper</DialogTitle>
          <DialogDescription>
            Uses the best-iteration params from this paper as overrides.{' '}
            <span className="font-mono">
              {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field label="Account strategy">
            <StrategySelector
              strategyCode={meta.strategy_code}
              value={strategyId}
              onChange={setStrategyId}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Initial capital (USDT)">
            <input
              type="number"
              value={capital}
              min={100}
              step={100}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </Field>

          <div className="rounded-sm border border-bd-subtle bg-bg-base p-3">
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Param overrides ({Object.keys(best.params).length})
            </p>
            <div className="max-h-28 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[10px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[10px] tabular-nums text-text-primary">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-info)] hover:bg-[var(--color-info)]/20 disabled:opacity-50"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Queue backtest
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Apply params dialog
// ---------------------------------------------------------------------------

interface ApplyParamsDialogProps {
  open: boolean;
  paper: PaperDetail;
  best: BestIteration;
  onClose: () => void;
}

function ApplyParamsDialog({ open, paper, best, onClose }: ApplyParamsDialogProps) {
  const meta = paper.metadata;
  const queryClient = useQueryClient();
  const [strategyId, setStrategyId] = useState('');

  const { mutate: applyParams, isPending } = useMutation({
    mutationFn: (accountStrategyId: string) =>
      createStrategyParam({
        accountStrategyId,
        name: `Paper ${paper.paper_id.slice(0, 8)} — best params`,
        overrides: best.params,
        activate: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      toast.success({
        title: 'Params applied',
        description: 'Best-iteration params saved and activated as a new preset.',
      });
      onClose();
    },
    onError: (err) => {
      toast.error({ title: 'Apply failed', description: normalizeError(err) });
    },
  });

  function handleSubmit() {
    if (!strategyId) {
      toast.error({ title: 'Pick a strategy first' });
      return;
    }
    applyParams(strategyId);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply params to strategy</DialogTitle>
          <DialogDescription>
            Creates a new param preset from the best-iteration params and activates it on the
            selected strategy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field label="Account strategy">
            <StrategySelector
              strategyCode={meta.strategy_code}
              value={strategyId}
              onChange={setStrategyId}
            />
          </Field>

          <div className="rounded-sm border border-bd-subtle bg-bg-base p-3">
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Params to apply ({Object.keys(best.params).length})
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {Object.entries(best.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-mono text-[10px] text-text-secondary">{k}</span>
                  <span className="font-mono text-[10px] tabular-nums text-text-primary">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-text-muted">
            The selected strategy&apos;s current preset will be deactivated. You can re-activate the
            previous preset from the Strategies page at any time.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !strategyId}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--color-profit)]/30 bg-[var(--color-profit)]/10 px-3 py-2 text-[12px] font-semibold text-[var(--color-profit)] hover:bg-[var(--color-profit)]/20 disabled:opacity-50"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Apply params
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Field layout helper
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:\Project\blackridge-frontend
pnpm tsc --noEmit 2>&1 | grep -i "PaperActionButtons\|papers/\[id\]"
```

Expected: no errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/research/papers/PaperActionButtons.tsx
git commit -m "feat(papers): add PaperActionButtons with run-backtest + apply-params dialogs"
```

---

### Task 2: Wire PaperActionButtons into the paper detail page

**Files:**
- Modify: `src/app/(dashboard)/research/papers/[id]/page.tsx` — add import + mount in top bar

#### Context

The top bar in `PaperPage` is at approximately line 533–545:

```tsx
{/* Top bar */}
<div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
  <Link href="/research/papers" ...>
    <ArrowLeft size={12} /> Research library
  </Link>
  <div className="flex items-center gap-2">
    <RegenerateButton paperId={id} queueId={paper.queue_id} currentVersion={paper.version} />
    <ExportButtons paperId={id} />
  </div>
</div>
```

`paper` (the full `PaperDetail`) is already available in scope. The `PaperActionButtons` component handles the `!best` guard internally and returns `null` when no best iteration exists, so no wrapping conditional is needed here.

- [ ] **Step 1: Add the import**

In `src/app/(dashboard)/research/papers/[id]/page.tsx`, add the import alongside the other paper component imports (around line 9–11):

```tsx
import { ExportButtons } from '@/components/research/papers/ExportButtons';
import { PaperActionButtons } from '@/components/research/papers/PaperActionButtons';
import { RegenerateButton } from '@/components/research/papers/RegenerateButton';
```

- [ ] **Step 2: Mount the component in the top bar**

Find the existing `<div className="flex items-center gap-2">` that holds `RegenerateButton` and `ExportButtons`. Add `<PaperActionButtons paper={paper} />` as the first child:

```tsx
<div className="flex items-center gap-2">
  <PaperActionButtons paper={paper} />
  <RegenerateButton paperId={id} queueId={paper.queue_id} currentVersion={paper.version} />
  <ExportButtons paperId={id} />
</div>
```

- [ ] **Step 3: Typecheck the full project**

```bash
cd C:\Project\blackridge-frontend
pnpm tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Build**

```bash
cd C:\Project\blackridge-frontend
pnpm exec next build --no-lint 2>&1 | tail -20
```

Expected: build completes, `/research/papers/[id]` appears in the route list as `ƒ (Dynamic)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(dashboard)"/research/papers/"[id]"/page.tsx
git commit -m "feat(papers): wire PaperActionButtons into paper detail top bar"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ "Run backtest" button — `RunBacktestDialog` calls `createBacktestRun` with paper params as `strategyParamOverrides`
- ✅ "Apply to strategy" button — `ApplyParamsDialog` calls `createStrategyParam` with `activate: true`
- ✅ Strategy picker filtered by `strategyCode` — `StrategySelector` filters `all.filter(s => s.strategyCode === strategyCode)`
- ✅ Empty state when no matching strategies — shown in `StrategySelector`
- ✅ No button rendered when paper has no best iteration — `hasBestIter` guard + `return null`
- ✅ Loading + error feedback — `toast.success` / `toast.error` + `isPending` spinner
- ✅ Navigation to `/backtest` after run queued — `router.push('/backtest')` in `handleSubmit`
- ✅ Query invalidation after apply — `queryClient.invalidateQueries({ queryKey: ['strategies'] })`

**Placeholder scan:** None found.

**Type consistency:**
- `hasBestIter` defined in `PaperActionButtons.tsx` — does NOT conflict with the copy in `page.tsx` (they are in separate modules, each file defines its own local copy).
- `BacktestRunPayload.strategyParamOverrides` is `Record<string, Record<string, unknown>>` — we pass `{ [meta.strategy_code]: best.params }` where `best.params` is `Record<string, unknown>` ✅
- `StrategyParamCreateRequest.overrides` is `Record<string, unknown>` — we pass `best.params` which is `Record<string, unknown>` ✅
- `BacktestRunPayload.asset` maps to `meta.instrument` (paper's instrument field) ✅
- `BacktestRunPayload.interval` maps to `meta.interval_name` ✅
