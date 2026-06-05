# Account-Type Frontend (TRADING / HEDGING) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend account-type-aware — a TRADING account keeps today's positions/PnL UX; a HEDGING account swaps in allocation/rebalance/BTC-stack/drawdown-vs-buy-hold widgets — via a shared shell + a type-keyed view registry, with self-serve create and a kind-filtered strategy catalog.

**Architecture:** One route tree + existing `useActiveAccount` scoping (shared). A declarative `ACCOUNT_TYPE_VIEW` registry keyed by `accountType` selects dashboard widgets / config form schema / monitor columns / metrics / catalog filter (different). See `docs/superpowers/specs/2026-06-05-account-type-frontend-design.md`.

**Tech Stack:** Next.js 14 App Router, React Query (`@tanstack/react-query`), Zustand (`src/store/accountStore.ts`), shadcn/Radix, react-hook-form + zod, axios. Tests: **vitest** + `@testing-library/react` (`npm run test`), Playwright e2e (`npm run e2e`); gates `npm run typecheck` + `npm run lint`. Mirror existing tests: `src/components/strategy/StrategyParamPresetPanel.test.tsx`, `src/hooks/useLeaderboardStream.test.ts`.

**Backend contract (already landed, branch `feat/account-type-frontend-dtos`):** `accountType` on `GET/POST /accounts`; `strategyKind` + `archetype` on `GET /account-strategies`; bind-time enforcement (400 on mismatch); hedging params via generic `/api/v1/strategy-params`.

**Per-task loop:** write the failing test → run it (red) → implement → `npm run test` + `npm run typecheck` (green) → `npm run lint` → commit.

---

## File structure

**New**
- `src/types/accountType.ts` — `AccountType` union + constants + type guards
- `src/lib/accountType/registry.tsx` — `ACCOUNT_TYPE_VIEW` + `useAccountView()`
- `src/lib/accountType/paramSchemas/ensembleTrend.ts`, `dynamicTilt.ts`, `volManagedTrend.ts` — per-archetype zod schemas + field metadata
- `src/hooks/useCompatibleStrategies.ts` — kind-filtered catalog hook
- `src/components/hedging/AllocationPanel.tsx`, `BtcStackPanel.tsx`, `DrawdownVsBuyHoldPanel.tsx`, `RebalanceHistory.tsx`, `AllocationStatCards.tsx`
- `src/components/account/AccountTypeBadge.tsx`, `AccountTypeSelector.tsx`

**Modified**
- `src/types/account.ts` (+`accountType`), `src/types/strategy.ts` (+`strategyKind`,`archetype`)
- `src/lib/api/accounts.ts` (map `accountType`; send on create), `src/lib/api/strategies.ts` (map `strategyKind`/`archetype`)
- `src/hooks/useAccounts.ts` (expose `accountType` on `activeAccount`)
- `src/components/account/NewAccountDialog.tsx`, `src/components/layout/AccountSwitcher.tsx`
- `src/components/strategy/NewStrategyDialog.tsx`, `src/app/(dashboard)/strategies/[accountStrategyId]/page.tsx`
- `src/app/(dashboard)/page.tsx` (registry-driven widgets), `src/app/(dashboard)/trades/page.tsx` (monitor label/columns)
- `src/app/(dashboard)/settings/page.tsx`, `src/components/admin/StrategyDefinitionDialog.tsx`

---

## Phase 1 — Plumbing (zero visual change for TRADING)

### Task 1.1: AccountType type + guards
**Files:** Create `src/types/accountType.ts`; Test `src/types/accountType.test.ts`
- [ ] **Write the failing test** — `isAccountType('HEDGING')===true`, `isAccountType('x')===false`, `ACCOUNT_TYPES` length 2.
- [ ] **Implement:**
```ts
export type AccountType = 'TRADING' | 'HEDGING';
export const ACCOUNT_TYPES: AccountType[] = ['TRADING', 'HEDGING'];
export const isAccountType = (v: unknown): v is AccountType =>
  v === 'TRADING' || v === 'HEDGING';
export const DEFAULT_ACCOUNT_TYPE: AccountType = 'TRADING';
```
- [ ] `npm run test src/types/accountType.test.ts` green → **commit** `feat(types): AccountType union + guards`.

