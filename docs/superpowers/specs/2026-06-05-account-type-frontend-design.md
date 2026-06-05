# Account-Type Frontend (TRADING / HEDGING) — Design Spec

> **Date:** 2026-06-05 · **Repo:** `blackridge-frontend` (Next.js 14 App Router, React Query, Zustand, shadcn/Radix, react-hook-form+zod, axios)
> **Backend:** Blackheart trading-engine. Taxonomy ships in V153 (`accounts.account_type`, `strategy_definition.strategy_kind` ∈ {TRADING, HEDGING}) with bind-time enforcement. DTO contract additions landed on branch `feat/account-type-frontend-dtos`.

## 1. Goal

Each user account is exactly one **type** — `TRADING` (entry/exit position strategies) or `HEDGING` (spot allocation/tilt strategies). The two have a **shared lifecycle** (create account → bind a compatible strategy → set sizing → enable/simulate → activate → monitor) but **different management surfaces** (a TRADING account shows positions/trades/PnL; a HEDGING account shows allocation/rebalances/BTC-stack/drawdown-vs-buy-hold). There will be **several hedging strategies** (`dynamic_tilt`, `vol_managed_trend`, `ensemble_trend`, more to come). A user may hold **both** a trading and a hedging account.

This spec defines how the frontend becomes account-type-aware without forking the app.

## 2. Architecture decision

**Chosen: shared shell + a type-keyed *view registry*.** One route tree and one account-scoping mechanism (`useActiveAccount`/`scopedAccountId`); the active account's `accountType` selects — via a declarative registry — the dashboard widgets, the strategy-config form schema, the monitoring columns, the metric set, the catalog filter, and terminology. Components read the registry instead of hardcoding `if (hedging)`.

- **Rejected A — scattered conditionals:** matches today's `status`/`ownedByCurrentUser` idiom but becomes unmaintainable as the hedging UX diverges and hedging strategies multiply.
- **Rejected B — separate `/trading/*` vs `/hedging/*` route trees:** clean isolation but duplicates the shared shell and the bind lifecycle.
- **Chosen C** keeps the existing scoping/lifecycle (similar) and isolates the variance in one place (different), which is exactly the "different and similar" requirement and scales as hedging strategies grow.

> **Similar = the shell** — routing, `useActiveAccount` scoping, the bind lifecycle, settings, switcher, account create.
> **Different = the views** — declared per `accountType` in the registry, consumed everywhere.

## 3. Data model

```ts
// src/types/accountType.ts (new)
export type AccountType = 'TRADING' | 'HEDGING';
export const ACCOUNT_TYPES: AccountType[] = ['TRADING', 'HEDGING'];
```

**Type additions (backend already supplies these — branch `feat/account-type-frontend-dtos`):**
- `AccountSummary.accountType: AccountType` — `src/types/account.ts` (+ map in the API normalizer in `src/lib/api/accounts.ts`).
- `AccountStrategy.strategyKind: AccountType` and `AccountStrategy.archetype: string` — `src/types/strategy.ts` (now on `AccountStrategyResponse`).
- `StrategyDefinition.strategyKind: AccountType` — `src/types/strategyDefinition.ts` (already on the definition API).

**Backend contract (confirmed in place):**
- `GET /accounts` → `accountType`; `POST /accounts` accepts `accountType` (null → TRADING; immutable, absent from `PATCH`/update).
- `GET /account-strategies` rows carry `strategyKind` + `archetype`.
- Bind-time enforcement: `POST /account-strategies` rejects a strategy whose `strategy_kind` ≠ the account's `account_type` with HTTP 400 (`AccountStrategyTaxonomyValidator`). The UI prevents this, but treats the 400 as the source of truth.
- Hedging strategy params use the **generic** `/api/v1/strategy-params` override mechanism (`strategy_param.param_overrides` jsonb, per `account_strategy`, resolved into the spec at runtime). **No new endpoint.**

## 4. The view registry (the heart)

