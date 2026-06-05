'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LsrParamsForm } from '@/components/strategy/LsrParamsForm';
import { VcbParamsForm } from '@/components/strategy/VcbParamsForm';
import { HedgingParamForm } from '@/components/strategy/HedgingParamForm';
import { useLsrDefaults, useLsrParams, useVcbDefaults, useVcbParams } from '@/hooks/useStrategies';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import type { AccountStrategy } from '@/types/strategy';
import type { StrategyDefinition } from '@/types/strategyDefinition';

const VCB_CODES = new Set(['VCB']);

function isVcbStrategy(code: string): boolean {
  return VCB_CODES.has(code);
}

/** Hand-coded Java strategies (LSR/VCB/VBO) use their bespoke param editors;
 *  spec-driven hedging archetypes use the generic metadata-driven form. */
const LEGACY_ARCHETYPE = 'LEGACY_JAVA';

/**
 * Per-binding parameter editor. Routes by strategy kind:
 *   - HEDGING (spec-driven archetype) → metadata-driven {@link HedgingParamForm}
 *     sourced from the bound definition's `specJsonb.params`.
 *   - TRADING (LSR/VCB/VBO LEGACY_JAVA) → the existing bespoke editors,
 *     behaviourally unchanged.
 */
export function ParametersTab({ strategy }: { strategy: AccountStrategy }) {
  const { data: definitions } = useStrategyDefinitions();
  const definition = useMemo<StrategyDefinition | undefined>(
    () => definitions?.find((d) => d.strategyCode === strategy.strategyCode),
    [definitions, strategy.strategyCode],
  );

  const isHedging = strategy.strategyKind === 'HEDGING' && strategy.archetype !== LEGACY_ARCHETYPE;

  if (isHedging) {
    if (!definition) {
      return <ParametersSkeleton />;
    }
    return <HedgingParamForm strategy={strategy} definition={definition} />;
  }

  const isVcb = isVcbStrategy(strategy.strategyCode);
  return isVcb ? (
    <VcbParametersEditor strategyId={strategy.id} strategyCode={strategy.strategyCode} />
  ) : (
    <LsrParametersEditor strategy={strategy} />
  );
}

function LsrParametersEditor({ strategy }: { strategy: AccountStrategy }) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useLsrDefaults();
  const { data: current, isLoading: loadingParams } = useLsrParams(strategy.id);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load LSR parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <LsrParamsForm
      mode="live"
      accountStrategyId={strategy.id}
      strategyCode={strategy.strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function VcbParametersEditor({
  strategyId,
  strategyCode,
}: {
  strategyId: string;
  strategyCode: string;
}) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useVcbDefaults();
  const { data: current, isLoading: loadingParams } = useVcbParams(strategyId);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load VCB parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <VcbParamsForm
      mode="live"
      accountStrategyId={strategyId}
      strategyCode={strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function ParametersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
