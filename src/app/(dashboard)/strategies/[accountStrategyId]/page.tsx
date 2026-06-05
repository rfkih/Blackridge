'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronRight,
  FlaskConical,
  Hash,
  TrendingUp,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { CrossWindowPanel } from '@/components/strategy/CrossWindowPanel';
import { PaperTradePanel } from '@/components/strategy/PaperTradePanel';
import { StrategyParamPresetPanel } from '@/components/strategy/StrategyParamPresetPanel';
import { ParametersTab } from './ParametersTab';
import {
  useAccountStrategy,
  useActivateStrategy,
  useKellyStatus,
  useRearmKillSwitch,
  useUpdateStrategy,
} from '@/hooks/useStrategies';
import { useAccountStrategyPromote } from '@/hooks/useStrategyPromotion';
import { useTradesList, useTradeStats } from '@/hooks/useTrades';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import {
  ALLOC_MAX_PCT,
  ALLOC_OPTIONS,
  RISK_OPTIONS,
  strategyControlsRiskSizing,
} from '@/lib/constants';

import { useAccounts } from '@/hooks/useAccounts';
import { useBacktestParamStore } from '@/store/backtestParamStore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';
import type { Trades } from '@/types/trading';

interface PageProps {
  params: { accountStrategyId: string };
}

function formatAllocStr(pct: number): string {
  return String(parseFloat(pct.toFixed(2)));
}
function formatRiskStr(frac: number): string {
  return String(parseFloat((frac * 100).toFixed(4)));
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso ?? '—';
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss');
}

export default function StrategyDetailPage({ params }: PageProps) {
  const { accountStrategyId } = params;
  const { data: strategy, isLoading, isError } = useAccountStrategy(accountStrategyId);
  const { data: accounts = [] } = useAccounts();
  const account = strategy ? accounts.find((a) => a.id === strategy.accountId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link
          href="/strategies"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} />
          Strategies
        </Link>
        {strategy && (
          <>
            <ChevronRight size={11} className="opacity-60" />
            <span className="font-mono text-[var(--text-secondary)]">
              {account?.label ?? strategy.accountId.slice(0, 8)}
            </span>
            {account && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {account.exchange}
              </span>
            )}
            <ChevronRight size={11} className="opacity-60" />
            <span className="text-[var(--text-primary)]">
              {strategy.strategyCode} · {strategy.symbol}
            </span>
          </>
        )}
      </div>

      {isError ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-loss)]">Could not load strategy.</p>
        </div>
      ) : isLoading || !strategy ? (
        <StrategyDetailSkeleton />
      ) : (
        <StrategyDetail strategy={strategy} />
      )}
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: AccountStrategy }) {
  const router = useRouter();

  const hydrateBacktest = useBacktestParamStore((s) => s.hydrateFromRun);

  const handleRunBacktest = () => {
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);
    hydrateBacktest(
      {
        symbol: strategy.symbol,
        interval: strategy.interval,
        fromDate: ninetyDaysAgo.toISOString().slice(0, 10),
        toDate: today.toISOString().slice(0, 10),
        initialCapital: 10000,
        strategyCodes: [strategy.strategyCode],
        strategyAccountStrategyIds: { [strategy.strategyCode]: strategy.id },
        strategyAllocations: { [strategy.strategyCode]: strategy.capitalAllocationPct },
        ...(strategy.useRiskBasedSizing
          ? { strategyRiskPcts: { [strategy.strategyCode]: strategy.riskPct } }
          : {}),
        strategyAllowLong: { [strategy.strategyCode]: strategy.allowLong },
        strategyAllowShort: { [strategy.strategyCode]: strategy.allowShort },
        allowLong: true,
        allowShort: true,
      },
      {},
      null,
    );
    router.push('/backtest/new');
  };

  return (
    <>
      <header className="flex flex-col gap-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-panel">
        {}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StrategyBadge code={strategy.strategyCode} />
              <StrategyStatusBadge status={strategy.status} size="md" />
            </div>
            <h1 className="font-display text-2xl text-[var(--text-primary)]">
              {strategy.symbol}
              <span className="ml-2 rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-sm font-normal text-[var(--text-muted)]">
                {strategy.interval}
              </span>
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-4">
            <MetaStat
              label={
                strategyControlsRiskSizing(strategy.strategyCode) && strategy.useRiskBasedSizing
                  ? 'Position cap'
                  : 'Allocation'
              }
              value={`${strategy.capitalAllocationPct.toFixed(1)}%`}
            />
            {strategyControlsRiskSizing(strategy.strategyCode) && strategy.useRiskBasedSizing && (
              <MetaStat label="Risk / trade" value={`${(strategy.riskPct * 100).toFixed(2)}%`} />
            )}
            <MetaStat label="Priority" value={`#${strategy.priorityOrder}`} />
          </div>
        </div>

        {}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            Preset · <span className="text-[var(--text-secondary)]">{strategy.presetName}</span>
          </span>
          <div className="flex items-center gap-2">
            <StrategyModeToggle strategy={strategy} />
            <button
              type="button"
              onClick={handleRunBacktest}
              title="Pre-fills symbol, interval, sizing, and direction from this strategy"
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-primary)] transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            >
              <FlaskConical size={11} strokeWidth={1.75} />
              Run backtest
            </button>
          </div>
        </div>
      </header>

      <RiskGuardPanel strategy={strategy} />

      <RiskGatesPanel strategy={strategy} />

      <ExecutionStylePanel strategy={strategy} />

      <DirectionPanel strategy={strategy} />

      <KellySizingPanel strategy={strategy} />

      <PositionSizingPanel strategy={strategy} />

      <StrategyParamPresetPanel strategy={strategy} />

      <CrossWindowPanel
        strategyCode={strategy.strategyCode}
        intervalName={strategy.interval}
        instrument={strategy.symbol}
      />

      <PaperTradePanel accountStrategyId={strategy.id} isPaperTrade={strategy.status === 'PAPER'} />

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList className="bg-[var(--bg-surface)]">
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <LiveTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="overview">
          <OverviewTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="parameters">
          <ParametersTab strategy={strategy} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Drawdown kill-switch state. Two visual states:
 *  - Tripped: prominent loss-tinted banner with reason + re-arm button.
 *  - Armed: muted strip showing the threshold so the user knows the line.
 *
 * Re-arm is a single click — the trip state itself is the safety; clearing
 * it is a deliberate "I've looked at the reason and accept it" action.
 */
