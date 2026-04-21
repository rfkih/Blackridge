'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Play, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { BacktestParamDiffBadge } from './BacktestParamDiffBadge';
import { BacktestParamPresetBar } from './BacktestParamPresetBar';
import { LsrParamsForm } from '@/components/strategy/LsrParamsForm';
import { VcbParamsForm } from '@/components/strategy/VcbParamsForm';
import {
  useLsrDefaults,
  useVcbDefaults,
  useReplaceLsrParams,
  useReplaceVcbParams,
} from '@/hooks/useStrategies';
import { useCreateBacktestRun } from '@/hooks/useBacktest';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { buildBacktestPayload } from '@/lib/backtest/buildBacktestPayload';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { LsrParams, VcbParams } from '@/types/strategy';

const LSR_CODES = new Set(['LSR', 'LSR_V2']);
const VCB_CODES = new Set(['VCB']);

function isLsr(code: string): boolean {
  return LSR_CODES.has(code);
}

function isVcb(code: string): boolean {
  return VCB_CODES.has(code);
}

function countDiff(
  defaults: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> | undefined,
): number {
  if (!defaults || !overrides) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(overrides)) {
    const d = defaults[k];
    if (typeof v === 'number' && typeof d === 'number') {
      if (Math.abs(v - d) >= 1e-9) n += 1;
    } else if (v !== d) {
      n += 1;
    }
  }
  return n;
}

