'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useMlGate, useApplyMlGate, useSignals } from '@/lib/api/ml';
import type { ApplyMlGateRequest, MlGateConfig, SignalRow } from '@/types/ml';
import { SignalStatusPill } from '@/components/ml/SignalStatusPill';

type Mode = 'off' | 'shadow' | 'on';

function modeFromConfig(cfg: MlGateConfig): Mode {
  if (!cfg.gateEnabled) return 'off';
  return cfg.shadowMode ? 'shadow' : 'on';
}

const formSchema = z
  .object({
    mode: z.enum(['off', 'shadow', 'on']),
    signalName: z.string().nullable(),
  })
  .refine((v) => v.mode === 'off' || (v.signalName !== null && v.signalName !== ''), {
    path: ['signalName'],
    message: 'Select a signal.',
  });

type FormValues = z.infer<typeof formSchema>;

interface MlGateTabProps {
  accountStrategyId: string;
  strategyCode: string;
  symbol: string;
  intervalName: string;
}

export function MlGateTab({
  accountStrategyId,
  strategyCode,
  symbol,
  intervalName,
}: MlGateTabProps) {
  const { data: gate, isLoading: gateLoading } = useMlGate(accountStrategyId);
  const { data: signalsResp, isLoading: signalsLoading } = useSignals({
    symbol,
    intervalName,
    limit: 200,
  });

  const compatible = (signalsResp?.signals ?? []).filter((s) => s.status !== 'retired');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { mode: 'off', signalName: null },
  });

  // Seed the form from server state EXACTLY ONCE per accountStrategyId.
  // Resetting on every `gate` identity change would clobber in-progress
  // operator edits whenever the query refetches (cache invalidation
  // after a sibling mutation, network reconnect, manual refetch).
  // After a successful Apply, the post-mutation refetch is intentional —
  // resetSeededFor.current is reset by onApplied below.
  const resetSeededFor = useRef<string | null>(null);
  useEffect(() => {
    if (gate && resetSeededFor.current !== accountStrategyId) {
      form.reset({
        mode: modeFromConfig(gate),
        signalName: gate.signalName,
      });
      resetSeededFor.current = accountStrategyId;
    }
  }, [gate, form, accountStrategyId]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  function onSubmit(values: FormValues) {
    setPendingValues(values);
    setConfirmOpen(true);
  }

  if (gateLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const selectedSignal = compatible.find((s) => s.signalName === form.watch('signalName'));
  const mode = form.watch('mode');

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-bd-subtle bg-bg-surface p-6">
        <h2 className="text-lg font-medium text-text-primary">ML regime gate</h2>
        <p className="mt-1 text-sm text-text-muted">
          When enabled, the strategy consults this signal on every entry attempt. Shadow mode logs
          the gate&apos;s verdict to <code className="text-xs">ml_shadow_log</code> without blocking
          the trade — flip to <span className="font-medium">On</span> only after paired-delta
          evidence.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="mode">Mode</Label>
            <div className="mt-2 flex gap-2">
              {(['off', 'shadow', 'on'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() =>
                    form.setValue('mode', m, { shouldDirty: true, shouldValidate: true })
                  }
                  className={`rounded-md border px-4 py-1.5 text-sm capitalize transition ${
                    mode === m
                      ? 'border-text-primary bg-text-primary text-bg-base'
                      : 'border-bd bg-bg-surface text-text-secondary hover:border-bd'
                  }`}
                >
                  {m === 'off' ? 'Off' : m === 'shadow' ? 'Shadow' : 'On'}
                </button>
              ))}
            </div>
          </div>

          {mode !== 'off' && (
            <div>
              <Label htmlFor="signal">Signal</Label>
              {signalsLoading ? (
                <Skeleton className="mt-2 h-9 w-full max-w-md" />
              ) : compatible.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">
                  No compatible signals for {symbol}/{intervalName}.{' '}
                  <Link href="/ml/signals" className="underline">
                    Browse all signals →
                  </Link>
                </p>
              ) : (
                <Select
                  value={form.watch('signalName') ?? ''}
                  onValueChange={(v) =>
                    form.setValue('signalName', v, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <SelectTrigger className="mt-2 max-w-md">
                    <SelectValue placeholder="Choose a signal" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatible.map((s) => (
                      <SelectItem key={s.signalId} value={s.signalName}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{s.signalName}</span>
                          <SignalStatusPill status={s.status} />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.signalName && (
                <p className="mt-1 text-xs text-loss">
                  {form.formState.errors.signalName.message}
                </p>
              )}
            </div>
          )}

          {selectedSignal && <SignalGlance signal={selectedSignal} />}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                gate && form.reset({ mode: modeFromConfig(gate), signalName: gate.signalName })
              }
              disabled={!form.formState.isDirty}
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={!form.formState.isDirty || !form.formState.isValid}
            >
              Apply →
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-bd-subtle bg-bg-surface p-6 opacity-60">
        <h3 className="text-sm font-medium text-text-secondary">Paired backtest preview</h3>
        <p className="mt-1 text-xs text-text-muted">
          Coming in Phase 2 — run a paired backtest with vs without this gate and see the delta
          before applying live.
        </p>
      </div>

      {pendingValues && gate && (
        <ApplyMlGateConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          accountStrategyId={accountStrategyId}
          strategyCode={strategyCode}
          before={gate}
          after={pendingValues}
          onApplied={() => {
            setConfirmOpen(false);
            setPendingValues(null);
            // Permit the post-mutation refetch to re-seed the form
            // with the freshly persisted values.
            resetSeededFor.current = null;
          }}
        />
      )}
    </div>
  );
}

function SignalGlance({ signal }: { signal: SignalRow }) {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-elevated p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">{signal.signalName}</p>
        <SignalStatusPill status={signal.status} />
      </div>
      <p className="mt-1 text-xs text-text-muted">{signal.modelSpecName}</p>
      <p className="mt-2 text-xs">
        <Link
          href={`/ml/signals/${signal.signalId}`}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
        >
          View signal detail <ExternalLink className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

interface ApplyMlGateConfirmDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountStrategyId: string;
  strategyCode: string;
  before: MlGateConfig;
  after: FormValues;
  onApplied: () => void;
}

function ApplyMlGateConfirmDialog({
  open,
  onOpenChange,
  accountStrategyId,
  strategyCode,
  before,
  after,
  onApplied,
}: ApplyMlGateConfirmDialogProps) {
  const [echo, setEcho] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useApplyMlGate(accountStrategyId);

  const gateOn = after.mode !== 'off';
  const shadowMode = after.mode === 'shadow';
  const targetSignal = gateOn ? after.signalName : null;

  const requiresEcho = after.mode === 'on' && !(before.gateEnabled && !before.shadowMode);

  const handleApply = useCallback(async () => {
    setError(null);
    if (requiresEcho && echo !== strategyCode) {
      setError(`Type "${strategyCode}" to confirm.`);
      return;
    }
    const body: ApplyMlGateRequest = {
      gateEnabled: gateOn,
      signalName: targetSignal,
      shadowMode,
      confirmedStrategyCode: strategyCode,
    };
    try {
      await mutation.mutateAsync(body);
      onApplied();
      setEcho('');
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Apply failed.');
      setError(msg);
    }
  }, [requiresEcho, echo, strategyCode, gateOn, targetSignal, shadowMode, mutation, onApplied]);

  function fmtMode(gateEnabled: boolean, shadow: boolean): string {
    if (!gateEnabled) return 'Off';
    return shadow ? 'Shadow' : 'On';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply ML gate config</DialogTitle>
          <DialogDescription>
            Strategy <span className="font-mono">{strategyCode}</span> · review the diff before
            applying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-bd-subtle bg-bg-surface p-3 text-sm">
          <DiffRow
            label="Mode"
            from={fmtMode(before.gateEnabled, before.shadowMode)}
            to={fmtMode(gateOn, shadowMode)}
          />
          <DiffRow label="Signal" from={before.signalName ?? '—'} to={targetSignal ?? '—'} />
        </div>

        {requiresEcho && (
          <div className="space-y-2">
            <Label htmlFor="echo">
              Type <span className="font-mono">{strategyCode}</span> to confirm flipping the gate
              live.
            </Label>
            <Input
              id="echo"
              value={echo}
              onChange={(e) => setEcho(e.target.value)}
              placeholder={strategyCode}
              className="font-mono"
            />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-loss bg-tint-loss p-2 text-xs text-loss">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={mutation.isPending || (requiresEcho && echo !== strategyCode)}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffRow({ label, from, to }: { label: string; from: string; to: string }) {
  const changed = from !== to;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs uppercase tracking-wider text-text-muted">{label}</span>
      <span className="font-mono text-text-secondary line-through">{from}</span>
      <span className="text-text-muted">→</span>
      <span className={`font-mono ${changed ? 'text-profit' : 'text-text-secondary'}`}>{to}</span>
    </div>
  );
}