### Task 1.2: Thread accountType through the account type + API
**Files:** Modify `src/types/account.ts`, `src/lib/api/accounts.ts`; Test `src/lib/api/accounts.test.ts`
- [ ] **Test:** the accounts normalizer maps `BackendAccountSummary.accountType` → `AccountSummary.accountType`, defaulting to `'TRADING'` when absent (legacy rows); `createAccount` payload includes `accountType` when provided.
- [ ] **Implement:** add `accountType: AccountType` to `AccountSummary` (and the backend interface); in the mapper set `accountType: isAccountType(raw.accountType) ? raw.accountType : 'TRADING'`; extend `createAccount(input)` to pass `accountType`.
- [ ] Green + `npm run typecheck` → **commit** `feat(api): map account_type on accounts`.

### Task 1.3: strategyKind + archetype on AccountStrategy
**Files:** Modify `src/types/strategy.ts`, `src/lib/api/strategies.ts`; Test alongside.
- [ ] **Test:** strategy mapper carries `strategyKind` + `archetype` through (default `strategyKind:'TRADING'`, `archetype:'LEGACY_JAVA'` when absent).
- [ ] **Implement:** add `strategyKind: AccountType` + `archetype: string` to `AccountStrategy`; map in `src/lib/api/strategies.ts`.
- [ ] Green → **commit** `feat(api): map strategy_kind + archetype on account-strategies`.

### Task 1.4: Expose accountType on the active-account context
**Files:** Modify `src/hooks/useAccounts.ts`; Test `src/hooks/useAccounts.test.ts`
- [ ] **Test:** `useActiveAccount()` returns `activeAccount.accountType`; for `isAll` the hook also returns `accountsByType` (a `Record<AccountType, AccountSummary[]>`).
- [ ] **Implement:** surface `accountType` (already in the list payload); add a memoized `accountsByType` group for the "All" view.
- [ ] Green → **commit** `feat(hooks): expose accountType + accountsByType`.

### Task 1.5: The view registry (TRADING set = today's components, no-op)
**Files:** Create `src/lib/accountType/registry.tsx`; Test `src/lib/accountType/registry.test.tsx`
- [ ] **Test:** `ACCOUNT_TYPE_VIEW.TRADING.dashboardWidgets` equals the current widget list; `useAccountView()` returns the TRADING view for a TRADING active account, HEDGING for a HEDGING one; falls back to TRADING when `activeAccount` is null.
- [ ] **Implement** the `AccountTypeView` interface + `ACCOUNT_TYPE_VIEW` (TRADING references the existing `StatCards/EquityPanel/PositionsPanel/DailyPnlPanel`; HEDGING widget slots reference placeholders created in Phase 3 — wire them as lazy imports or stubs returning `null` for now) + `useAccountView()` (see spec §4).
- [ ] Green → **commit** `feat(accountType): view registry + useAccountView (TRADING = current, no-op)`.

### Task 1.6: AccountTypeBadge + AccountTypeSelector
**Files:** Create `src/components/account/AccountTypeBadge.tsx`, `AccountTypeSelector.tsx`; Tests alongside.
- [ ] **Test:** `AccountTypeBadge` renders label+icon for each type; `AccountTypeSelector` (segmented control via Radix) calls `onChange` and defaults to `TRADING`.
- [ ] **Implement** both as small presentational components (reuse `components/ui` + `lucide-react`).
- [ ] Green → **commit** `feat(account): AccountTypeBadge + AccountTypeSelector`.

### Task 1.7: Wire selector into create + badge into switcher
**Files:** Modify `src/components/account/NewAccountDialog.tsx`, `src/components/layout/AccountSwitcher.tsx`; Tests alongside.
- [ ] **Test:** submitting `NewAccountDialog` with HEDGING selected sends `accountType:'HEDGING'`; the dialog copy notes the type is permanent; `AccountSwitcher` shows the badge for the active account.
- [ ] **Implement:** add `AccountTypeSelector` to the create form (RHF field, default TRADING) + a "type can't be changed later" hint; render `AccountTypeBadge` in the switcher and account list rows.
- [ ] Green + `npm run lint` → **commit** `feat(account): self-serve account-type on create + switcher badge`.