export function BacktestParamTuner() {
  const router = useRouter();

  const config = useBacktestParamStore((s) => s.config);
  const paramOverrides = useBacktestParamStore((s) => s.paramOverrides);
  const activePresetName = useBacktestParamStore((s) => s.activePresetName);
  const setParamOverride = useBacktestParamStore((s) => s.setParamOverride);
  const resetParamOverrides = useBacktestParamStore((s) => s.resetParamOverrides);
  const loadPreset = useBacktestParamStore((s) => s.loadPreset);
  const resetWizard = useBacktestParamStore((s) => s.resetAll);

  // Guard: without config there's nothing to tune.
  useEffect(() => {
    if (!config) router.replace('/backtest/new');
  }, [config, router]);

  // Memoised so downstream hooks don't see a fresh array identity each render.
  const strategyCodes = useMemo<Array<string>>(() => config?.strategyCodes ?? [], [config]);
  const [activeTab, setActiveTab] = useState<string>(strategyCodes[0] ?? '');

  useEffect(() => {
    if (strategyCodes.length > 0 && !strategyCodes.includes(activeTab)) {
      setActiveTab(strategyCodes[0]);
    }
  }, [strategyCodes, activeTab]);

  const needsLsr = strategyCodes.some(isLsr);
  const needsVcb = strategyCodes.some(isVcb);

  const lsrDefaultsQ = useLsrDefaults();
  const vcbDefaultsQ = useVcbDefaults();
  const lsrDefaults = needsLsr ? lsrDefaultsQ.data : undefined;
  const vcbDefaults = needsVcb ? vcbDefaultsQ.data : undefined;

  const defaultsByCode = useMemo<Record<string, Record<string, unknown>>>(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const code of strategyCodes) {
      if (isLsr(code) && lsrDefaults) map[code] = lsrDefaults as unknown as Record<string, unknown>;
      else if (isVcb(code) && vcbDefaults)
        map[code] = vcbDefaults as unknown as Record<string, unknown>;
      else map[code] = {};
    }
    return map;
  }, [strategyCodes, lsrDefaults, vcbDefaults]);

  const overrideCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const code of strategyCodes) {
      out[code] = countDiff(defaultsByCode[code], paramOverrides[code]);
    }
    return out;
  }, [strategyCodes, defaultsByCode, paramOverrides]);

  const totalOverrides = useMemo(
    () => Object.values(overrideCounts).reduce((a, b) => a + b, 0),
    [overrideCounts],
  );

  // Dirty-state beforeunload guard — only fires once the user has made edits.
  useEffect(() => {
    if (totalOverrides === 0) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Assigning `returnValue` is the browser-standard way to trigger the
      // confirm dialog. The prop is deprecated but still required across
      // major browsers; no-param-reassign is suppressed intentionally.
      // eslint-disable-next-line no-param-reassign
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [totalOverrides]);

  const createMutation = useCreateBacktestRun();
  const lsrSaveMutation = useReplaceLsrParams(
    isLsr(activeTab) ? config?.strategyAccountStrategyIds[activeTab] : undefined,
  );
  const vcbSaveMutation = useReplaceVcbParams(
    isVcb(activeTab) ? config?.strategyAccountStrategyIds[activeTab] : undefined,
  );

  const handleBackToConfig = useCallback(() => {
    if (totalOverrides > 0) {
      const ok = window.confirm(
        `You have ${totalOverrides} override${totalOverrides === 1 ? '' : 's'}. Going back will keep them, but any un-saved edits will stay in the wizard. Continue?`,
      );
      if (!ok) return;
    }
    router.push('/backtest/new');
  }, [totalOverrides, router]);

  const handleRun = useCallback(async () => {
    if (!config) return;
    if (needsLsr && !lsrDefaults) return;
    if (needsVcb && !vcbDefaults) return;

    try {
      const payload = buildBacktestPayload(config, paramOverrides, defaultsByCode);
      const run = await createMutation.mutateAsync(payload);
      toast.success({
        title: 'Backtest submitted',
        description: `Run ${run.id.slice(0, 8)} · ${run.symbol} ${run.interval}`,
      });
      resetWizard();
      router.push(`/backtest/${run.id}`);
    } catch (err) {
      toast.error({
        title: 'Could not submit backtest',
        description: normalizeError(err),
      });
    }
  }, [
    config,
    needsLsr,
    lsrDefaults,
    needsVcb,
    vcbDefaults,
    paramOverrides,
    defaultsByCode,
    createMutation,
    resetWizard,
    router,
  ]);

  // Cmd/Ctrl+Enter → Run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  if (!config) {
    return null; // redirecting
  }

  const defaultsLoading =
    (needsLsr && lsrDefaultsQ.isLoading) || (needsVcb && vcbDefaultsQ.isLoading);

  return (
    <div className="space-y-5">
      {/* Header: back + breadcrumb */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleBackToConfig}
            className="mt-[3px] inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors duration-fast hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft size={12} strokeWidth={1.75} />
            Back to Config
          </button>
          <div>
            <p className="label-caps">Step 2</p>
            <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
              Tune Parameters
            </h1>
          </div>
        </div>
        <WizardBreadcrumb current="params" onStepClick={handleBackToConfig} />
      </header>

      {/* Run summary bar — read-only recap of Step 1 */}
      <RunSummaryBar config={config} totalOverrides={totalOverrides} />

      {/* Strategy tabs */}
      <div className="flex items-center gap-1 border-b border-bd-subtle">
        {strategyCodes.map((code) => {
          const isActive = code === activeTab;
          const count = overrideCounts[code] ?? 0;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setActiveTab(code)}
              className={cn(
                'group relative flex items-center gap-2 px-3 pb-2 pt-2 font-mono text-[12px] font-semibold transition-colors duration-fast',
                'focus:outline-none focus-visible:bg-bg-elevated',
                isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
              )}
              aria-selected={isActive}
              role="tab"
            >
              <span>{code}</span>
              <BacktestParamDiffBadge overrideCount={count} />
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-px left-0 right-0 h-[2px] bg-profit"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab body */}
      <div className="rounded-md border border-bd-subtle bg-bg-surface">
        {/* Preset bar */}
        <div className="border-b border-bd-subtle px-4 py-3">
          <BacktestParamPresetBar
            strategyCode={activeTab}
            overrideCount={overrideCounts[activeTab] ?? 0}
            currentOverrides={paramOverrides[activeTab] ?? {}}
            activePresetName={activePresetName}
            onLoad={(preset) => loadPreset(preset)}
            onReset={() => resetParamOverrides(activeTab)}
          />
        </div>

        {/* Form */}
        <div className="px-4 py-4">
          {defaultsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-text-muted">
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              Loading defaults…
            </div>
          ) : (
            <ActiveParamForm
              strategyCode={activeTab}
              accountStrategyId={config.strategyAccountStrategyIds[activeTab]}
              lsrDefaults={lsrDefaults}
              vcbDefaults={vcbDefaults}
              overrides={paramOverrides[activeTab] ?? {}}
              onOverrideChange={(key, value) => setParamOverride(activeTab, key, value)}
              onSaveLsr={async (params: LsrParams) => {
                await lsrSaveMutation.mutateAsync(params);
              }}
              onSaveVcb={async (params: VcbParams) => {
                await vcbSaveMutation.mutateAsync(params);
              }}
            />
          )}
        </div>
      </div>

      {/* Footer — Run submit */}
      <footer className="flex items-center justify-between gap-3 rounded-md border border-bd-subtle bg-bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="label-caps">Total</span>
          <span className="num text-text-primary">
            {totalOverrides} override{totalOverrides === 1 ? '' : 's'}
          </span>
          <span className="text-text-muted">across {strategyCodes.length} strategy</span>
          <span className="label-caps ml-4">Shortcut</span>
          <kbd className="rounded-sm border border-bd-subtle bg-bg-elevated px-1.5 py-px font-mono text-[9px]">
            ⌘/Ctrl + ↵
          </kbd>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={createMutation.isPending || defaultsLoading}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm bg-profit px-4 py-2 text-[12px] font-semibold text-text-inverse',
            'transition-opacity duration-fast hover:opacity-90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Play size={13} strokeWidth={2} />
              Run Backtest
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

function RunSummaryBar({
  config,
  totalOverrides,
}: {
  config: NonNullable<ReturnType<typeof useBacktestParamStore.getState>['config']>;
  totalOverrides: number;
}) {
  const rangeDays = Math.max(
    1,
    Math.round(
      (new Date(config.toDate).getTime() - new Date(config.fromDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bd-subtle bg-bd-subtle sm:grid-cols-5">
      <SummaryCell label="Symbol" value={config.symbol} mono />
      <SummaryCell label="Interval" value={config.interval} mono />
      <SummaryCell
        label="Date Range"
        value={`${format(new Date(config.fromDate), 'yyyy-MM-dd')} → ${format(
          new Date(config.toDate),
          'yyyy-MM-dd',
        )}`}
        sub={`${rangeDays}d`}
        mono
      />
      <SummaryCell
        label="Initial Capital"
        value={`${formatPrice(config.initialCapital)} USDT`}
        mono
      />
      <SummaryCell
        label="Overrides"
        value={String(totalOverrides)}
        sub={totalOverrides > 0 ? 'vs defaults' : 'all defaults'}
        valueColor={totalOverrides > 0 ? 'var(--color-warning)' : 'var(--text-primary)'}
        mono
      />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-bg-surface px-4 py-3">
      <span className="label-caps">{label}</span>
      <span
        className={cn('truncate text-[13px]', mono ? 'num font-semibold' : 'font-medium')}
        style={{ color: valueColor ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && <span className="label-caps !text-[9px]">{sub}</span>}
    </div>
  );
}

function ActiveParamForm({
  strategyCode,
  accountStrategyId,
  lsrDefaults,
  vcbDefaults,
  overrides,
  onOverrideChange,
  onSaveLsr,
  onSaveVcb,
}: {
  strategyCode: string;
  accountStrategyId: string | undefined;
  lsrDefaults: LsrParams | undefined;
  vcbDefaults: VcbParams | undefined;
  overrides: Record<string, unknown>;
  onOverrideChange: (key: string, value: unknown) => void;
  onSaveLsr: (params: LsrParams) => Promise<void>;
  onSaveVcb: (params: VcbParams) => Promise<void>;
}) {
  if (!accountStrategyId) {
    return <NoAccountStrategy code={strategyCode} />;
  }

  if (isLsr(strategyCode) && lsrDefaults) {
    return (
      <LsrParamsForm
        mode="backtest"
        strategyCode={strategyCode}
        accountStrategyId={accountStrategyId}
        defaultValues={lsrDefaults}
        initialValues={overrides as Partial<LsrParams>}
        onChange={(k, v) => onOverrideChange(k as string, v)}
        onSaveAsLive={onSaveLsr}
      />
    );
  }

  if (isVcb(strategyCode) && vcbDefaults) {
    return (
      <VcbParamsForm
        mode="backtest"
        strategyCode={strategyCode}
        accountStrategyId={accountStrategyId}
        defaultValues={vcbDefaults}
        initialValues={overrides as Partial<VcbParams>}
        onChange={(k, v) => onOverrideChange(k as string, v)}
        onSaveAsLive={onSaveVcb}
      />
    );
  }

  return <UntunableStrategy code={strategyCode} />;
}

function NoAccountStrategy({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-bd-subtle bg-tint-warning px-4 py-3">
      <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-mono text-[12px] font-semibold text-text-primary">{code}</p>
        <p className="text-[12px] text-text-secondary">
          No account-strategy is assigned for this code. Go back to Step 1 and pick one, or add one
          on the Strategies page.
        </p>
      </div>
    </div>
  );
}

function UntunableStrategy({ code }: { code: string }) {
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-base px-4 py-4 text-[12px] text-text-secondary">
      <p className="font-mono font-semibold text-text-primary">{code}</p>
      <p className="mt-1">
        This strategy has no tunable parameters in this UI. The backend will use its built-in
        defaults for this run.
      </p>
    </div>
  );
}
