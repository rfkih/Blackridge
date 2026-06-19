'use client';

import Link from 'next/link';
import { Sliders } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useActivateStrategyParam,
  useStrategyParamPresets,
} from '@/hooks/useStrategyParams';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { AccountStrategy, StrategyParamPreset } from '@/types/strategy';

function overrideSummary(preset: StrategyParamPreset | undefined): string {
  if (!preset) return '—';
  const n = Object.keys(preset.overrides ?? {}).length;
  return n === 0 ? 'defaults only' : `${n} override key${n === 1 ? '' : 's'}`;
}

/**
 * Compact active-preset display + switch dropdown for one account_strategy.
 * The live executor reads the active `strategy_param` preset; selecting a
 * different one calls the activate endpoint (which atomically deactivates the
 * prior active row). Full create/delete management lives on the /params page.
 */
export function StrategyParamPresetPanel({ strategy }: { strategy: AccountStrategy }) {
  const { data: presets, isLoading, isError } = useStrategyParamPresets(strategy.id);
  const activate = useActivateStrategyParam(strategy.id);

  const active = presets?.find((p) => p.active);
  const manageHref = `/strategies/${strategy.id}/params`;

  const onSelect = async (paramId: string) => {
    if (!presets || paramId === active?.paramId) return;
    const target = presets.find((p) => p.paramId === paramId);
    if (!target) return;
    if (
      strategy.status === 'LIVE' &&
      !window.confirm(
        `Switch the live parameter preset to "${target.name}"? New entries will use the new parameters on the next bar.`,
      )
    ) {
      return;
    }
    try {
      await activate.mutateAsync(paramId);
      toast.success({ title: `Activated "${target.name}"` });
    } catch (err) {
      toast.error({ title: 'Could not switch preset', description: normalizeError(err) });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <Sliders size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        <span className="font-mono text-[12px] uppercase tracking-wider text-text-muted">
          Parameter preset
        </span>

        {isLoading ? (
          <Skeleton className="h-7 w-48" />
        ) : isError ? (
          <span className="font-mono text-[13px] text-text-muted">Could not load presets.</span>
        ) : !presets || presets.length === 0 ? (
          <span className="font-mono text-[13px] text-text-muted">
            No saved presets ·{' '}
            <Link href={manageHref} className="underline hover:text-text-primary">
              Manage presets →
            </Link>
          </span>
        ) : presets.length === 1 ? (
          <>
            <span className="font-mono text-[13px] text-text-primary">
              {active?.name ?? presets[0].name}
            </span>
            <span className="font-mono text-[12px] text-text-muted">
              · {overrideSummary(active ?? presets[0])}
            </span>
            <Link
              href={manageHref}
              className="ml-auto font-mono text-[12px] text-text-muted underline hover:text-text-primary"
            >
              Manage presets →
            </Link>
          </>
        ) : (
          <>
            <Select
              value={active?.paramId ?? ''}
              onValueChange={onSelect}
              disabled={activate.isPending}
            >
              <SelectTrigger
                className="h-7 w-[220px] font-mono text-[13px]"
                aria-label="Parameter preset"
              >
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.paramId} value={p.paramId} className="font-mono text-[13px]">
                    {p.name}
                    {p.sourceBacktestRunId ? ` · from run #${p.sourceBacktestRunId.slice(0, 8)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="font-mono text-[12px] text-text-muted">· {overrideSummary(active)}</span>
            {activate.isPending && (
              <span className="font-mono text-[12px] text-text-muted">Switching…</span>
            )}
            <Link
              href={manageHref}
              className="ml-auto font-mono text-[12px] text-text-muted underline hover:text-text-primary"
            >
              Manage presets →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
