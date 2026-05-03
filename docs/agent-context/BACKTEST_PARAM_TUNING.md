# Backtest Param Tuning Page (`/backtest/new/params`)

Step 2 of backtest wizard. Configure strategy params **before** the run is submitted, without touching live account params.

## Design Philosophy
- **Non-destructive by default**: edits ephemeral, scoped to this run only. They do NOT write to `lsr_strategy_param`/`vcb_strategy_param` unless user clicks "Save as Live Params".
- **Defaults-first**: form initializes from backend `GET /defaults`. Diffs visually marked.
- **Fast iteration loop**: tweak → run → see results → return tweak. "Re-run with same params" on result page feeds back here pre-filled.

## Page Layout (top→bottom)
1. Wizard breadcrumb: Config → Params → Run + Back link.
2. **Run Summary Bar** (read-only): symbol • interval • date range • capital.
3. **Preset Bar**: `[Load preset ▾]` `[Save current as preset…]` `[Reset to defaults]`.
4. **Strategy Tabs** (one per selected strategy) w/ override count badge — e.g. `LSR_V2 · 3 overrides`.
5. **Param Form** (active tab) — collapsible sections per group, with diff dot + default ghost text.
6. Footer: `[Save as Live Params]` (secondary) + `[Run Backtest →]` (primary).

## Wizard State (`backtestParamStore`)

State bridges step 1 → 2 → submission. Never persisted to backend until "Run Backtest".

```typescript
// store/backtestParamStore.ts
interface BacktestWizardState {
  config: {
    symbol: string;
    interval: string;
    fromDate: string;        // ISO
    toDate: string;
    initialCapital: number;
    strategyCodes: string[]; // ['LSR_V2','VCB']
    strategyAccountStrategyIds: Record<string, string>; // code → UUID
  } | null;
  // Per-strategy override map (only non-default values)
  paramOverrides: Record<string, Record<string, unknown>>;
  activePresetName: string | null;
  // Actions
  setConfig: (c: BacktestWizardState['config']) => void;
  setParamOverride: (code: string, key: string, value: unknown) => void;
  resetParamOverrides: (code: string) => void;
  resetAll: () => void;
  loadPreset: (preset: BacktestParamPreset) => void;
}
```

## `BacktestParamTuner` (`components/backtest/BacktestParamTuner.tsx`)

Shell renders: Run summary → Preset bar → Strategy tabs → Active param form (`LsrParamForm` / `VcbParamForm` / fallback `UnknownStrategyParamForm`) → Footer actions.

```typescript
interface BacktestParamTunerProps {
  // All data from backtestParamStore; only props are submission
  onSubmit: (payload: BacktestRunPayload) => void;
  isSubmitting: boolean;
}
```

## Param Forms (shared with live edit)

Same fields/validation but **backtest mode**:
- Initial values = `GET /defaults` merged with current `paramOverrides`.
- On change: `setParamOverride(code, key, value)` — no API call.
- Default value: render normal. Overridden: amber `●` dot + default as ghost text.

```typescript
// components/strategy/LsrParamForm.tsx (shared)
interface LsrParamFormProps {
  mode: 'live' | 'backtest';
  accountStrategyId?: string;   // required in 'live'
  strategyCode?: string;        // required in 'backtest' (store key)
  initialValues: Partial<LsrParams>;
  defaultValues: LsrParams;     // always provided; for diff
  onChange?: (key: string, value: unknown) => void; // backtest mode
}
```

### LSR field groups (collapsible; only first open by default)

