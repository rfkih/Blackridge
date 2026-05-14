'use client';

import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface SpecParamsFormProps {
  strategyCode: string;
  archetype: string | null;
  defaults: Record<string, number | boolean>;
  overrides: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * V56 — sizing config moved to `account_strategy.useRiskBasedSizing` /
 * `riskPct` / `capitalAllocationPct`. The spec-engine Tuning classes
 * historically loaded these keys from spec body params and surface them in
 * the strategy_definition defaults, but post-V56 the engines route through
 * `StrategyHelper.calculateLongEntryNotional` / `calculateShortEntryQty`
 * which read account-level fields. Editing the spec-param versions has no
 * effect, so hide them from the form to avoid wasted operator effort.
 */
const INERT_SIZING_KEYS: ReadonlySet<string> = new Set([
  'useRiskBasedSizing',
  'riskPct',
  'riskPerTradePct',
  'maxAllocationPct',
]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return a === b;
}

export function SpecParamsForm({
  strategyCode,
  archetype,
  defaults,
  overrides,
  onChange,
}: SpecParamsFormProps) {
  const keys = useMemo(
    () =>
      Object.keys(defaults)
        .filter((k) => !INERT_SIZING_KEYS.has(k))
        .sort(),
    [defaults],
  );

  if (keys.length === 0) {
    return (
      <div className="rounded-sm border border-bd-subtle bg-bg-base px-4 py-4 text-[12px] text-text-secondary">
        <p className="font-mono font-semibold text-text-primary">{strategyCode}</p>
        <p className="mt-1">
          The spec for this strategy declares no tunable parameters. Backend will run with built-in
          defaults.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[12px] font-semibold text-text-primary">{strategyCode}</p>
        {archetype && <span className="label-caps">archetype · {archetype}</span>}
      </div>

      <div className="divide-y divide-bd-subtle rounded-sm border border-bd-subtle bg-bg-base">
        {keys.map((key) => {
          const def = defaults[key];
          const raw = overrides[key];
          const current = raw === undefined ? def : (raw as number | boolean);
          const overridden = !valuesEqual(current, def);

          return (
            <div
              key={key}
              className={cn(
                'flex items-center gap-3 border-l-2 px-3 py-2 transition-colors',
                overridden ? 'border-warning' : 'border-transparent',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-text-primary">{humanizeKey(key)}</span>
                  {overridden && (
                    <span
                      aria-label="Overridden"
                      className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
                    />
                  )}
                </div>
                <p className="font-mono text-[10px] text-text-muted">
                  {key} · default {String(def)}
                </p>
              </div>
              <div className="shrink-0">
                {typeof def === 'boolean' ? (
                  <Switch checked={Boolean(current)} onCheckedChange={(v) => onChange(key, v)} />
                ) : (
                  <input
                    type="number"
                    step="any"
                    value={typeof current === 'number' ? current : ''}
                    onChange={(e) => {
                      const txt = e.target.value;
                      if (txt === '') {
                        onChange(key, def);
                        return;
                      }
                      const n = Number(txt);
                      if (Number.isFinite(n)) onChange(key, n);
                    }}
                    className="num w-28 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 text-right text-[12px] text-text-primary focus:border-bd-strong focus:outline-none"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
