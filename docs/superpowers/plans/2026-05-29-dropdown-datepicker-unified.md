# Dropdown & Date Picker — Unified Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch four UI component files so every dropdown overlay surface uses a consistent set of design tokens — visible elevation, unified border/shadow/focus ring — and bake `h-9` into the DatePicker trigger so callsites don't need to pass it.

**Architecture:** Pure class-string swaps in the four `src/components/ui/` primitive files. No new state, no new hooks. A new thin wrapper `DropdownContent` is added for future code. The existing `SymbolPicker` is already correct and is not touched.

**Tech Stack:** Next.js 14, Tailwind v3, shadcn/ui (Radix primitives), CSS custom properties (`var(--*)` tokens defined in `globals.css`).

---

## File Map

| File | Action |
|---|---|
| `src/components/ui/select.tsx` | Edit — swap `bg-popover`/`shadow-md`/`focus:ring-ring`/`focus:bg-accent` |
| `src/components/ui/dropdown-menu.tsx` | Edit — same token swap on content + all item focus states |
| `src/components/ui/date-picker.tsx` | Edit — trigger h-9, PopoverContent tokens, native select style, alias cleanup |
| `src/components/ui/dropdown-content.tsx` | New — thin DropdownContent wrapper |
| `src/components/backtest/BacktestConfigForm.tsx` | Edit — remove now-redundant `h-9` from two DatePicker callsites |

---

### Task 1: Patch `select.tsx`

**Files:**
- Modify: `src/components/ui/select.tsx`

Three token swaps: focus ring on the trigger, background/border/shadow on the content panel, hover state on items.

- [ ] **Step 1: Apply the SelectTrigger focus ring change**

In `SelectTrigger` (line 22), replace `focus:ring-1 focus:ring-ring` with `focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]`.

The full className string after the change:

```tsx
className={cn(
  'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1',
  className,
)}
```

- [ ] **Step 2: Apply the SelectContent token swap**

In `SelectContent` (line 71), replace `border bg-popover text-popover-foreground shadow-md` with `border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-[var(--shadow-float)]`.

The full className string after the change:

```tsx
className={cn(
  'relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] origin-[--radix-select-content-transform-origin] overflow-y-auto overflow-x-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-[var(--shadow-float)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  position === 'popper' &&
    'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
  className,
)}
```

- [ ] **Step 3: Apply the SelectItem hover state swap**

In `SelectItem` (line 114), replace `focus:bg-accent focus:text-accent-foreground` with `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`.

The full className string after the change:

```tsx
className={cn(
  'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  className,
)}
```

- [ ] **Step 4: Apply the SelectSeparator color swap**

In `SelectSeparator` (line 135), replace `bg-muted` with `bg-[var(--border-subtle)]`.

```tsx
className={cn('-mx-1 my-1 h-px bg-[var(--border-subtle)]', className)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "style(ui): unify Select tokens — overlay bg, focus ring, item hover"
```

---

### Task 2: Patch `dropdown-menu.tsx`

**Files:**
- Modify: `src/components/ui/dropdown-menu.tsx`

Six token swaps across the content panels and all item focus states.

- [ ] **Step 1: Patch DropdownMenuSubTrigger focus state**

In `DropdownMenuSubTrigger` (line 30), replace `focus:bg-accent data-[state=open]:bg-accent` with `hover:bg-[var(--bg-hover)] data-[state=open]:bg-[var(--bg-hover)]`.

```tsx
className={cn(
  'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--bg-hover)] data-[state=open]:bg-[var(--bg-hover)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  inset && 'pl-8',
  className,
)}
```

- [ ] **Step 2: Patch DropdownMenuSubContent background/border/shadow**

In `DropdownMenuSubContent` (line 49), replace `border bg-popover p-1 text-popover-foreground shadow-lg` with `border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-[var(--shadow-float)]`.

```tsx
className={cn(
  'z-50 min-w-[8rem] origin-[--radix-dropdown-menu-content-transform-origin] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] p-1 text-[var(--text-primary)] shadow-[var(--shadow-float)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  className,
)}
```

- [ ] **Step 3: Patch DropdownMenuContent background/border/shadow**

In `DropdownMenuContent` (lines 66–67), replace `border bg-popover p-1 text-popover-foreground shadow-md` with `border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-[var(--shadow-float)]`.

```tsx
className={cn(
  'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] p-1 text-[var(--text-primary)] shadow-[var(--shadow-float)]',
  'origin-[--radix-dropdown-menu-content-transform-origin] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  className,
)}
```

- [ ] **Step 4: Patch DropdownMenuItem hover state**

In `DropdownMenuItem` (line 85), replace `focus:bg-accent focus:text-accent-foreground` with `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`.

```tsx
className={cn(
  'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
  inset && 'pl-8',
  className,
)}
```

- [ ] **Step 5: Patch DropdownMenuCheckboxItem and DropdownMenuRadioItem hover states**

In `DropdownMenuCheckboxItem` (line 101) and `DropdownMenuRadioItem` (line 123), replace `focus:bg-accent focus:text-accent-foreground` with `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`.

`DropdownMenuCheckboxItem`:
```tsx
className={cn(
  'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  className,
)}
```

`DropdownMenuRadioItem`:
```tsx
className={cn(
  'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  className,
)}
```

- [ ] **Step 6: Patch DropdownMenuSeparator color**

In `DropdownMenuSeparator` (line 159), replace `bg-muted` with `bg-[var(--border-subtle)]`.

