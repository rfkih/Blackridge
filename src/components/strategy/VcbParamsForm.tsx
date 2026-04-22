'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ParamField } from './ParamField';
import { ParamSection } from './ParamSection';
import { VCB_PARAM_META, VCB_SECTIONS } from '@/lib/constants';
import { useToast } from '@/hooks/useToast';
import { useSaveVcbParams, useResetVcbParams } from '@/hooks/useStrategies';
import type { VcbParams } from '@/types/strategy';

export interface VcbParamFormProps {
  mode: 'live' | 'backtest';
  accountStrategyId?: string;
  strategyCode?: string;
  initialValues: Partial<VcbParams>;
  defaultValues: VcbParams;
  onChange?: (key: keyof VcbParams, value: unknown) => void;
  onSaveAsLive?: (current: VcbParams) => void | Promise<void>;
}

/**
 * Merge backend-returned params on top of the canonical defaults.
 *
 * A freshly-provisioned `vcb_strategy_param` row has nulls for every
 * un-overridden column. A naive `{...defaults, ...initial}` would let
 * those nulls clobber the defaults, so we filter them out first — "no
 * value in the table" should fall through to the constant default.
 */
function mergeInitial(defaults: VcbParams, initial: Partial<VcbParams>): VcbParams {
  const filtered: Partial<VcbParams> = {};
  (Object.keys(initial) as Array<keyof VcbParams>).forEach((key) => {
    const v = initial[key];
    if (v !== null && v !== undefined) {
      (filtered as Record<string, unknown>)[key as string] = v;
    }
  });
  return { ...defaults, ...filtered };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9;
  }
  return a === b;
}

function computeDiff(defaults: VcbParams, current: VcbParams): Partial<VcbParams> {
  const diff: Partial<VcbParams> = {};
  (Object.keys(defaults) as Array<keyof VcbParams>).forEach((key) => {
    if (!valuesEqual(defaults[key], current[key])) {
      (diff as Record<string, unknown>)[key as string] = current[key];
    }
  });
  return diff;
}