| Section | Fields |
|---|---|
| Entry Conditions | `adxThreshold`, `rsiOverbought`, `rsiOversold`, `adxPeriod`, `rsiPeriod` |
| Volatility Filters | `useErFilter`, `erThreshold`, `erPeriod`, `useRelVolFilter`, `relVolThreshold` |
| Exit & Risk | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner`, `runnerActivationR` |
| Position Sizing | `riskPercentage`, `maxPositionSizeUsdt` |
| Direction | `allowLong`, `allowShort` (read-only — inherited from `AccountStrategy`) |

### VCB field groups

| Section | Fields |
|---|---|
| Compression Detection | `compressionLookback`, `compressionBbWidth`, `compressionKcWidth`, `useKcFilter` |
| Breakout Filters | `minBreakoutAtr`, `maxBreakoutAtr`, `volumeMultiplier`, `useVolumeFilter` |
| Exit & Risk | `stopLossAtr`, `atrPeriod`, `tp1RMultiple`, `tp2RMultiple`, `useRunner` |
| Position Sizing | `riskPercentage`, `maxPositionSizeUsdt` |

> Field names must match `LsrParams`/`VcbParams` Java classes — confirm with backend.

### Field Renderers

| Type | Component | Notes |
|---|---|---|
| number (decimal) | `<NumericInput step={0.1}/>` | Mono, right-aligned |
| number (integer) | `<NumericInput step={1}/>` | — |
| boolean | `<Toggle/>` | shadcn Switch |
| number (%) | `<SliderInput min={0} max={100} step={0.5}/>` + numeric | Show as `%` |
| number (R) | `<SliderInput min={0.5} max={5} step={0.25}/>` | Show as `×` |

Each field shows: human-readable label, control, default ghost text (`default: 25` in `var(--text-muted)`), amber `●` if overridden, optional `?` tooltip.

## Diff Indicator (`BacktestParamDiffBadge`)
Shown on tabs and section headers.
```typescript
interface BacktestParamDiffBadgeProps { overrideCount: number; }
// "N overrides" amber if >0, "defaults" muted if 0
```

## Preset System (`BacktestParamPresetBar`)
Named snapshots of `paramOverrides` in `localStorage` (no backend in v1). Key: `blackheart:backtest-presets`.

```typescript
interface BacktestParamPreset {
  id: string;            // nanoid
  name: string;
  strategyCode: string;
  overrides: Record<string, unknown>;
  createdAt: string;
}
```

| Control | Behavior |
|---|---|
| `[Load preset ▾]` | Dropdown filtered by current strategy tab. Selecting merges `overrides` into store. |
| `[Save current as preset…]` | Popover w/ name input → save current overrides. |
| `[Reset to defaults]` | `resetParamOverrides(activeStrategyCode)`. Confirm if overrides exist. |

## Submission Payload (`buildBacktestPayload`)

```typescript
// lib/backtest/buildBacktestPayload.ts
export function buildBacktestPayload(
  config: WizardConfig,
  paramOverrides: Record<string, Record<string, unknown>>,
  defaultParams: Record<string, Record<string, unknown>>
): BacktestRunPayload {
  return {
    symbol: config.symbol,
    interval: config.interval,
    fromDate: config.fromDate,
    toDate: config.toDate,
    initialCapital: config.initialCapital,
    strategyCode: config.strategyCodes.join(','),
    strategyAccountStrategyIds: config.strategyAccountStrategyIds,
    // Only keys that differ from defaults — backend merges via LsrParams.merge()/VcbParams.merge()
    strategyParamOverrides: Object.fromEntries(
      config.strategyCodes.map((code) => [
        code, computeDiff(defaultParams[code], paramOverrides[code] ?? {}),
      ])
    ),
  };
}
const computeDiff = (defaults: Record<string, unknown>, overrides: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(overrides).filter(([k, v]) => v !== defaults[k]));
```

## "Re-run with Params" — Result Page Integration
Result page (`/backtest/[id]`) header has "Re-run with these params" button:
1. Reads `BacktestRun`'s stored `strategyAccountStrategyIds` + param snapshot.
2. Pre-fills `backtestParamStore.config` and `paramOverrides`.
3. Navigates to `/backtest/new` (step 1).

> Backend: persist param overrides alongside `BacktestRun` — request `paramSnapshot` JSONB column storing the exact `strategyParamOverrides` map.

## UX Rules
- Never auto-submit — param changes always explicit; no debounced API on this page.
- "Run Backtest" is the only write action — all intermediate state is local.
- Field descriptions: `?` tooltip per param explaining thresholds/multipliers, sourced from a static `paramMeta` map in `lib/constants.ts`.
- Validate via Zod before submit; block + highlight invalid fields like live forms.
- Section collapse state per-session in sessionStorage; reset on reload.
- Keyboard: `Cmd/Ctrl + Enter` triggers Run when valid.
- Dirty state: `beforeunload` warning if leaving with unsaved overrides.
- "Save as Live Params" — destructive: confirm dialog *"This will overwrite the live params for [strategy] on account [X]. Backtests will use the same params going forward."*