```tsx
className={cn('-mx-1 my-1 h-px bg-[var(--border-subtle)]', className)}
```

- [ ] **Step 7: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "style(ui): unify DropdownMenu tokens — overlay bg, item hover states"
```

---

### Task 3: Patch `date-picker.tsx`

**Files:**
- Modify: `src/components/ui/date-picker.tsx`

Five changes: trigger (replace `mm-input`, bake h-9, fix opacity), PopoverContent tokens, nav button aliases, native select styling, footer border alias.

- [ ] **Step 1: Replace the trigger className (mm-input → design tokens + h-9)**

The current trigger `className` prop (lines 95–99):

```tsx
className={cn(
  'mm-input group inline-flex items-center justify-between gap-2 text-left font-mono',
  'disabled:cursor-not-allowed disabled:opacity-60',
  !selected && 'text-text-muted',
  className,
)}
```

Replace with:

```tsx
className={cn(
  'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--border-default)] bg-transparent px-3 text-left font-mono text-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
  !selected && 'text-[var(--text-muted)]',
  className,
)}
```

- [ ] **Step 2: Fix the clear button hover aliases in the trigger**

In the clear button span (line 119), replace `hover:bg-bg-hover hover:text-text-primary` with explicit vars:

```tsx
className="rounded-sm p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
```

- [ ] **Step 3: Fix the PopoverContent className**

Line 129:

```tsx
// Before
className="w-auto rounded-md border-bd-default bg-bg-base p-3 shadow-panel"

// After
className="w-auto rounded-md border-[var(--border-default)] bg-[var(--bg-overlay)] p-3 shadow-[var(--shadow-float)]"
```

- [ ] **Step 4: Fix the nav buttons (prev/next month)**

Both nav buttons (lines 134–136 and 179–181) share the same class string. Replace in both places:

```tsx
// Before
className="rounded-sm border border-bd-subtle bg-bg-surface p-1 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"

// After
className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
```

- [ ] **Step 5: Fix the native month and year selects**

Both `<select>` elements (lines 143 and 160) share the same class string. Replace in both places:

```tsx
// Before
className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"

// After
className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
```

- [ ] **Step 6: Fix the footer separator alias**

Line 225:

```tsx
// Before
className="mt-2 flex items-center justify-between gap-2 border-t border-bd-subtle pt-2 font-mono text-[10px] uppercase tracking-wider"

// After
className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 font-mono text-[10px] uppercase tracking-wider"
```

- [ ] **Step 7: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/date-picker.tsx
git commit -m "style(ui): unify DatePicker — h-9 trigger, overlay tokens, native select style"
```

---

### Task 4: Create `dropdown-content.tsx`

**Files:**
- Create: `src/components/ui/dropdown-content.tsx`

A thin wrapper over `PopoverContent` with the canonical overlay tokens baked in. Future code uses this instead of raw `PopoverContent` so tokens never need to be repeated.

- [ ] **Step 1: Create the file**

```tsx
'use client';

import * as React from 'react';
import { PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DropdownContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  DropdownContentProps
>(({ className, ...props }, ref) => (
  <PopoverContent
    ref={ref}
    className={cn(
      'bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)] p-1.5',
      className,
    )}
    {...props}
  />
));
DropdownContent.displayName = 'DropdownContent';
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dropdown-content.tsx
git commit -m "feat(ui): add DropdownContent wrapper with canonical overlay tokens"
```

---

### Task 5: Remove redundant `h-9` from BacktestConfigForm callsites

**Files:**
- Modify: `src/components/backtest/BacktestConfigForm.tsx` (lines 589, 593)

Now that `h-9` is baked into the DatePicker trigger, the two explicit overrides in `BacktestConfigForm.tsx` are redundant. Remove `className="h-9"` from both.

- [ ] **Step 1: Remove `className="h-9"` from both DatePicker usages**

Line 589 — before:
```tsx
<DatePicker value={fromDate} onChange={setFromDate} max={toDate} className="h-9" />
```
After:
```tsx
<DatePicker value={fromDate} onChange={setFromDate} max={toDate} />
```

Line 593 — before:
```tsx
<DatePicker value={toDate} onChange={setToDate} min={fromDate} className="h-9" />
```
After:
```tsx
<DatePicker value={toDate} onChange={setToDate} min={fromDate} />
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/backtest/BacktestConfigForm.tsx
git commit -m "style(backtest): remove redundant h-9 from DatePicker callsites"
```

---

## Manual Verification Checklist

After all tasks are complete, open the running dev server (`pnpm dev`) and verify:

- [ ] **Select dropdowns** — open any interval/strategy Select (e.g. Backtest page). Content panel is visibly elevated above the page background. Focus ring on the trigger is thin (1px) accent blue.
- [ ] **DropdownMenu** — open any actions dropdown. Content panel is visibly elevated. Items highlight on hover, not only on keyboard focus.
- [ ] **DatePicker trigger** — open Backtest Config form. The from/to date pickers sit at the same height as adjacent text inputs without any `h-9` override.
- [ ] **DatePicker calendar** — open any DatePicker. Month/year `<select>` elements are styled (dark bg, themed border). Calendar panel is visibly elevated from the page.
- [ ] **SymbolPicker** — open the chart symbol picker. Confirm it still works correctly (no changes made; this is a regression check).
- [ ] **No TypeScript errors:** `pnpm tsc --noEmit`
- [ ] **No lint errors:** `pnpm lint`