function RiskGuardPanel({ strategy }: { strategy: AccountStrategy }) {
  const rearmMut = useRearmKillSwitch();

  const onRearm = async () => {
    try {
      await rearmMut.mutateAsync(strategy.id);
      toast.success({ title: 'Kill-switch re-armed' });
    } catch (err) {
      toast.error({ title: 'Could not re-arm', description: normalizeError(err) });
    }
  };

  if (strategy.isKillSwitchTripped) {
    return (
      <div className="border-[var(--color-loss)]/40 flex flex-wrap items-start gap-3 rounded-lg border bg-[var(--bg-surface)] p-4 shadow-panel">
        <ShieldAlert
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-loss)]"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[12px] text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--color-loss)]">Kill-switch tripped.</span> New
            entries are blocked for this strategy until re-armed.
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {strategy.killSwitchReason ?? 'Drawdown threshold breached.'}
            {strategy.killSwitchTrippedAt && (
              <>
                {' · tripped '}
                {formatIso(strategy.killSwitchTrippedAt)}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRearm}
          disabled={rearmMut.isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-fast hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={11} strokeWidth={1.75} />
          {rearmMut.isPending ? 'Re-arming…' : 'Re-arm kill-switch'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <ShieldCheck size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Risk guard armed
      </span>
      <span className="font-mono text-[11px] text-text-secondary">
        DD threshold {strategy.ddKillThresholdPct.toFixed(0)}% · 30d window
      </span>
    </div>
  );
}

/**
 * Direction toggle — Long and/or Short entries allowed. Both can be active
 * simultaneously. At least one must stay enabled; when only one is active the
 * other chip shows an inline constraint hint so the rule is visible without
 * relying on a tooltip (which is not discoverable on touch devices).
 */
function DirectionPanel({ strategy }: { strategy: AccountStrategy }) {
  const updateMut = useUpdateStrategy();

  const onToggle = async (direction: 'long' | 'short') => {
    const newLong = direction === 'long' ? !strategy.allowLong : strategy.allowLong;
    const newShort = direction === 'short' ? !strategy.allowShort : strategy.allowShort;
    if (!newLong && !newShort) return;
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { allowLong: newLong, allowShort: newShort },
      });

      const changed: string[] = [];
      if (newLong !== strategy.allowLong) changed.push(newLong ? 'Long enabled' : 'Long disabled');
      if (newShort !== strategy.allowShort)
        changed.push(newShort ? 'Short enabled' : 'Short disabled');
      toast.success({ title: changed.join(' · ') || 'Direction updated' });
    } catch (err) {
      toast.error({ title: 'Could not update direction', description: normalizeError(err) });
    }
  };

  const onlyLong = strategy.allowLong && !strategy.allowShort;
  const onlyShort = !strategy.allowLong && strategy.allowShort;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <ArrowUpDown size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Direction
      </span>

      {}
      <button
        type="button"
        onClick={() => onToggle('long')}
        disabled={updateMut.isPending || onlyLong}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed',
          strategy.allowLong
            ? 'border-[var(--color-profit)]/40 bg-[var(--color-profit)]/10 hover:bg-[var(--color-profit)]/20 text-[var(--color-profit)] disabled:opacity-60'
            : 'border-bd-subtle bg-bg-base text-text-muted hover:border-text-muted hover:text-text-primary disabled:opacity-50',
        )}
      >
        {strategy.allowLong && <Check size={10} strokeWidth={2.5} aria-hidden="true" />}
        Long
      </button>

      {}
      <button
        type="button"
        onClick={() => onToggle('short')}
        disabled={updateMut.isPending || onlyShort}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed',
          strategy.allowShort
            ? 'border-[var(--color-loss)]/40 bg-[var(--color-loss)]/10 hover:bg-[var(--color-loss)]/20 text-[var(--color-loss)] disabled:opacity-60'
            : 'border-bd-subtle bg-bg-base text-text-muted hover:border-text-muted hover:text-text-primary disabled:opacity-50',
        )}
      >
        {strategy.allowShort && <Check size={10} strokeWidth={2.5} aria-hidden="true" />}
        Short
      </button>

      {}
      {(onlyLong || onlyShort) && !updateMut.isPending && (
        <span className="font-mono text-[10px] text-text-muted">
          · enable the other direction first to remove this one
        </span>
      )}

      {updateMut.isPending && (
        <span className="font-mono text-[10px] text-text-muted">Saving…</span>
      )}
    </div>
  );
}

