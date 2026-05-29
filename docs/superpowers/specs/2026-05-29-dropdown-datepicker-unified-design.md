# Dropdown & Date Picker — Unified Design

**Date:** 2026-05-29
**Status:** Approved
**Scope:** `blackridge-frontend` — all overlay surfaces (Select, DropdownMenu, Popover-based pickers, DatePicker)

---

## Problem

Six styling inconsistencies exist across dropdown and date picker surfaces:

1. **Invisible popover backgrounds** — `shadcn/ui` defaults (`bg-popover` = `#191d27`) are nearly identical to `--bg-elevated` (`#171b22`). Open dropdowns blend into the page.
2. **Three token naming conventions** — `border-bd-subtle` (shorthand alias), `border-[var(--border-default)]` (explicit var), and `border-input` (shadcn semantic) all coexist.
3. **Inconsistent focus rings** — `ring-1 ring-[var(--accent-primary)]` (SymbolPicker) vs `ring-2 ring-ring` (Select, DatePicker). Two different widths, two different colors.
4. **Disabled opacity mismatch** — `opacity-50` in some components, `opacity-60` in DatePicker.
5. **DatePicker trigger height** — `h-9` must be added at every callsite to match surrounding inputs; not baked into the component.
6. **Native `<select>` elements unstyled** — month/year pickers in the DatePicker calendar use browser-default appearance, inconsistent with the rest of the UI.

---

## Design

### Token Standard

One canonical token mapping applies to every overlay surface (popover background, dropdown menu, calendar panel):

| Surface | Token |
|---|---|
| Background | `bg-[var(--bg-overlay)]` → `#1e232c` |
| Border | `border-[var(--border-default)]` |
| Shadow | `shadow-[var(--shadow-float)]` |
| Focus ring | `ring-1 ring-[var(--accent-primary)]` (1px, accent blue) |
| Item hover | `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]` |
| Item selected | `bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]` |
| Disabled opacity | `opacity-50` |
| Trigger height | `h-9` baked into DatePicker trigger |

`--bg-overlay` (`#1e232c`) sits visibly above `--bg-elevated` (`#171b22`) and `--bg-surface` (`#151920`), providing clear z-layer hierarchy.

### Component Changes

#### `src/components/ui/select.tsx`

- `SelectContent`: replace `bg-popover text-popover-foreground` → `bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)]`
- `SelectTrigger`: replace `ring-ring ring-offset-background focus:ring-2` → `focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]`
- `SelectItem`: replace `focus:bg-accent focus:text-accent-foreground` → `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`

#### `src/components/ui/dropdown-menu.tsx`

- `DropdownMenuContent` / `DropdownMenuSubContent`: replace `bg-popover text-popover-foreground` → `bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)]`
- `DropdownMenuItem` / `DropdownMenuCheckboxItem` / `DropdownMenuRadioItem`: replace `focus:bg-accent focus:text-accent-foreground` → `hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`
- Destructive item variant: keep `text-destructive` color; update hover state to match.

#### `src/components/ui/date-picker.tsx`

- **Trigger**: bake `h-9` into the button className so callsites no longer need it.
- **PopoverContent**: unify to `bg-[var(--bg-overlay)] border-[var(--border-default)] shadow-[var(--shadow-float)]`.
- **Token names**: replace all `border-bd-*` and `bg-bg-*` shorthand aliases with explicit `var(--border-*)` / `var(--bg-*)` forms to match the rest of the codebase.
- **Native `<select>` (month/year)**: add `bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] font-mono text-[11px] rounded px-1.5 py-0.5` — styled with design tokens, appearance kept native.
- **Disabled opacity**: change `opacity-60` → `opacity-50`.

#### `src/components/ui/dropdown-content.tsx` *(new file)*

A thin wrapper over `PopoverContent` with the canonical overlay tokens baked in. For use by new code; existing callsites are not required to migrate immediately.

```tsx
import { PopoverContent, PopoverContentProps } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DropdownContent({ className, ...props }: PopoverContentProps) {
  return (
    <PopoverContent
      className={cn(
        'bg-[var(--bg-overlay)] border-[var(--border-default)]',
        'shadow-[var(--shadow-float)] p-1.5',
        className,
      )}
      {...props}
    />
  );
}
```

Existing `SymbolPicker.tsx` already uses the correct tokens directly on `PopoverContent` — leave it as-is.

### What Does Not Change

- `SymbolPicker.tsx` — already correct after the earlier fix; no changes.
- `popover.tsx` — the primitive stays unstyled (correct shadcn pattern); styling happens at the content layer.
- Trigger styling for Select and DropdownMenu — `bg-transparent border-input` is appropriate; triggers sit on page background, not as overlay surfaces.
- Any existing callsite that passes `h-9` to DatePicker — the baked-in class uses the same value so there's no visual change and no breaking diff.

---

## Files

| File | Action |
|---|---|
| `src/components/ui/select.tsx` | Edit — swap tokens |
| `src/components/ui/dropdown-menu.tsx` | Edit — swap tokens |
| `src/components/ui/date-picker.tsx` | Edit — h-9, token names, native select, opacity |
| `src/components/ui/dropdown-content.tsx` | New — DropdownContent wrapper |

---

## Testing

- Open every page that uses a Select, DropdownMenu, or DatePicker and confirm overlays are visibly elevated above the page.
- Tab to each trigger and confirm focus ring is 1px accent blue.
- Open DatePicker calendar and confirm month/year selects are styled.
- Confirm DatePicker trigger aligns with adjacent inputs without explicit `h-9` at the callsite.
- No new TypeScript errors (`pnpm tsc --noEmit`).
- No lint errors (`pnpm lint`).
