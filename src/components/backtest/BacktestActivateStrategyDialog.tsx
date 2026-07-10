'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActivateBacktestStrategy } from '@/hooks/useBacktest';
import { useAccountStrategies } from '@/hooks/useStrategies';
import { normalizeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { BacktestRun } from '@/types/backtest';
import type { AccountStrategy } from '@/types/strategy';

interface Props {
  run: BacktestRun;
  open: boolean;
  onClose: () => void;
}

type Step = 'configure' | 'success';

export function BacktestActivateStrategyDialog({ run, open, onClose }: Props) {
  const router = useRouter();
  const strategyCodes = useMemo(
    () =>
      (run.strategyCode ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [run.strategyCode],
  );

  const [selectedCode, setSelectedCode] = useState<string>(strategyCodes[0] ?? '');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [presetName, setPresetName] = useState<string>('');
  const [step, setStep] = useState<Step>('configure');
  const [activatedStrategyId, setActivatedStrategyId] = useState<string | null>(null);
  const [activatedSimulated, setActivatedSimulated] = useState<boolean>(true);
  const [liveConfirm, setLiveConfirm] = useState<string>('');

  const strategiesQ = useAccountStrategies();
  const activate = useActivateBacktestStrategy(run.id);

  useEffect(() => {
    if (open) {
      setSelectedCode(strategyCodes[0] ?? '');
      setSelectedStrategyId('');
      setPresetName('');
      setStep('configure');
      setActivatedStrategyId(null);
      setActivatedSimulated(true);
      setLiveConfirm('');
      activate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setSelectedStrategyId('');
  }, [selectedCode]);

  // Re-require the CONFIRM token whenever the target strategy changes.
  useEffect(() => {
    setLiveConfirm('');
  }, [selectedStrategyId]);

  const matchingStrategies = useMemo(() => {
    if (!strategiesQ.data || !selectedCode) return [];
    const runSymbol = run.symbol.toUpperCase();
    const runInterval = run.interval;
    return strategiesQ.data.filter(
      (s) =>
        s.ownedByCurrentUser &&
        s.strategyCode.toUpperCase() === selectedCode.toUpperCase() &&
        s.symbol.toUpperCase() === runSymbol &&
        s.interval === runInterval,
    );
  }, [strategiesQ.data, selectedCode, run.symbol, run.interval]);

  const selectedStrategy = useMemo(
    () => matchingStrategies.find((s) => s.id === selectedStrategyId) ?? null,
    [matchingStrategies, selectedStrategyId],
  );

  // Mirror the backend's resolution order: activation applies the full
  // effective_params_snapshot (defaults + overrides, V104+) when present, and
  // only falls back to the param_snapshot deltas for older runs. Count whichever
  // source will actually be written so the dialog doesn't under-report.
  const paramCount = useMemo(() => {
    const snap = run.effectiveParamsSnapshot ?? run.paramSnapshot;
    if (!snap) return 0;
    const codeSnap = snap[selectedCode] ?? snap[selectedCode.toUpperCase()] ?? null;
    if (!codeSnap) return 0;
    return Object.keys(codeSnap).length;
  }, [run.effectiveParamsSnapshot, run.paramSnapshot, selectedCode]);

  const defaultPresetName = useMemo(() => {
    const date = run.createdAt ? format(new Date(run.createdAt), 'yyyy-MM-dd') : 'N/A';
    const shortId = run.id.slice(0, 8);
    return `Backtest ${shortId} · ${date}`;
  }, [run.id, run.createdAt]);

  // Activating a NON-simulated strategy fires real Binance orders on the
  // next signal — gate that path behind a typed CONFIRM, matching the
  // pending-approvals convention for comparable-severity actions.
  const requiresLiveConfirm = selectedStrategy != null && !selectedStrategy.simulated;
  const canSubmit =
    selectedCode.length > 0 &&
    selectedStrategyId.length > 0 &&
    !activate.isPending &&
    (!requiresLiveConfirm || liveConfirm === 'CONFIRM');

  async function handleActivate() {
    if (!canSubmit) return;
    try {
      const result = await activate.mutateAsync({
        strategyCode: selectedCode,
        accountStrategyId: selectedStrategyId,
        presetName: presetName.trim() || undefined,
      });
      setActivatedStrategyId(result.id);
      setActivatedSimulated(result.simulated);
      setStep('success');
    } catch {
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <Zap size={14} strokeWidth={2} className="text-profit" />
            {selectedStrategy && !selectedStrategy.simulated
              ? 'Activate for Live Trading'
              : 'Activate as Strategy'}
          </DialogTitle>
          <DialogDescription className="text-[14px] text-text-secondary">
            Apply this backtest&apos;s parameters to one of your strategies and enable it for{' '}
            {selectedStrategy
              ? selectedStrategy.simulated
                ? 'paper trading (simulated).'
                : 'live trading with real capital.'
              : 'trading.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <ConfigureStep
            run={run}
            strategyCodes={strategyCodes}
            selectedCode={selectedCode}
            onSelectCode={setSelectedCode}
            matchingStrategies={matchingStrategies}
            strategiesLoading={strategiesQ.isLoading}
            selectedStrategyId={selectedStrategyId}
            onSelectStrategyId={setSelectedStrategyId}
            selectedStrategy={selectedStrategy}
            presetName={presetName}
            defaultPresetName={defaultPresetName}
            onPresetNameChange={setPresetName}
            paramCount={paramCount}
            canSubmit={canSubmit}
            isPending={activate.isPending}
            error={activate.error ? normalizeError(activate.error) : null}
            onActivate={handleActivate}
            onClose={onClose}
            requiresLiveConfirm={requiresLiveConfirm}
            liveConfirm={liveConfirm}
            onLiveConfirmChange={setLiveConfirm}
          />
        ) : (
          <SuccessStep
            strategyId={activatedStrategyId}
            presetName={presetName.trim() || defaultPresetName}
            simulated={activatedSimulated}
            onViewStrategy={() => {
              onClose();
              router.push('/strategies');
            }}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfigureStep({
  run,
  strategyCodes,
  selectedCode,
  onSelectCode,
  matchingStrategies,
  strategiesLoading,
  selectedStrategyId,
  onSelectStrategyId,
  selectedStrategy,
  presetName,
  defaultPresetName,
  onPresetNameChange,
  paramCount,
  canSubmit,
  isPending,
  error,
  onClose,
  onActivate,
  requiresLiveConfirm,
  liveConfirm,
  onLiveConfirmChange,
}: {
  run: BacktestRun;
  strategyCodes: string[];
  selectedCode: string;
  onSelectCode: (v: string) => void;
  matchingStrategies: AccountStrategy[];
  strategiesLoading: boolean;
  selectedStrategyId: string;
  onSelectStrategyId: (v: string) => void;
  selectedStrategy: AccountStrategy | null;
  presetName: string;
  defaultPresetName: string;
  onPresetNameChange: (v: string) => void;
  paramCount: number;
  canSubmit: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onActivate: () => void;
  requiresLiveConfirm: boolean;
  liveConfirm: string;
  onLiveConfirmChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {}
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-sm bg-bg-base px-3 py-2 text-[13px]">
        <span className="text-text-muted">
          Symbol <span className="font-mono font-semibold text-text-primary">{run.symbol}</span>
        </span>
        <span className="text-text-muted">
          Interval <span className="font-mono font-semibold text-text-primary">{run.interval}</span>
        </span>
        {run.metrics?.totalReturnPct != null && (
          <span className="text-text-muted">
            Return{' '}
            <span
              className={cn(
                'font-mono font-semibold',
                run.metrics.totalReturnPct >= 0 ? 'text-profit' : 'text-loss',
              )}
            >
              {run.metrics.totalReturnPct >= 0 ? '+' : ''}
              {run.metrics.totalReturnPct.toFixed(2)}%
            </span>
          </span>
        )}
        {run.strategyAllocations?.[selectedCode] != null && (
          <span className="text-text-muted">
            Allocation{' '}
            <span className="font-mono font-semibold text-text-primary">
              {run.strategyAllocations[selectedCode].toFixed(1)}%
            </span>
          </span>
        )}
        {run.strategyRiskPcts?.[selectedCode] != null && (
          <span className="text-text-muted">
            Risk/trade{' '}
            <span className="font-mono font-semibold text-text-primary">
              {(run.strategyRiskPcts[selectedCode] * 100).toFixed(2)}%
            </span>
          </span>
        )}
      </div>

      {}
      {strategyCodes.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">
            Strategy
          </Label>
          <Select value={selectedCode} onValueChange={onSelectCode}>
            <SelectTrigger className="h-8 text-[14px]">
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              {strategyCodes.map((code) => (
                <SelectItem key={code} value={code} className="text-[14px] font-mono">
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {}
      <div className="space-y-1.5">
        <Label className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">
          Your {selectedCode} Strategy
        </Label>
        {strategiesLoading ? (
          <div className="flex h-8 items-center gap-2 text-[13px] text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Loading strategies…
          </div>
        ) : matchingStrategies.length === 0 ? (
          <div className="flex items-start gap-2 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2 text-[13px] text-warning">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              No {selectedCode} strategy found in your account for {run.symbol} · {run.interval}.{' '}
              <button
                type="button"
                onClick={() => window.open('/strategies', '_blank')}
                className="underline underline-offset-2"
              >
                Create one first
              </button>
              .
            </span>
          </div>
        ) : (
          <Select value={selectedStrategyId} onValueChange={onSelectStrategyId}>
            <SelectTrigger className="h-8 text-[14px]">
              <SelectValue placeholder="Select strategy preset" />
            </SelectTrigger>
            <SelectContent>
              {matchingStrategies.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.presetName}</span>
                    <span className="text-text-muted">
                      {s.symbol} · {s.interval}
                    </span>
                    {s.status === 'LIVE' && (
                      <span className="rounded-full bg-profit/20 px-1.5 py-px text-[12px] font-semibold uppercase text-profit">
                        live
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {}
      {selectedStrategy && (
        <div className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[13px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Current status</span>
            <span
              className={cn(
                'font-semibold',
                selectedStrategy.status === 'LIVE' ? 'text-profit' : 'text-text-secondary',
              )}
            >
              {selectedStrategy.status === 'LIVE'
                ? selectedStrategy.simulated
                  ? 'Paper trading'
                  : 'Live'
                : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">After activation</span>
            <span
              className={cn(
                'font-semibold',
                selectedStrategy.simulated ? 'text-profit' : 'text-warning',
              )}
            >
              {selectedStrategy.simulated ? 'Paper trading (simulated)' : 'Live trading (real capital)'}
            </span>
          </div>
          {selectedStrategy.isKillSwitchTripped && (
            <div className="flex items-start gap-1.5 pt-1 border-t border-bd-subtle mt-1">
              <AlertTriangle size={11} className="mt-0.5 shrink-0 text-warning" />
              <span className="text-warning">
                Drawdown kill-switch is tripped — new entries are blocked until re-armed.
                {selectedStrategy.killSwitchReason && (
                  <span className="block text-text-muted mt-0.5">{selectedStrategy.killSwitchReason}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {}
      <div className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 text-[13px] text-text-secondary">
        <span className="font-semibold text-text-primary">{paramCount}</span>{' '}
        parameter{paramCount !== 1 ? 's' : ''} from this run will be saved as a new active
        preset.
        {paramCount === 0 && (
          <span className="ml-1 text-text-muted">
            (Strategy will use its default parameters.)
          </span>
        )}
      </div>

      {}
      <div className="space-y-1.5">
        <Label className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">
          Preset name
          <span className="ml-1 font-normal normal-case text-text-muted">(optional)</span>
        </Label>
        <Input
          value={presetName}
          onChange={(e) => onPresetNameChange(e.target.value)}
          placeholder={defaultPresetName}
          className="h-8 text-[14px]"
          maxLength={80}
        />
      </div>

      {}
      {requiresLiveConfirm && (
        <div className="space-y-1.5 rounded-sm border border-bd-subtle bg-tint-warning px-3 py-2.5">
          <Label
            htmlFor="activate-live-confirm"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-warning"
          >
            <AlertTriangle size={12} className="shrink-0" />
            This strategy is NOT simulated — real Binance orders will fire on the next signal.
          </Label>
          <p className="text-[13px] text-text-secondary">
            Type <span className="font-mono font-semibold text-text-primary">CONFIRM</span> to
            enable activation.
          </p>
          <Input
            id="activate-live-confirm"
            value={liveConfirm}
            onChange={(e) => onLiveConfirmChange(e.target.value)}
            placeholder="CONFIRM"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-8 font-mono text-[14px]"
          />
        </div>
      )}

      {}
      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-loss/30 bg-tint-loss px-3 py-2 text-[13px] text-loss">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[14px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onActivate}
          disabled={!canSubmit}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm bg-profit px-4 py-1.5 text-[14px] font-semibold text-text-inverse',
            'transition-opacity hover:opacity-90',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Activating…
            </>
          ) : (
            <>
              <Zap size={12} strokeWidth={2} />
              Activate Strategy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SuccessStep({
  strategyId,
  presetName,
  simulated,
  onViewStrategy,
  onClose,
}: {
  strategyId: string | null;
  presetName: string;
  simulated: boolean;
  onViewStrategy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 py-2 text-center">
      <div className="flex justify-center">
        <CheckCircle2 size={36} strokeWidth={1.5} className="text-profit" />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-text-primary">Strategy activated</p>
        <p className="text-[14px] text-text-secondary">
          Preset &quot;{presetName}&quot; saved and enabled for{' '}
          {simulated ? 'paper trading' : 'live trading'}.
        </p>
        {strategyId && (
          <p className="text-[13px] text-text-muted">
            {simulated
              ? 'The strategy will start paper trading on the next candle close.'
              : 'The strategy will execute real orders on the next candle close.'}
          </p>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[14px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onViewStrategy}
          className="inline-flex items-center gap-1.5 rounded-sm bg-profit px-4 py-1.5 text-[14px] font-semibold text-text-inverse transition-opacity hover:opacity-90"
        >
          View Strategies
          <ExternalLink size={11} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