/**
 * V62 — Risk-gate toggles. Four independently-togglable gates that mirror the
 * backend's StrategyGateService. All default OFF after the V62 backfill — the
 * operator opts each gate back in here as they validate them. The kill-switch
 * gate plays alongside the existing RiskGuardPanel above: that panel renders
 * the trip STATE (tripped / armed); this panel controls whether the trip flag
 * actually BLOCKS new entries when set.
 *
 * UX: each gate is a chip toggle (same shape as DirectionPanel) so the
 * on/off state is unambiguous at a glance. Saves are independent — toggling
 * one gate doesn't affect the others; the PATCH endpoint accepts whichever
 * fields are present.
 */
type GateKey =
  | 'killSwitchGateEnabled'
  | 'regimeGateEnabled'
  | 'correlationGateEnabled'
  | 'concurrentCapGateEnabled';

const GATE_META: Array<{ key: GateKey; label: string; hint: string }> = [
  {
    key: 'killSwitchGateEnabled',
    label: 'Kill-switch',
    hint: 'Block new entries when the drawdown trip flag is set.',
  },
  {
    key: 'regimeGateEnabled',
    label: 'Regime',
    hint: 'Block entries outside the allowed trend / volatility regimes.',
  },
  {
    key: 'correlationGateEnabled',
    label: 'Correlation',
    hint: 'Cap correlated same-side stacking across the account.',
  },
  {
    key: 'concurrentCapGateEnabled',
    label: 'Account cap',
    hint: 'Enforce maxConcurrentLongs / Shorts / Trades at entry time.',
  },
];