```ts
// src/lib/accountType/registry.tsx (new)
export interface AccountTypeView {
  label: string;                       // "Trading" / "Hedging"
  icon: LucideIcon;
  terminology: { position: string; event: string; size: string };
  dashboardWidgets: React.ComponentType<{ accountId: ScopedAccountId }>[];
  metrics: MetricKey[];                // header stat cards
  monitorRoute: { label: string; columns: ColumnDef[] };  // "Trades" vs "Rebalances"
  strategyForm: ZodSchema;             // per-kind binding-config schema
  catalogFilter: (d: StrategyDefinition) => boolean;       // kind === accountType
  settingsSections: React.ComponentType[];
}

export const ACCOUNT_TYPE_VIEW: Record<AccountType, AccountTypeView> = {
  TRADING: {
    label: 'Trading', icon: TrendingUp,
    terminology: { position: 'Position', event: 'Trade', size: 'Trade size' },
    dashboardWidgets: [StatCards, EquityPanel, PositionsPanel, DailyPnlPanel],
    metrics: ['winRate', 'profitFactor', 'openPositions', 'todayPnl'],
    monitorRoute: { label: 'Trades', columns: TRADE_COLUMNS },
    strategyForm: tradingStrategySchema,        // sides, maxOpenPositions, risk sizing, exec style
    catalogFilter: (d) => d.strategyKind === 'TRADING',
    settingsSections: [ConcurrencyCapsSection, VolTargetingSection],
  },
  HEDGING: {
    label: 'Hedging', icon: Scale,
    terminology: { position: 'Allocation', event: 'Rebalance', size: 'Target weight' },
    dashboardWidgets: [AllocationStatCards, AllocationPanel, BtcStackPanel, DrawdownVsBuyHoldPanel],
    metrics: ['btcWeightPct', 'cashWeightPct', 'maxDrawdown', 'btcStack', 'sharpe'],
    monitorRoute: { label: 'Rebalances', columns: REBALANCE_COLUMNS },
    strategyForm: hedgingStrategySchema,        // target band, deadband, cash-yield, maxWeight
    catalogFilter: (d) => d.strategyKind === 'HEDGING',
    settingsSections: [AllocationCapsSection, RebalanceGuardSection],
  },
};

export const useAccountView = (): AccountTypeView =>
  ACCOUNT_TYPE_VIEW[useActiveAccount().activeAccount?.accountType ?? 'TRADING'];
```

## 5. Per-surface design

| Surface | File(s) | TRADING (today) | HEDGING (new) |
|---|---|---|---|
| **Account create** | `src/components/account/NewAccountDialog.tsx` | username/exchange/keys | **+ type selector** (segmented TRADING/HEDGING, default TRADING), passed as `accountType`; copy explains it's permanent |
| **Account switcher** | `src/components/layout/AccountSwitcher.tsx` | label | **+ type badge** (icon + "Hedging"/"Trading") |
| **Strategy catalog/picker** | `src/components/strategy/NewStrategyDialog.tsx` | `useSymbolApprovals()` filter | **`useCompatibleStrategies(accountType)`** → `view.catalogFilter`; mismatched kinds never shown; bind 400 surfaced as fallback |
| **Strategy binding config** | `strategies/[accountStrategyId]/page.tsx` | sides, maxOpenPositions, risk-sizing, exec style | **hedging schema** (target band e.g. 75/25 vs 100/0, ±deadband, cash-yield APY, maxWeight); no sides/stops |
| **Dashboard home** | `(dashboard)/page.tsx` | StatCards/Equity/Positions/DailyPnl | `view.dashboardWidgets` → Allocation/BtcStack/DrawdownVsBuyHold |
| **Monitor list** | `(dashboard)/trades/*` | directional trades | **"Rebalances"** — same `trade_history` source, rendered as weight-change events (`view.monitorRoute`) |
| **Settings/risk** | `(dashboard)/settings/page.tsx` | concurrency caps, vol-targeting | allocation caps, rebalance deadband, kill-DD (`view.settingsSections`) |
| **Admin definition catalog** | `admin/strategies/page.tsx`, `components/admin/StrategyDefinitionDialog.tsx` | strategyType | **+ strategy_kind picker** on register/edit (already wired on the definition API) |

## 6. Hedging monitoring widgets (grounded in engine behavior)

The hedging engines hold **both BTC and USDT spot** and rebalance the BTC weight via **close-and-reopen** (long-only, no stops/TPs/sides). A hedging account's state is therefore an *allocation*, not a book of positions:

- **AllocationPanel** — live BTC weight % vs USDT/cash weight % vs the strategy's **target** weight; a band gauge showing where current sits relative to target ± deadband. Data: current balances (BTC notional / equity) + the bound strategy's effective target (`capitalAllocationPct` × ensemble vote, or read a lightweight "current target" field if added later).
- **BtcStackPanel** — BTC-denominated accumulation (`USDeq / (price/price₀)`) vs a flat buy-hold baseline of 1.00 — the "sell-high-rebuy-more-BTC" scoreboard.
- **DrawdownVsBuyHoldPanel** — strategy equity drawdown vs BTC buy-hold drawdown over the same window (the crisis-alpha framing: cuts DD ~half).
- **RebalanceHistory** — the close-and-reopen events from `trade_history`, presented as `time · from-weight → to-weight · reason (add / de-risk) · realized Δ`.
- **AllocationStatCards** — `btcWeightPct`, `cashWeightPct`, `maxDrawdown`, `btcStack`, `sharpe`.