> **Phase 1 acceptance:** TRADING accounts look/behave identically (registry no-op); a HEDGING account can be created and is visibly tagged. `npm run typecheck && npm run test` green.

---

## Phase 2 — Kind-filtered catalog + hedging config forms

### Task 2.1: useCompatibleStrategies
**Files:** Create `src/hooks/useCompatibleStrategies.ts`; Test alongside.
- [ ] **Test:** given the active account type, returns only definitions whose `strategyKind` matches; for `isAll` returns all (callers section by type).
- [ ] **Implement:** wrap `useAllVisibleStrategies()` / the definition catalog, filter by `useAccountView().catalogFilter`.
- [ ] Green → **commit** `feat(hooks): useCompatibleStrategies (kind-filtered catalog)`.

### Task 2.2: Per-archetype param schemas
**Files:** Create `src/lib/accountType/paramSchemas/ensembleTrend.ts`, `dynamicTilt.ts`, `volManagedTrend.ts`, `index.ts`; Tests alongside.
- [ ] **Test:** `paramSchemaFor('ensemble_trend')` yields fields `erThreshold, deadband, maxWeight, priceBand` with correct zod ranges + defaults; unknown archetype → null.
- [ ] **Implement:** each schema as `{ fields: FieldMeta[], zod: ZodSchema }` (FieldMeta = `{key,label,type,min,max,step,default}`); `index.ts` maps archetype → schema. Values write to/read from the generic `/api/v1/strategy-params` `param_overrides`.
- [ ] Green → **commit** `feat(accountType): hedging per-archetype param schemas`.

### Task 2.3: Strategy picker + binding-config forms switch by kind
**Files:** Modify `src/components/strategy/NewStrategyDialog.tsx`, `src/app/(dashboard)/strategies/[accountStrategyId]/page.tsx`; Tests alongside.
- [ ] **Test:** under a HEDGING account the picker only lists hedging definitions; the binding-config form renders the hedging schema (no sides/maxOpenPositions) for an `ensemble_trend` binding, and the trading schema for an LSR binding; a bind 400 surfaces the validator message inline.
- [ ] **Implement:** swap the picker source to `useCompatibleStrategies`; render the config form from `paramSchemaFor(strategy.archetype)` for hedging archetypes, falling back to the existing LSR/VCB/VBO editors for trading. Reuse the existing strategy-params save path (`StrategyParamPresetPanel` pattern).
- [ ] Green + lint → **commit** `feat(strategy): kind-filtered picker + hedging binding-config form`.

> **Phase 2 acceptance:** a HEDGING account can bind a hedging strategy and edit its params; TRADING picker/forms unchanged.

---

## Phase 3 — Hedging monitoring widgets

### Task 3.1: Data hooks for hedging monitoring
**Files:** Create `src/hooks/useAllocation.ts`, `useRebalances.ts`; Tests alongside.
- [ ] **Test:** `useAllocation(accountId)` derives `{btcWeightPct, cashWeightPct, targetWeightPct, btcStack}` from balances/equity + the active binding; `useRebalances(accountId)` maps `trade_history` close-and-reopen rows to `{time, fromWeight, toWeight, reason, realizedDelta}`.
- [ ] **Implement** both as React Query hooks over existing reads (balances/equity + `/api/v1/trades` filtered to the account). Keep keys account-scoped.
- [ ] Green → **commit** `feat(hooks): allocation + rebalance hedging data`.

### Task 3.2: Hedging widgets
**Files:** Create `src/components/hedging/{AllocationStatCards,AllocationPanel,BtcStackPanel,DrawdownVsBuyHoldPanel,RebalanceHistory}.tsx`; Tests alongside.
- [ ] **Test (per widget):** renders from a mocked hook fixture — AllocationPanel shows BTC% vs cash% vs target band; BtcStackPanel plots stack× vs flat 1.00; DrawdownVsBuyHold overlays strategy DD vs BTC buy-hold DD; RebalanceHistory lists the events; empty-state when no active hedging strategy.
- [ ] **Implement** with Recharts (match `DailyPnlPanel`/`EquityPanel`) + `components/ui`.
- [ ] Green → **commit** `feat(hedging): allocation/stack/drawdown/rebalance widgets`.