function RiskGatesPanel({ strategy }: { strategy: AccountStrategy }) {
  const updateMut = useUpdateStrategy();

  const onToggle = async (gate: GateKey) => {
    const next = !strategy[gate];
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { [gate]: next },
      });
      const meta = GATE_META.find((g) => g.key === gate);
      toast.success({
        title: `${meta?.label ?? 'Gate'} ${next ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      toast.error({ title: 'Could not update gate', description: normalizeError(err) });
    }
  };

  const allOff = GATE_META.every((g) => !strategy[g.key]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Risk gates
        </span>
        {GATE_META.map((g) => {
          const active = Boolean(strategy[g.key]);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => onToggle(g.key)}
              disabled={updateMut.isPending}
              title={g.hint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-[var(--color-profit)]/40 bg-[var(--color-profit)]/10 hover:bg-[var(--color-profit)]/20 text-[var(--color-profit)]'
                  : 'border-bd-subtle bg-bg-base text-text-muted hover:border-text-muted hover:text-text-primary',
              )}
              aria-pressed={active}
            >
              {active && <Check size={10} strokeWidth={2.5} aria-hidden="true" />}
              {g.label}
            </button>
          );
        })}
        {updateMut.isPending && (
          <span className="font-mono text-[10px] text-text-muted">Saving…</span>
        )}
      </div>
      {allOff && !updateMut.isPending && (
        <span className="font-mono text-[10px] text-text-muted">
          · all gates off — live and backtest behave identically (V62 default). Enable each gate as
          you validate it.
        </span>
      )}
    </div>
  );
}

/**
 * V105 / Phase 3.5 — execution-style picker. Per-strategy selection of how
 * live orders reach Binance:
 *   - MARKET (default): single MARKET fill via the legacy path. Bit-identical
 *     to pre-Phase-1 behavior. LSR/VCB/VBO should stay here.
 *   - LIMIT_MAKER: routes through LimitOrderService — posts a passive
 *     LIMIT_MAKER, polls, cancels on timeout, falls back to MARKET. Earns
 *     maker rebates when the order rests.
 *   - TWAP: column-reserved but NOT yet wired into the live trade path.
 *     Currently falls through to MARKET. UI shows the option as disabled
 *     with a tooltip to set expectations.
 *
 * Backend safety: the PATCH endpoint refuses a style change when the
 * strategy has open trades (mid-position flip is unsafe). The handler maps
 * the 409 IllegalStateException to a user-readable toast.
 */
const EXECUTION_STYLES: Array<{
  value: AccountStrategy['executionStyle'];
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: 'MARKET',
    label: 'Market',
    description: 'Single MARKET fill. Legacy default — safest for production.',
  },
  {
    value: 'LIMIT_MAKER',
    label: 'Limit Maker',
    description:
      'Passive LIMIT_MAKER at the decision price; cancels on timeout + falls back to MARKET. Captures maker rebate when resting.',
  },
  {
    value: 'TWAP',
    label: 'TWAP',
    description:
      'Not yet wired into the live trade path. Setting this currently falls through to MARKET.',
    disabled: true,
  },
];

function ExecutionStylePanel({ strategy }: { strategy: AccountStrategy }) {
  const updateMut = useUpdateStrategy();
  const current = strategy.executionStyle ?? 'MARKET';

  const onSelect = async (next: AccountStrategy['executionStyle']) => {
    if (next === current) return;
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { executionStyle: next },
      });
      toast.success({ title: `Execution style → ${next}` });
    } catch (err) {
      toast.error({
        title: 'Could not change execution style',
        description: normalizeError(err),
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Execution style
        </span>
        {EXECUTION_STYLES.map((opt) => {
          const active = current === opt.value;
          const disabled = Boolean(opt.disabled) || updateMut.isPending;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              disabled={disabled}
              title={opt.description}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-[var(--color-profit)]/40 bg-[var(--color-profit)]/10 hover:bg-[var(--color-profit)]/20 text-[var(--color-profit)]'
                  : 'border-bd-subtle bg-bg-base text-text-muted hover:border-text-muted hover:text-text-primary',
              )}
              aria-pressed={active}
            >
              {active && <Check size={10} strokeWidth={2.5} aria-hidden="true" />}
              {opt.label}
            </button>
          );
        })}
        {updateMut.isPending && (
          <span className="font-mono text-[10px] text-text-muted">Saving…</span>
        )}
      </div>
      <span className="font-mono text-[10px] text-text-muted">
        · {EXECUTION_STYLES.find((o) => o.value === current)?.description ?? 'Single MARKET fill.'}{' '}
        Backend refuses a style change while open trades exist.
      </span>
    </div>
  );
}

/**
 * Kelly / bankroll sizing panel. Surfaces the live multiplier (not just the
 * configured cap) so operators can see what Kelly is actually doing today —
 * a strategy with no qualifying backtests displays "inactive: needs ≥1 run"
 * even when the toggle is on. Toggle and cap edits go via PATCH; the
 * /kelly-status query auto-refetches on success.
 */
function KellySizingPanel({ strategy }: { strategy: AccountStrategy }) {
  const updateMut = useUpdateStrategy();
  const { data: kellyStatus } = useKellyStatus(strategy.id);
  const [editing, setEditing] = React.useState(false);
  const [maxFraction, setMaxFraction] = React.useState(
    (strategy.kellyMaxFraction * 100).toFixed(0),
  );

  const onEdit = () => {
    setMaxFraction((strategy.kellyMaxFraction * 100).toFixed(0));
    setEditing(true);
  };

  const onToggle = async () => {
    setEditing(false);
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { kellySizingEnabled: !strategy.kellySizingEnabled },
      });
      toast.success({
        title: strategy.kellySizingEnabled ? 'Kelly sizing disabled' : 'Kelly sizing enabled',
      });
    } catch (err) {
      toast.error({ title: 'Could not update Kelly sizing', description: normalizeError(err) });
    }
  };

  const onSaveCap = async () => {
    const pct = parseFloat(maxFraction);
    if (!Number.isFinite(pct) || pct < 5 || pct > 100) {
      toast.error({ title: 'Cap must be between 5% and 100%' });
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { kellyMaxFraction: pct / 100 },
      });
      toast.success({ title: `Kelly cap set to ${pct.toFixed(0)}%` });
      setEditing(false);
    } catch (err) {
      toast.error({ title: 'Could not update Kelly cap', description: normalizeError(err) });
    }
  };

  const isInactive =
    strategy.kellySizingEnabled && kellyStatus != null && kellyStatus.qualifyingRuns === 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <TrendingUp size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Kelly sizing
      </span>

      <span
        className={cn(
          'font-mono text-[11px]',
          !strategy.kellySizingEnabled
            ? 'text-text-muted'
            : isInactive
              ? 'text-[var(--color-warn,#d97706)]'
              : 'text-[var(--color-profit)]',
        )}
      >
        {!strategy.kellySizingEnabled ? 'disabled' : isInactive ? 'enabled (inactive)' : 'enabled'}
      </span>

      {strategy.kellySizingEnabled && !editing && (
        <>
          {kellyStatus && kellyStatus.qualifyingRuns > 0 && (
            <span className="font-mono text-[11px] text-text-primary">
              ×{kellyStatus.currentMultiplier.toFixed(2)}
            </span>
          )}
          <span className="font-mono text-[11px] text-text-secondary">
            cap {(strategy.kellyMaxFraction * 100).toFixed(0)}%
          </span>
          {kellyStatus && (
            <span className="font-mono text-[10px] text-text-muted">{kellyStatus.reason}</span>
          )}
        </>
      )}

      {editing && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={5}
            max={100}
            step={1}
            value={maxFraction}
            onChange={(e) => setMaxFraction(e.target.value)}
            className="w-16 rounded border border-bd-subtle bg-bg-base px-2 py-0.5 font-mono text-[11px] text-text-primary focus:outline-none"
            aria-label="Kelly max fraction percent"
          />
          <span className="font-mono text-[11px] text-text-muted">%</span>
          <button
            type="button"
            onClick={onSaveCap}
            disabled={updateMut.isPending}
            className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {strategy.kellySizingEnabled && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary hover:bg-bg-hover"
          >
            Edit cap
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={updateMut.isPending}
          className="inline-flex items-center rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary hover:bg-bg-hover disabled:opacity-50"
        >
          {updateMut.isPending ? '…' : strategy.kellySizingEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
}

/**
 * Unified position-sizing panel. Supports two modes:
 *   - Allocation: trade size = account equity × capitalAllocationPct
 *   - Risk-based: qty derived from cash × riskPct / stopDistance,
 *     capped at capitalAllocationPct of equity (V55)
 *
 * Both modes allow editing capitalAllocationPct. Risk-based mode adds
 * a second riskPct input.
 */
function PositionSizingPanel({ strategy }: { strategy: AccountStrategy }) {
  const updateMut = useUpdateStrategy();
  const supportsRiskBased = strategyControlsRiskSizing(strategy.strategyCode);

  const [editing, setEditing] = React.useState(false);

  const [allocationInput, setAllocationInput] = React.useState(() =>
    formatAllocStr(strategy.capitalAllocationPct),
  );
  const [riskInput, setRiskInput] = React.useState(() => formatRiskStr(strategy.riskPct));

  React.useEffect(() => {
    if (!editing) {
      setAllocationInput(formatAllocStr(strategy.capitalAllocationPct));
      setRiskInput(formatRiskStr(strategy.riskPct));
    }
  }, [strategy.capitalAllocationPct, strategy.riskPct, editing]);

  const openEdit = () => {
    setAllocationInput(formatAllocStr(strategy.capitalAllocationPct));
    setRiskInput(formatRiskStr(strategy.riskPct));
    setEditing(true);
  };

  const allocCurrentOffGrid = !ALLOC_OPTIONS.some(
    (v) => String(v) === formatAllocStr(strategy.capitalAllocationPct),
  );
  const riskCurrentOffGrid = !RISK_OPTIONS.some(
    (v) => String(v) === formatRiskStr(strategy.riskPct),
  );

  const onSwitchMode = async (toRiskBased: boolean) => {
    if (toRiskBased === strategy.useRiskBasedSizing || updateMut.isPending || editing) return;
    try {
      await updateMut.mutateAsync({
        id: strategy.id,
        patch: { useRiskBasedSizing: toRiskBased },
      });
      toast.success({
        title: toRiskBased ? 'Switched to risk-based sizing' : 'Switched to allocation sizing',
      });
    } catch (err) {
      toast.error({ title: 'Could not switch sizing mode', description: normalizeError(err) });
    }
  };

  const onSave = async () => {
    const allocation = parseFloat(allocationInput);
    if (!Number.isFinite(allocation) || allocation < 0.01 || allocation > ALLOC_MAX_PCT) {
      toast.error({ title: `Allocation must be between 0.01% and ${ALLOC_MAX_PCT}%` });
      return;
    }

    const isRiskNow = strategy.useRiskBasedSizing;
    const patch: { capitalAllocationPct: number; riskPct?: number } = {
      capitalAllocationPct: allocation,
    };
    if (isRiskNow) {
      const risk = parseFloat(riskInput);
      if (!Number.isFinite(risk) || risk <= 0 || risk > 20) {
        toast.error({ title: 'Risk per trade must be between 0.01% and 20%' });
        return;
      }
      patch.riskPct = risk / 100;
    }
    try {
      await updateMut.mutateAsync({ id: strategy.id, patch });
      toast.success({
        title: isRiskNow
          ? `Sizing updated — risk ${parseFloat(riskInput).toFixed(2)}%, cap ${allocation.toFixed(1)}%`
          : `Allocation set to ${allocation.toFixed(1)}%`,
      });
      setEditing(false);
    } catch (err) {
      toast.error({ title: 'Could not update sizing', description: normalizeError(err) });
    }
  };

  const isRisk = strategy.useRiskBasedSizing;

  return (
    <div className="rounded-lg border border-bd-subtle bg-bg-surface px-4 py-3 shadow-panel">
      {}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Scale size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Position sizing
          </span>

          {}
          {supportsRiskBased && (
            <div className="flex items-center rounded-sm border border-bd-subtle bg-bg-base p-0.5">
              <button
                type="button"
                onClick={() => onSwitchMode(false)}
                disabled={updateMut.isPending || editing}
                className={cn(
                  'rounded-[2px] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  !isRisk
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                Allocation
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode(true)}
                disabled={updateMut.isPending || editing}
                className={cn(
                  'rounded-[2px] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  isRisk
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                Risk-based
              </button>
            </div>
          )}

          {}
          {!editing && (
            <span className="font-mono text-[11px] text-text-primary">
              {isRisk ? (
                <>
                  risk{' '}
                  <span className="text-text-primary">{(strategy.riskPct * 100).toFixed(2)}%</span>
                  <span className="mx-1 text-text-muted">·</span>
                  cap{' '}
                  <span className="text-text-primary">
                    {strategy.capitalAllocationPct.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  allocation{' '}
                  <span className="text-text-primary">
                    {strategy.capitalAllocationPct.toFixed(1)}%
                  </span>
                </>
              )}
            </span>
          )}

          {}
          {editing && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <label className="font-mono text-[10px] text-text-muted">
                  {isRisk ? 'Cap' : 'Allocation'}
                </label>
                <Select value={allocationInput} onValueChange={setAllocationInput}>
                  <SelectTrigger
                    className="h-7 w-[88px] font-mono text-[11px]"
                    aria-label={isRisk ? 'Position cap percent' : 'Allocation percent'}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allocCurrentOffGrid && (
                      <SelectItem value={formatAllocStr(strategy.capitalAllocationPct)}>
                        {formatAllocStr(strategy.capitalAllocationPct)}% (current)
                      </SelectItem>
                    )}
                    {ALLOC_OPTIONS.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isRisk && (
                <div className="flex items-center gap-1">
                  <label className="font-mono text-[10px] text-text-muted">Risk/trade</label>
                  <Select value={riskInput} onValueChange={setRiskInput}>
                    <SelectTrigger
                      className="h-7 w-[88px] font-mono text-[11px]"
                      aria-label="Risk per trade percent"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {riskCurrentOffGrid && (
                        <SelectItem value={formatRiskStr(strategy.riskPct)}>
                          {formatRiskStr(strategy.riskPct)}% (current)
                        </SelectItem>
                      )}
                      {RISK_OPTIONS.map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          {v}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={updateMut.isPending}
                className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-primary hover:bg-bg-hover disabled:opacity-50"
              >
                {updateMut.isPending ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {}
        {!editing && (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex shrink-0 items-center rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary hover:bg-bg-hover"
          >
            Edit
          </button>
        )}
      </div>

      {}
      {isRisk && !editing && (
        <p className="mt-2 border-t border-bd-subtle pt-2 font-mono text-[10px] text-text-muted">
          Long entries: qty = account_balance × risk% ÷ stop_distance · capped at cap% of equity.
          Short entries use allocation sizing unchanged.
        </p>
      )}
    </div>
  );
}

/**
 * V66 — mode toggle on the strategy detail page. Lets the owner flip a
 * single account_strategy row between PAPER (decisions diverted to
 * paper_trade_run, no Binance order) and LIVE (real Binance orders).
 *
 * Two paths because they use different endpoints:
 *   PAPER → LIVE   `useActivateStrategy()` — the V66 backend logic flips
 *                  simulated=false AND auto-promotes the strategy_definition
 *                  through the legal RESEARCH→PAPER_TRADE→PROMOTED graph.
 *                  Confirms first (real money at risk).
 *   LIVE  → PAPER  `useAccountStrategyPromote()` with toState=PAPER_TRADE.
 *                  Demotes the row only — leaves the definition PROMOTED so
 *                  other rows of the same strategy code keep their state.
 *
 * STOPPED rows hide the toggle: the LIVE/STOPPED switch on the strategies
 * list is the canonical place to start a stopped row, and clicking that
 * route already lands the row in LIVE for non-research-agent users.
 */
function StrategyModeToggle({ strategy }: { strategy: AccountStrategy }) {
  const activate = useActivateStrategy();
  const promote = useAccountStrategyPromote();
  const isPaper = strategy.status === 'PAPER';
  const isLive = strategy.status === 'LIVE';
  const isMutating = activate.isPending || promote.isPending;

  if (!isPaper && !isLive) return null;

  const handleSwitchToLive = () => {
    const ok = window.confirm(
      `Switch "${strategy.presetName}" to LIVE? This will place REAL Binance orders on the next closed candle.`,
    );
    if (!ok) return;
    activate.mutate(strategy.id, {
      onSuccess: () =>
        toast.success({ title: 'Switched to LIVE — real orders will fire on next bar close' }),
      onError: (err) =>
        toast.error({ title: 'Could not switch to LIVE', description: normalizeError(err) }),
    });
  };

  const handleSwitchToPaper = () => {
    promote.mutate(
      {
        accountStrategyId: strategy.id,
        toState: 'PAPER_TRADE',
        reason: 'Operator demoted to paper from strategy detail page',
      },
      {
        onSuccess: () =>
          toast.success({ title: 'Switched to PAPER — decisions will divert to paper_trade_run' }),
        onError: (err) =>
          toast.error({ title: 'Could not switch to PAPER', description: normalizeError(err) }),
      },
    );
  };

  if (isPaper) {
    return (
      <button
        type="button"
        onClick={handleSwitchToLive}
        disabled={isMutating}
        title="Flip this row to real Binance orders. Auto-promotes the strategy definition too."
        className="border-[var(--color-profit)]/60 inline-flex items-center gap-1.5 rounded-sm border bg-[var(--bg-base)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-profit)] transition-colors hover:bg-[rgba(22,179,100,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TrendingUp size={11} strokeWidth={1.75} />
        {isMutating ? 'Switching…' : 'Switch to live'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSwitchToPaper}
      disabled={isMutating}
      title="Demote this row to paper. Existing open positions still close real — only NEW entries divert."
      className="border-[var(--color-warning)]/60 inline-flex items-center gap-1.5 rounded-sm border bg-[var(--bg-base)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-warning)] transition-colors hover:bg-[rgba(245,166,35,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ShieldCheck size={11} strokeWidth={1.75} />
      {isMutating ? 'Switching…' : 'Switch to paper'}
    </button>
  );
}

function MetaStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-0.5 font-mono text-sm tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

const LIVE_TAB_TRADE_WINDOW = 200;

function LiveTab({ strategy }: { strategy: AccountStrategy }) {
  // Open positions + recent closes are a live snapshot, scoped to this
  // account_strategy server-side. Open trades for a single strategy are
  // bounded, so this page is complete for the open/recent views.
  const { data, isLoading, isError } = useTradesList({
    accountId: strategy.accountId,
    accountStrategyId: strategy.id,
    size: LIVE_TAB_TRADE_WINDOW,
  });

  // Realized P&L + win rate are authoritative server-side aggregates over ALL
  // of this strategy's closed trades — not a client-truncated page window.
  const statsQuery = useTradeStats({
    accountId: strategy.accountId,
    accountStrategyId: strategy.id,
  });

  const trades: Trades[] = data?.content ?? [];
  const open = trades.filter((t) => t.status === 'OPEN' || t.status === 'PARTIALLY_CLOSED');
  const closed = trades.filter((t) => t.status === 'CLOSED');
  const unrealized = open.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0);
  const realized = statsQuery.data?.cumulativePnl ?? 0;
  const winRate = statsQuery.data?.winRate ?? null;
  const lastClosed = closed[0];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-2">
        <StatCard
          label="Open trades"
          value={open.length.toString()}
          tone={open.length > 0 ? 'profit' : 'neutral'}
        />
        <StatCard
          label="Unrealized"
          value={formatPnl(unrealized)}
          tone={unrealized >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label="Realized"
          value={formatPnl(realized)}
          tone={realized >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label="Win rate"
          value={winRate === null ? '—' : `${(winRate * 100).toFixed(0)}%`}
          tone="neutral"
        />
      </div>

      {}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-panel">
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Open positions
          </h3>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {open.length} active
          </span>
        </header>
        {isLoading ? (
          <ActivitySkeleton rows={2} />
        ) : isError ? (
          <p className="text-xs text-[var(--color-loss)]">Could not load.</p>
        ) : open.length === 0 ? (
          <EmptyTradesRow text="No open positions for this strategy right now." />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {open.slice(0, 5).map((t) => (
              <TradeRow key={t.id} trade={t} variant="open" />
            ))}
          </ul>
        )}
      </section>

      {}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-panel">
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Recent closes
          </h3>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {lastClosed
              ? `last ${formatRelative(lastClosed.exitTime ?? lastClosed.entryTime)}`
              : '—'}
          </span>
        </header>
        {isLoading ? (
          <ActivitySkeleton rows={3} />
        ) : isError ? (
          <p className="text-xs text-[var(--color-loss)]">Could not load.</p>
        ) : closed.length === 0 ? (
          <EmptyTradesRow text="No closed trades yet for this strategy." />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {closed.slice(0, 5).map((t) => (
              <TradeRow key={t.id} trade={t} variant="closed" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'profit' | 'loss' | 'neutral';
}) {
  const colour =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-display text-lg tabular-nums" style={{ color: colour }}>
        {value}
      </div>
    </div>
  );
}

function TradeRow({ trade, variant }: { trade: Trades; variant: 'open' | 'closed' }) {
  const pnl = variant === 'open' ? (trade.unrealizedPnl ?? 0) : (trade.realizedPnl ?? 0);
  const tone = pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  const dirColour = trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)';
  const ts = variant === 'open' ? trade.entryTime : (trade.exitTime ?? trade.entryTime);
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <Link
        href={`/trades/${trade.id}`}
        className="flex min-w-0 items-center gap-3 hover:text-[var(--text-primary)]"
      >
        <span
          className="font-mono uppercase"
          style={{ color: dirColour, fontSize: 10, width: 28, flexShrink: 0 }}
        >
          {trade.direction === 'LONG' ? 'LONG' : 'SHORT'}
        </span>
        <span className="font-mono text-[var(--text-primary)]">{trade.symbol}</span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {trade.entryPrice ? `@${trade.entryPrice.toFixed(2)}` : ''}
        </span>
      </Link>
      <div className="flex items-center gap-3 text-right">
        <span className="font-mono tabular-nums" style={{ color: tone, fontSize: 12 }}>
          {formatPnl(pnl)}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]" style={{ minWidth: 70 }}>
          {ts ? formatRelative(ts) : '—'}
        </span>
      </div>
    </li>
  );
}

function ActivitySkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

function EmptyTradesRow({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--text-muted)]">
      {text}
    </p>
  );
}

function formatPnl(value: number): string {
  if (value === 0) return '0.00';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatRelative(epochMs: number | null | undefined): string {
  if (!epochMs) return '—';
  const diffMs = Date.now() - epochMs;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

function OverviewTab({ strategy }: { strategy: AccountStrategy }) {
  const riskSizingApplies = strategyControlsRiskSizing(strategy.strategyCode);
  const rows: Array<{ label: string; value: React.ReactNode; icon?: React.ElementType }> = [
    { label: 'Account Strategy ID', value: strategy.id, icon: Hash },
    { label: 'Account ID', value: strategy.accountId, icon: Hash },
    { label: 'Strategy Code', value: strategy.strategyCode },
    { label: 'Symbol', value: strategy.symbol },
    { label: 'Interval', value: strategy.interval },
    { label: 'Status', value: <StrategyStatusBadge status={strategy.status} /> },
    {
      label:
        riskSizingApplies && strategy.useRiskBasedSizing ? 'Position Cap' : 'Capital Allocation',
      value: `${strategy.capitalAllocationPct.toFixed(2)}%`,
    },
    ...(riskSizingApplies
      ? [
          {
            label: 'Sizing Mode',
            value: strategy.useRiskBasedSizing
              ? `Risk-based · ${(strategy.riskPct * 100).toFixed(2)}%/trade`
              : 'Direct allocation',
          },
        ]
      : []),
    {
      label: 'Max Open Positions',
      value: strategy.maxOpenPositions || '—',
    },
    { label: 'Allow Long', value: strategy.allowLong ? 'Yes' : 'No' },
    { label: 'Allow Short', value: strategy.allowShort ? 'Yes' : 'No' },
    { label: 'Priority Order', value: `#${strategy.priorityOrder}` },
    { label: 'Created', value: formatIso(strategy.createdAt), icon: Calendar },
    { label: 'Updated', value: formatIso(strategy.updatedAt), icon: Calendar },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-panel">
      <table className="w-full">
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map(({ label, value, icon: Icon }) => (
            <tr key={label}>
              <td className="w-1/3 px-4 py-2.5 align-top">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  {Icon && <Icon size={12} />}
                  {label}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono text-sm text-[var(--text-primary)]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrategyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