export function VcbParamsForm({
  mode,
  accountStrategyId,
  strategyCode,
  initialValues,
  defaultValues,
  onChange,
  onSaveAsLive,
}: VcbParamFormProps) {
  const [values, setValues] = useState<VcbParams>(() => mergeInitial(defaultValues, initialValues));
  const [savedValues, setSavedValues] = useState<VcbParams>(() =>
    mergeInitial(defaultValues, initialValues),
  );
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const toast = useToast();
  const saveMutation = useSaveVcbParams(accountStrategyId);
  const resetMutation = useResetVcbParams(accountStrategyId);

  useEffect(() => {
    const merged = mergeInitial(defaultValues, initialValues);
    setValues(merged);
    setSavedValues(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaultValues), JSON.stringify(initialValues)]);

  const handleFieldChange = useCallback(
    (key: keyof VcbParams, value: unknown) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      if (mode === 'backtest') onChange?.(key, value);
    },
    [mode, onChange],
  );

  const overrideCountByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    VCB_SECTIONS.forEach(({ title, keys }) => {
      counts[title] = keys.reduce(
        (acc, k) => (valuesEqual(defaultValues[k], values[k]) ? acc : acc + 1),
        0,
      );
    });
    return counts;
  }, [defaultValues, values]);

  const totalOverrides = useMemo(
    () => Object.values(overrideCountByKey).reduce((a, b) => a + b, 0),
    [overrideCountByKey],
  );

  const diff = useMemo(() => computeDiff(defaultValues, values), [defaultValues, values]);
  const hasChanges = Object.keys(diff).length > 0;

  const resetAll = useCallback(() => {
    setValues(defaultValues);
    if (mode === 'backtest') {
      (Object.keys(defaultValues) as Array<keyof VcbParams>).forEach((k) =>
        onChange?.(k, defaultValues[k]),
      );
    }
  }, [defaultValues, mode, onChange]);

  const handleRevertOnServer = useCallback(async () => {
    setConfirmResetOpen(false);
    if (!accountStrategyId) return;
    try {
      await resetMutation.mutateAsync();
      setValues(defaultValues);
      setSavedValues(defaultValues);
      toast.success({
        title: 'Reverted to defaults',
        description: 'All custom overrides removed — this strategy now uses the default params.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not revert parameters';
      toast.error({ title: 'Revert failed', description: message });
    }
  }, [accountStrategyId, defaultValues, resetMutation, toast]);

  const handleSaveLive = useCallback(async () => {
    if (!accountStrategyId) return;
    try {
      await saveMutation.mutateAsync(diff);
      setSavedValues(values);
      toast.success({
        title: 'Parameters saved',
        description: `${Object.keys(diff).length} field${Object.keys(diff).length === 1 ? '' : 's'} updated.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save parameters';
      toast.error({ title: 'Save failed', description: message });
    }
  }, [accountStrategyId, diff, saveMutation, toast, values]);

  const handleSaveAsLive = useCallback(async () => {
    setConfirmSaveOpen(false);
    if (!onSaveAsLive) return;
    try {
      await onSaveAsLive(values);
      toast.success({
        title: 'Saved as live params',
        description: 'The account strategy now uses these values.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save to live params';
      toast.error({ title: 'Save failed', description: message });
    }
  }, [onSaveAsLive, toast, values]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {totalOverrides > 0 ? (
            <>
              <span className="font-semibold text-[var(--color-warning)]">{totalOverrides}</span>{' '}
              field{totalOverrides === 1 ? '' : 's'} differ from defaults.
            </>
          ) : (
            'All fields at default values.'
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAll}
          disabled={totalOverrides === 0}
          className="gap-2 text-xs"
          title="Reset the form to default values (not saved until you click Save)"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {VCB_SECTIONS.map((section, idx) => (
          <ParamSection
            key={section.title}
            title={section.title}
            storageKey={`bh:param-section:vcb:${section.title}`}
            defaultOpen={idx === 0}
            overrideCount={overrideCountByKey[section.title] ?? 0}
          >
            {section.keys.map((key) => {
              const meta = VCB_PARAM_META[key];
              return (
                <ParamField
                  key={key}
                  name={key}
                  meta={meta}
                  value={values[key]}
                  defaultValue={defaultValues[key]}
                  savedValue={savedValues[key]}
                  onChange={(v) => handleFieldChange(key, v)}
                />
              );
            })}
          </ParamSection>
        ))}
      </div>

      {mode === 'live' && (
        <div className="bg-[var(--bg-base)]/90 sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] py-3 backdrop-blur">
          <p className="mr-auto text-xs text-[var(--text-muted)]">
            {hasChanges
              ? `${Object.keys(diff).length} pending change${Object.keys(diff).length === 1 ? '' : 's'}`
              : 'No pending changes'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            disabled={resetMutation.isPending || !accountStrategyId}
            className="gap-2"
            title="Clear every custom override on the server — this strategy will fall back to defaults"
          >
            {resetMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            Revert to defaults
          </Button>
          <Button
            onClick={handleSaveLive}
            disabled={!hasChanges || saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {mode === 'backtest' && onSaveAsLive && (
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmSaveOpen(true)}
            disabled={!hasChanges}
          >
            Save as Live Params
          </Button>
        </div>
      )}

      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to default parameters?</DialogTitle>
            <DialogDescription>
              This clears every custom override
              {strategyCode ? ` for ${strategyCode}` : ''} on the server. The strategy will run with
              the canonical defaults until you change something again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevertOnServer}>
              Revert on server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as live parameters?</DialogTitle>
            <DialogDescription>
              This will overwrite the live params
              {strategyCode ? ` for ${strategyCode}` : ''}. Backtests and live trading will use
              these values going forward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsLive}>Save as live</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