### Task 3.3: Register hedging widgets + Rebalances monitor
**Files:** Modify `src/lib/accountType/registry.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/trades/page.tsx`; Tests alongside.
- [ ] **Test:** dashboard home under a HEDGING account renders the hedging widget set (registry); the monitor page shows "Rebalances" with `REBALANCE_COLUMNS` for hedging, "Trades" for trading.
- [ ] **Implement:** replace the hardcoded widget list in `page.tsx` with `useAccountView().dashboardWidgets.map(...)`; drive the trades/monitor page header + columns from `useAccountView().monitorRoute`. Point the HEDGING registry slots at the Task 3.2 components.
- [ ] Green + lint → **commit** `feat(hedging): registry-driven dashboard + Rebalances view`.

> **Phase 3 acceptance:** a HEDGING account's dashboard shows allocation/stack/drawdown + a rebalance log; TRADING dashboard byte-identical.

---

## Phase 4 — Settings, "All" sectioning, admin, polish

### Task 4.1: Type-specific settings sections
**Files:** Modify `src/app/(dashboard)/settings/page.tsx`; Tests alongside.
- [ ] **Test:** TRADING settings show concurrency caps + vol-targeting; HEDGING settings show allocation caps + rebalance deadband + kill-DD.
- [ ] **Implement:** render `useAccountView().settingsSections`. (HEDGING risk fields map to the binding's strategy-params / account risk-config as available; stub fields that need new backend with a disabled "coming soon" note rather than a fake control.)
- [ ] Green → **commit** `feat(settings): account-type-specific risk sections`.

### Task 4.2: "All accounts" sections by type
**Files:** Modify `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/strategies/page.tsx`; Tests alongside.
- [ ] **Test:** with one TRADING + one HEDGING account and the "All" selection, the dashboard + strategies pages render a Trading section and a Hedging section, each using its own view.
- [ ] **Implement:** when `isAll`, `groupBy(accountsByType)` and render each group with its type's view; single-type "All" collapses to one section (no visual change for existing single-type users).
- [ ] Green → **commit** `feat(dashboard): per-type sections in the All view`.

### Task 4.3: Admin strategy_kind picker
**Files:** Modify `src/components/admin/StrategyDefinitionDialog.tsx`, `src/app/(dashboard)/admin/strategies/page.tsx`; Tests alongside.
- [ ] **Test:** the definition create/edit dialog has a `strategy_kind` selector (TRADING/HEDGING) sent to `POST/PATCH /strategy-definitions`; the catalog table shows a kind column.
- [ ] **Implement:** add the field (the definition API already accepts `strategyKind` per `8c1b06a`) + a table column/badge.
- [ ] Green + lint → **commit** `feat(admin): strategy_kind picker on definition catalog`.

### Task 4.4: E2E happy path
**Files:** Create `e2e/account-type.spec.ts`.
- [ ] **Implement** Playwright flow: create HEDGING account → bind `ensemble_trend` → set params → see AllocationPanel → see RebalanceHistory empty-state. Run `npm run e2e`.
- [ ] **commit** `test(e2e): hedging account create→bind→monitor`.

> **Phase 4 acceptance:** full account-type UX end-to-end; mixed "All" view sections cleanly; admin can register hedging definitions.

---

## Final review (after all phases)
- [ ] `npm run typecheck && npm run lint && npm run test && npm run e2e` all green.
- [ ] Dispatch a code-review pass over the diff (registry usage consistent, no leftover `if (hedging)` conditionals outside the registry, TRADING surfaces unchanged).
- [ ] Use superpowers:finishing-a-development-branch.

## Self-review notes
- Spec coverage: every spec §5 surface maps to a task (create→1.7, switcher→1.7, catalog→2.3, config→2.3, dashboard→3.3, rebalances→3.3, settings→4.1, admin→4.3, All-sectioning→4.2). ✓
- Type consistency: `AccountType` used everywhere; `accountType` (account) vs `strategyKind` (strategy) names kept distinct, matching the backend DTOs. ✓
- No placeholders: HEDGING widget slots are explicitly stubbed-returning-null in P1 and filled in P3 (sequenced, not hand-waved). Settings fields needing new backend are disabled "coming soon", not faked. ✓