All reuse existing reads (`trade_history`, balances, equity) — **no new live-position machinery**; an optional lightweight "current allocation" read can be added if computing client-side proves awkward.

## 7. Per-archetype param schema

Hedging params (`ensemble_trend`: `erThreshold/deadband/maxWeight/priceBand`; `dynamic_tilt`: tilt bands; etc.) are written via the generic `/api/v1/strategy-params` override preset.

- **P1 — hardcode** each hedging archetype's zod form schema in `src/lib/accountType/paramSchemas/<archetype>.ts` (matches the LSR/VCB/VBO pattern; fastest).
- **Future — metadata-driven:** enrich each `strategy_definition.spec_jsonb` to declare param `{key, type, min, max, step, label}` so the form renders generically and **new hedging strategies need zero frontend changes**. Recommended once >2–3 hedging archetypes exist; small backend seed enrichment.

## 8. Routing & state

- Keep the route tree; pages render `useAccountView().dashboardWidgets` / `metrics` / `monitorRoute`.
- Extend `useActiveAccount()` to expose `activeAccount.accountType` (already in the accounts list payload).
- New hooks: `useAccountView()`, `useCompatibleStrategies(accountType)`.
- React Query keys stay account-scoped (`scopedAccountId`) — no change.
- **"All accounts" with mixed types:** render **per-type sections** (a Trading block + a Hedging block), each using its own `view`. Implemented as `groupBy(account.accountType)` over the accounts list.

## 9. Error / edge handling

- **Immutable type:** shown read-only after create; no edit affordance. Backend has no update path for it.
- **Bind mismatch:** the picker filters by kind, so it shouldn't happen; if a stale catalog yields a 400 from `POST /account-strategies`, show the validator message inline.
- **Empty hedging account:** allocation widgets render a "no active hedging strategy" empty state.
- **Switching to a hedging account** with no hedging strategies: catalog opens pre-filtered to hedging.
- **Legacy accounts:** all pre-existing accounts are `TRADING` (backend default), so existing users see zero change.

## 10. Testing

- **Unit:** the registry resolves the right widget/metric/schema set per type; `useCompatibleStrategies` filters by kind; the create-dialog passes `accountType`.
- **Component:** dashboard renders the hedging widget set under a HEDGING account; the strategy-config form swaps schema by `archetype`.
- **Contract:** mock `accountType`/`strategyKind` in fixtures; assert the picker hides mismatched kinds and the "All" view sections by type.
- **E2E (happy path):** create HEDGING account → bind `ensemble_trend` → see AllocationPanel → see RebalanceHistory.

## 11. Phased delivery

- **P1 — plumbing (zero behavior change):** types + `accountType` end-to-end; create-dialog type selector; switcher badge; registry scaffold where `TRADING` = today's components refactored to consume the registry (visual no-op).
- **P2 — catalog:** `useCompatibleStrategies` kind filter; hedging strategy-config form (hardcoded `ensemble_trend`/`dynamic_tilt` schemas).
- **P3 — hedging monitoring:** AllocationPanel / BtcStackPanel / DrawdownVsBuyHold / RebalanceHistory + the "Rebalances" view.
- **P4 — settings/risk per type + "All" sectioning + polish + admin definition-kind picker.**

## 12. Non-goals

- Live 1d *trading* of hedging strategies (the engines are research-validated but JVM-execution-limited; they ship inert). The UI surfaces them but operating them live is gated separately.
- Metadata-driven param forms (deferred to "future" above).
- Cross-account hedge offsetting / portfolio-level netting across a user's accounts.
- Changing an account's type after creation.

## 13. Resolved decisions

1. Hedging UX = **swapped widgets within the shared dashboard** (Approach C), not a separate app.
2. Hedging accounts are **self-serve** (type selector in the create dialog).
3. Account type is **immutable** post-create.
4. Users may hold **both** types → "All" view sections by type.
5. Hedging monitoring **reuses `trade_history`** (rebalances = close-and-reopen) + existing balance/equity reads.
