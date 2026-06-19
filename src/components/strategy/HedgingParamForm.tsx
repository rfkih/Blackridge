'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateStrategyParam,
  useStrategyParamPresets,
  useUpdateStrategyParam,
} from '@/hooks/useStrategyParams';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { AccountStrategy } from '@/types/strategy';
import type { StrategyDefinition } from '@/types/strategyDefinition';

export interface HedgingParamFormProps {
  /** The hedging binding being edited. Supplies the account_strategy id the
   *  override preset is scoped to. */
  strategy: AccountStrategy;
  /** The bound strategy definition. Its `specJsonb.params` declares the param
   *  keys + default values the form renders — metadata-driven, so a new
   *  hedging archetype needs zero frontend changes. */
  definition: StrategyDefinition;
}

/** `erThreshold` → "Er threshold": split on camel-case word boundaries,
 *  lower-case the body, capitalise only the first letter. */
function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Reads the flat `{paramKey: defaultValue}` map a spec-driven strategy declares
 * in `specJsonb.params`, keeping only numeric defaults (the hedging archetypes'
 * params — erThreshold/deadband/maxWeight/priceBand etc. — are all numbers).
 */
function readSpecParams(definition: StrategyDefinition): Record<string, number> {
  const raw = (definition.specJsonb?.params ?? null) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

/**
 * Metadata-driven param editor for a HEDGING binding. Fields + defaults come
 * from the bound definition's `specJsonb.params`; the active
 * `strategy_param.param_overrides` preset is overlaid on top. Save writes the
 * merged map back through the generic `/api/v1/strategy-params` path
 * (create-or-update of the active preset), exactly the mechanism the live
 * hedging executor resolves at runtime — no per-archetype hardcoding and no
 * new endpoint.
 */
export function HedgingParamForm({ strategy, definition }: HedgingParamFormProps) {
  const defaults = useMemo(() => readSpecParams(definition), [definition]);
  const keys = useMemo(() => Object.keys(defaults).sort(), [defaults]);

  const { data: presets, isLoading, isError } = useStrategyParamPresets(strategy.id);
  const createParam = useCreateStrategyParam(strategy.id);
  const updateParam = useUpdateStrategyParam(strategy.id);

  const active = useMemo(() => presets?.find((p) => p.active), [presets]);

  // Editable values: spec defaults overlaid with the active preset's overrides.
  const [values, setValues] = useState<Record<string, number>>(defaults);

  useEffect(() => {
    const merged: Record<string, number> = { ...defaults };
    const overrides = active?.overrides ?? {};
    for (const key of Object.keys(defaults)) {
      const v = overrides[key];
      if (typeof v === 'number' && Number.isFinite(v)) merged[key] = v;
    }
    setValues(merged);
    // Re-seed when the spec defaults or the active preset change.
  }, [defaults, active]);

  const onFieldChange = (key: string, text: string) => {
    if (text === '') {
      setValues((prev) => ({ ...prev, [key]: defaults[key] }));
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n)) setValues((prev) => ({ ...prev, [key]: n }));
  };

  const onSave = async () => {
    // The full resolved map is the new override set — the runtime resolver
    // reads param_overrides directly, so persisting every key (not just the
    // diff) keeps the active preset self-describing.
    const overrides: Record<string, number> = {};
    for (const key of keys) overrides[key] = values[key];
    try {
      if (active) {
        // Update the active preset in place — avoids minting (and orphaning) a
        // fresh deactivated preset on every save.
        await updateParam.mutateAsync({ paramId: active.paramId, overrides });
      } else {
        // First preset for this binding: create it active.
        await createParam.mutateAsync({
          accountStrategyId: strategy.id,
          name: 'Hedging params',
          overrides,
          activate: true,
        });
      }
      toast.success({
        title: 'Hedging parameters saved',
        description: `${keys.length} param${keys.length === 1 ? '' : 's'} applied.`,
      });
    } catch (err) {
      toast.error({ title: 'Could not save parameters', description: normalizeError(err) });
    }
  };

  if (keys.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
        <p className="font-mono font-semibold text-[var(--text-primary)]">
          {definition.strategyCode}
        </p>
        <p className="mt-1">
          This hedging strategy declares no tunable parameters. The backend runs it with built-in
          defaults.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: keys.length }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sliders size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
          Hedging parameters
        </span>
        {definition.archetype && (
          <span className="font-mono text-[12px] text-[var(--text-muted)]">
            · archetype {definition.archetype}
          </span>
        )}
      </div>

      {isError && (
        <p className="text-[13px] text-[var(--color-warning)]">
          Could not load the active preset — editing from spec defaults.
        </p>
      )}

      <div className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {keys.map((key) => (
          <div key={key} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`hedging-param-${key}`}
                className="block truncate text-[14px] text-[var(--text-primary)]"
              >
                {humanizeKey(key)}
              </label>
              <p className="font-mono text-[12px] text-[var(--text-muted)]">
                {key} · default {String(defaults[key])}
              </p>
            </div>
            <input
              id={`hedging-param-${key}`}
              type="number"
              step="any"
              value={Number.isFinite(values[key]) ? values[key] : ''}
              onChange={(e) => onFieldChange(key, e.target.value)}
              className="w-28 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-right font-mono text-[14px] tabular-nums text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-3">
        <Button
          onClick={onSave}
          disabled={createParam.isPending || updateParam.isPending}
          className="gap-2"
        >
          {createParam.isPending || updateParam.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save parameters
        </Button>
      </div>
    </div>
  );
}
