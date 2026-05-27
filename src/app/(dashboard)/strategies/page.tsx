'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Radio,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { NewStrategyDialog } from '@/components/strategy/NewStrategyDialog';
import { DeleteStrategyDialog } from '@/components/strategy/DeleteStrategyDialog';
import { CloneStrategyDialog } from '@/components/strategy/CloneStrategyDialog';
import { RearmKillSwitchDialog } from '@/components/strategy/RearmKillSwitchDialog';
import { SwitchToLiveDialog } from '@/components/strategy/SwitchToLiveDialog';
import { StartStrategyMenu, SwitchModeButton } from '@/components/strategy/StrategyModeControls';
import { StrategyTopRunsDialog } from '@/components/strategy/StrategyTopRunsDialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useActivateStrategy,
  useAllVisibleStrategies,
  useDeactivateStrategy,
  useRearmKillSwitch,
  useUpdateStrategyInterval,
  useUpdateStrategyPriority,
} from '@/hooks/useStrategies';
import { useAccountStrategyPromote } from '@/hooks/useStrategyPromotion';
import { useActiveAccount, useUpdateAccountRiskConfig } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { INTERVALS } from '@/lib/constants';
import type { AccountStrategy } from '@/types/strategy';
import type { AccountSummary } from '@/types/account';

/** Key identifying a preset family: presets with the same key compete for "active". */
function tupleKey(s: AccountStrategy): string {
  return `${s.accountId}::${s.strategyCode}::${s.symbol}::${s.interval}`;
}

/**
 * V54 — card body wrapper. Owned rows wrap in a `<Link>` to /strategies/[id]
 * so the user can edit params; PUBLIC foreign rows render a plain `<div>`
 * because the detail route enforces ownership and would 404. The Clone
 * button on read-only cards is the only action.
 */
function CardBody({
  readOnly,
  href,
  className,
  children,
}: {
  readOnly: boolean;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (readOnly) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function StrategyCard({
  strategy,
  position,
  groupHasOtherPreset,
  onDelete,
  onClone,
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  onTopRuns,
  onStartAsPaper,
  onStartAsLive,
  onSwitchToPaper,
  onSwitchToLive,
  isActivating,
  isDeactivating,
  isUpdatingInterval,
  isRearming,
  isPromoting,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  strategy: AccountStrategy;
  /** 1-based position within the strategy's interval group. */
  position: number;
  groupHasOtherPreset: boolean;
  onDelete: (s: AccountStrategy) => void;
  onClone: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  onTopRuns: (s: AccountStrategy) => void;
  onStartAsPaper: (s: AccountStrategy) => void;
  onStartAsLive: (s: AccountStrategy) => void;
  onSwitchToPaper: (s: AccountStrategy) => void;
  onSwitchToLive: (s: AccountStrategy) => void;
  isActivating: boolean;
  isDeactivating: boolean;
  isUpdatingInterval: boolean;
  isRearming: boolean;
  isPromoting: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const isLive = strategy.status === 'LIVE';
  const isPaper = strategy.status === 'PAPER';
  const isRunning = isLive || isPaper;
  const isToggling = isActivating || isDeactivating;

  const isReadOnlyPublic = !strategy.ownedByCurrentUser;
  return (
    <div
      draggable={!isReadOnlyPublic}
      onDragStart={(e) => {
        if (isReadOnlyPublic) return;
        // eslint-disable-next-line no-param-reassign
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', strategy.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={isReadOnlyPublic ? undefined : onDragOver}
      onDragLeave={isReadOnlyPublic ? undefined : onDragLeave}
      onDrop={isReadOnlyPublic ? undefined : onDrop}
      className={cn(
        'group relative flex flex-col justify-between gap-4 rounded-xl border bg-[var(--bg-surface)] p-5 shadow-panel transition-all',
        isLive
          ? 'border-[var(--color-profit)]/60 shadow-[0_0_0_1px_var(--color-profit),0_8px_24px_rgba(22,179,100,0.14)]'
          : isPaper
            ? 'border-[var(--color-warning)]/60 shadow-[0_0_0_1px_var(--color-warning),0_8px_24px_rgba(245,166,35,0.12)]'
            : isReadOnlyPublic
              ? 'border-[var(--accent-primary)]/40 border-dashed hover:-translate-y-px hover:border-[var(--accent-primary)] hover:shadow-float'
              : 'border-[var(--border-subtle)] hover:-translate-y-px hover:border-[var(--border-default)] hover:shadow-float',
        isDragging && 'cursor-grabbing opacity-40',
        isDragOver && 'ring-[var(--accent-primary)]/60 border-[var(--accent-primary)] ring-2',
      )}
      style={{ cursor: isDragging ? 'grabbing' : undefined }}
    >
      {isReadOnlyPublic ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClone(strategy);
          }}
          className="border-[var(--accent-primary)]/40 absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-[var(--text-inverse)]"
          aria-label={`Clone preset ${strategy.presetName} to my account`}
        >
          <Copy size={11} />
          Clone
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(strategy);
          }}
          className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-all hover:bg-[rgba(229,72,77,0.12)] hover:text-[var(--color-loss)] focus:opacity-100 group-hover:opacity-100"
          aria-label={`Delete preset ${strategy.presetName}`}
        >
          <Trash2 size={14} />
        </button>
      )}

      {}
      <CardBody
        readOnly={isReadOnlyPublic}
        href={`/strategies/${strategy.id}`}
        className="flex flex-col gap-4"
      >
        {}
        <div className="flex items-start justify-between gap-3 pl-10 pr-8">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <StrategyBadge code={strategy.strategyCode} size="sm" />
              {isReadOnlyPublic && (
                <span
                  className="bg-[var(--accent-primary)]/12 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-primary)]"
                  title={`Owned by ${strategy.ownerLabel} — clone to edit or run`}
                >
                  {strategy.ownerLabel}
                </span>
              )}
            </div>
            <span
              className="truncate text-[11px] text-[var(--text-secondary)]"
              title={strategy.presetName}
            >
              {strategy.presetName}
            </span>
          </div>
          {isReadOnlyPublic ? (
            <span
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]"
              title="Public preset — clone to your account before enabling"
            >
              Read-only
            </span>
          ) : (
            <StatusToggle
              status={strategy.status}
              disabled={isToggling}
              onToggle={() => (isRunning ? onDeactivate(strategy) : onActivate(strategy))}
            />
          )}
        </div>

        {}
        <div>
          <div
            className="mm-display"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--mm-ink-0)',
              lineHeight: 1.1,
            }}
          >
            {strategy.symbol}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: 'var(--mm-ink-2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IntervalSelect
              value={strategy.interval}
              disabled={isUpdatingInterval || isReadOnlyPublic}
              onChange={(v) => onIntervalChange(strategy, v)}
            />
          </div>
        </div>

        {}
        <div
          className="grid grid-cols-2 gap-3 border-t pt-3"
          style={{ borderColor: 'var(--mm-hair-2)' }}
        >
          <SizingStat strategy={strategy} />
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Side
            </div>
            <div className="mt-1 flex items-center gap-1">
              <DirectionPill direction="long" enabled={strategy.allowLong} />
              <DirectionPill direction="short" enabled={strategy.allowShort} />
            </div>
          </div>
        </div>

        {}
        {isReadOnlyPublic ? (
          <div
            className="flex items-center border-t pt-3"
            style={{ borderColor: 'var(--mm-hair-2)' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              Public preset
            </span>
          </div>
        ) : (
          <div
            className="flex items-center justify-end border-t pt-3"
            style={{ borderColor: 'var(--mm-hair-2)' }}
          >
            <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] transition-colors group-hover:text-text-primary">
              Edit params
              <ChevronRight size={12} />
            </span>
          </div>
        )}
      </CardBody>

      {}
      {!isReadOnlyPublic && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-[var(--text-secondary)] opacity-70 transition-opacity group-hover:opacity-100"
          title="Drag to reorder — priority within this interval group"
        >
          <GripVertical size={10} />#{position}
        </span>
      )}

      {strategy.isKillSwitchTripped && (
        <KillSwitchPanel strategy={strategy} onRearm={onRearm} isRearming={isRearming} />
      )}

      {!isReadOnlyPublic && (
        <div
          className="-mt-2 flex items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: 'var(--mm-hair-2)' }}
        >
          {isRunning ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{
                color: isPaper ? 'var(--color-warning)' : 'var(--color-profit)',
                backgroundColor: isPaper ? 'rgba(245,166,35,0.12)' : 'rgba(22,179,100,0.12)',
              }}
            >
              <Radio size={11} className={isLive ? 'animate-pulse' : ''} />
              {groupHasOtherPreset ? 'Active preset' : 'Running'} · {isPaper ? 'paper' : 'live'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Inactive
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTopRuns(strategy);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 text-[11px] text-text-secondary transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-text-primary"
            >
              <TrendingUp size={11} strokeWidth={1.75} />
              Top runs
            </button>
            {isRunning ? (
              <SwitchModeButton
                strategy={strategy}
                onSwitchToPaper={onSwitchToPaper}
                onSwitchToLive={onSwitchToLive}
                isPending={isActivating || isPromoting}
              />
            ) : (
              <StartStrategyMenu
                strategy={strategy}
                onStartAsPaper={onStartAsPaper}
                onStartAsLive={onStartAsLive}
                isPending={isActivating || isPromoting}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * V55 — sizing-mode aware stat cell.
 *
 * `capital_allocation_pct` plays two different roles depending on
 * `use_risk_based_sizing`:
 *  - **Risk-based ON**:  the per-trade *risk* is `risk_pct` of cash; the
 *                        position is capped at `capital_allocation_pct`.
 *  - **Risk-based OFF**: `capital_allocation_pct` is the trade size itself.
 *
 * Naming the first cell "Allocation" in both modes is what the user flagged
 * as confusing. We instead name the cell after the *active* concept and
 * surface the secondary number on a sublabel — so the card reads correctly
 * without anyone having to remember which mode this preset is in.
 */
function SizingStat({ strategy }: { strategy: AccountStrategy }) {
  const useRisk = Boolean(strategy.useRiskBasedSizing);
  const allocation = strategy.capitalAllocationPct ?? 0;

  const riskPctDisplay = (strategy.riskPct ?? 0) * 100;

  const label = useRisk ? 'Risk per trade' : 'Trade size';
  const primary = useRisk ? riskPctDisplay : allocation;
  const subline = useRisk
    ? allocation >= 100
      ? 'of cash · uncapped'
      : `of cash · cap ${allocation.toFixed(0)}%`
    : 'of cash · direct';
  const tooltip = useRisk
    ? `Risk-based sizing: each trade risks ${riskPctDisplay.toFixed(2)}% of cash. ` +
      `Position size is auto-derived from the stop distance and capped at ` +
      `${allocation.toFixed(0)}% of cash.`
    : `Direct allocation: each trade uses ${allocation.toFixed(1)}% of cash as the trade ` +
      `notional. Stop loss runs inside the position. Switch to risk-based sizing in Edit params.`;
  return (
    <div title={tooltip}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--mm-ink-2)',
        }}
      >
        {label}
      </div>
      <div
        className="mm-num"
        style={{
          fontSize: 16,
          color: useRisk ? 'var(--brand-500)' : 'var(--mm-ink-0)',
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {primary.toFixed(1)}%
      </div>
      <div
        className="font-mono"
        style={{
          marginTop: 2,
          fontSize: 9,
          letterSpacing: '0.02em',
          color: 'var(--mm-ink-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {subline}
      </div>
    </div>
  );
}

function IntervalSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const options = INTERVALS.includes(value as (typeof INTERVALS)[number])
    ? INTERVALS
    : [value, ...INTERVALS];
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        if (e.target.value !== value) onChange(e.target.value);
      }}
      className="ml-2 cursor-pointer rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-normal text-[var(--text-muted)] outline-none transition-colors hover:text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Strategy interval"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function StatusToggle({
  status,
  disabled,
  onToggle,
}: {
  status: AccountStrategy['status'];
  disabled: boolean;
  onToggle: () => void;
}) {
  const isRunning = status === 'LIVE' || status === 'PAPER';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className="rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={isRunning ? 'Stop strategy' : 'Start strategy'}
      title={isRunning ? 'Click to stop' : 'Click to start'}
    >
      <StrategyStatusBadge status={status} />
    </button>
  );
}

function DirectionPill({ direction, enabled }: { direction: 'long' | 'short'; enabled: boolean }) {
  const Icon = direction === 'long' ? ArrowUpRight : ArrowDownRight;
  const activeColor = direction === 'long' ? 'var(--color-profit)' : 'var(--color-loss)';
  const bg = direction === 'long' ? 'rgba(22,179,100,0.12)' : 'rgba(229,72,77,0.1)';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
      )}
      style={{
        backgroundColor: enabled ? bg : 'var(--bg-elevated)',
        color: enabled ? activeColor : 'var(--text-muted)',
      }}
    >
      <Icon size={10} />
      {direction === 'long' ? 'L' : 'S'}
    </span>
  );
}

/**
 * Surfaces the drawdown kill-switch trip on a card. Shows the trip reason +
 * how long ago it tripped, plus a Re-arm button that calls
 * POST /:id/rearm to clear the flag. Sits below the card's main Link so
 * the button is not nested inside an anchor.
 */
function KillSwitchPanel({
  strategy,
  onRearm,
  isRearming,
}: {
  strategy: AccountStrategy;
  onRearm: (s: AccountStrategy) => void;
  isRearming: boolean;
}) {
  const trippedAt = strategy.killSwitchTrippedAt;
  const reason = strategy.killSwitchReason?.trim() || 'Drawdown kill-switch tripped';
  const trippedLabel = trippedAt
    ? formatDistanceToNow(new Date(trippedAt), { addSuffix: true })
    : null;

  return (
    <div
      className="-mt-2 flex items-start gap-2 rounded-md border px-3 py-2"
      style={{
        borderColor: 'rgba(229,72,77,0.32)',
        backgroundColor: 'rgba(229,72,77,0.08)',
      }}
      role="alert"
    >
      <ShieldAlert size={14} style={{ color: 'var(--color-loss)', marginTop: 2 }} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-loss)]">
          Kill-switch tripped
          {trippedLabel ? (
            <span className="ml-1.5 font-normal normal-case text-[var(--text-muted)]">
              · {trippedLabel}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-[11px] text-[var(--text-secondary)]" title={reason}>
          {reason}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRearm(strategy);
        }}
        disabled={isRearming}
        className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: 'rgba(229,72,77,0.32)',
          color: 'var(--color-loss)',
          backgroundColor: 'transparent',
        }}
      >
        {isRearming ? <Loader2 size={10} className="animate-spin" /> : <ShieldAlert size={10} />}
        {isRearming ? 'Re-arming…' : 'Re-arm'}
      </button>
    </div>
  );
}

/**
 * Inline editor for the per-account "max concurrent trades" cap. Local
 * draft state keeps the input responsive; commit on blur or Enter, snap
 * back to the row's value if the entered number is invalid.
 */
function MaxTradesPanel({
  account,
  disabled,
  onChange,
}: {
  account: AccountSummary;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  const value = account.maxConcurrentTrades == null ? 'none' : String(account.maxConcurrentTrades);

  const handleChange = (v: string) => {
    if (v === 'none') {
      if (account.maxConcurrentTrades != null) onChange(null);
    } else {
      const n = Number(v);
      if (n !== account.maxConcurrentTrades) onChange(n);
    }
  };

  return (
    <div
      className="mm-card flex items-center justify-between gap-3"
      style={{ padding: '14px 18px' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'var(--accent-subtle)',
            color: 'var(--brand-500)',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--mm-mono)',
          }}
        >
          {account.label.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mm-ink-2)',
              fontFamily: 'var(--mm-mono)',
            }}
          >
            Max concurrent trades
          </div>
          <div
            className="truncate"
            style={{ fontSize: 13, color: 'var(--mm-ink-1)', marginTop: 2 }}
          >
            {account.label}
          </div>
        </div>
      </div>
      <Select value={value} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger
          className="w-28 font-mono tabular-nums"
          style={{ fontSize: 13 }}
          aria-label={`Max concurrent trades for ${account.label}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="font-mono">
            No cap
          </SelectItem>
          {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)} className="font-mono tabular-nums">
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Stable display order for backtest-supported intervals. Anything not in
 * this list (e.g., legacy 30m/1d) sorts to the end alphabetically so the
 * UI doesn't drop unfamiliar values.
 */
const INTERVAL_ORDER = ['5m', '15m', '1h', '4h'] as const;
function compareIntervals(a: string, b: string): number {
  const ia = INTERVAL_ORDER.indexOf(a as (typeof INTERVAL_ORDER)[number]);
  const ib = INTERVAL_ORDER.indexOf(b as (typeof INTERVAL_ORDER)[number]);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

/**
 * Renders one interval-group of cards and owns its drag-drop state. Drag
 * state is per-section so reordering in the 15m group doesn't ghost the
 * 1h group. Priority is per-interval — a "#1" in the 15m group has nothing
 * to do with "#1" in the 1h group, mirroring the orchestrator's
 * per-interval-group cap.
 */
function IntervalGroupSortable({
  interval,
  strategies,
  presetsByTuple,
  onDelete,
  onClone,
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  onTopRuns,
  onReorder,
  onStartAsPaper,
  onStartAsLive,
  onSwitchToPaper,
  onSwitchToLive,
  activatingId,
  deactivatingId,
  updatingIntervalId,
  rearmingId,
  promotingId,
}: {
  interval: string;
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  onDelete: (s: AccountStrategy) => void;
  onClone: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  onTopRuns: (s: AccountStrategy) => void;
  onReorder: (sourceId: string, targetId: string, ordered: AccountStrategy[]) => void;
  onStartAsPaper: (s: AccountStrategy) => void;
  onStartAsLive: (s: AccountStrategy) => void;
  onSwitchToPaper: (s: AccountStrategy) => void;
  onSwitchToLive: (s: AccountStrategy) => void;
  activatingId: string | undefined;
  deactivatingId: string | undefined;
  updatingIntervalId: string | undefined;
  rearmingId: string | undefined;
  promotingId: string | undefined;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sorted = [...strategies].sort((a, b) => a.priorityOrder - b.priorityOrder);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const sourceIdx = sorted.findIndex((s) => s.id === draggedId);
    const targetIdx = sorted.findIndex((s) => s.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(draggedId, targetId, reordered);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          Interval
        </span>
        <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
          {interval}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          · {sorted.length} preset{sorted.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((s, idx) => (
          <StrategyCard
            key={s.id}
            strategy={s}
            position={idx + 1}
            groupHasOtherPreset={(presetsByTuple.get(tupleKey(s)) ?? 0) > 1}
            onDelete={onDelete}
            onClone={onClone}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            onIntervalChange={onIntervalChange}
            onRearm={onRearm}
            onTopRuns={onTopRuns}
            onStartAsPaper={onStartAsPaper}
            onStartAsLive={onStartAsLive}
            onSwitchToPaper={onSwitchToPaper}
            onSwitchToLive={onSwitchToLive}
            isActivating={activatingId === s.id}
            isDeactivating={deactivatingId === s.id}
            isUpdatingInterval={updatingIntervalId === s.id}
            isRearming={rearmingId === s.id}
            isPromoting={promotingId === s.id}
            isDragging={draggedId === s.id}
            isDragOver={dragOverId === s.id}
            onDragStart={() => setDraggedId(s.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              // eslint-disable-next-line no-param-reassign
              e.dataTransfer.dropEffect = 'move';
              if (draggedId && draggedId !== s.id) setDragOverId(s.id);
            }}
            onDragLeave={() => setDragOverId((prev) => (prev === s.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(s.id);
              setDragOverId(null);
            }}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * V54 — read-only browse-and-clone section for PUBLIC strategies (today, the
 * research-agent's catalogue). Rendered separately from the per-account
 * grouping so PUBLIC rows don't appear as a confusing "ghost account" under
 * the user's own account headers. All mutate handlers are no-ops because
 * StrategyCard already routes everything through the Clone button when
 * `ownedByCurrentUser=false`.
 */
function PublicStrategiesSection({
  strategies,
  presetsByTuple,
  onClone,
  onTopRuns,
}: {
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  onClone: (s: AccountStrategy) => void;
  onTopRuns: (s: AccountStrategy) => void;
}) {
  const noop = () => {};

  const byInterval = new Map<string, AccountStrategy[]>();
  for (const s of strategies) {
    const list = byInterval.get(s.interval) ?? [];
    list.push(s);
    byInterval.set(s.interval, list);
  }
  const orderedIntervals = Array.from(byInterval.keys()).sort(compareIntervals);
  return (
    <section className="space-y-3 border-t border-[var(--border-subtle)] pt-6">
      <header className="flex items-baseline gap-2 px-1">
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Research Agent · Public Strategies
        </h2>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          · clone to your account before enabling
        </span>
      </header>
      <div className="space-y-5">
        {orderedIntervals.map((interval) => {
          const sorted = (byInterval.get(interval) ?? [])
            .slice()
            .sort((a, b) => a.priorityOrder - b.priorityOrder);
          return (
            <div key={`public::${interval}`} className="space-y-2">
              <div className="flex items-baseline gap-2 px-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Interval
                </span>
                <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                  {interval}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  · {sorted.length} preset{sorted.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sorted.map((s, idx) => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    position={idx + 1}
                    groupHasOtherPreset={(presetsByTuple.get(tupleKey(s)) ?? 0) > 1}
                    onDelete={noop}
                    onClone={onClone}
                    onActivate={noop}
                    onDeactivate={noop}
                    onIntervalChange={noop}
                    onRearm={noop}
                    onTopRuns={onTopRuns}
                    onStartAsPaper={noop}
                    onStartAsLive={noop}
                    onSwitchToPaper={noop}
                    onSwitchToLive={noop}
                    isActivating={false}
                    isDeactivating={false}
                    isUpdatingInterval={false}
                    isRearming={false}
                    isPromoting={false}
                    isDragging={false}
                    isDragOver={false}
                    onDragStart={noop}
                    onDragEnd={noop}
                    onDragOver={noop}
                    onDragLeave={noop}
                    onDrop={noop}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StrategyCardSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-14" />
      </div>
      <Skeleton className="mt-3 h-4 w-24" />
      <Skeleton className="mt-4 h-6 w-32" />
      <Skeleton className="mt-4 h-3 w-24" />
    </div>
  );
}

export default function StrategiesPage() {
  const { data: strategies = [], isLoading, isError, refetch } = useAllVisibleStrategies();
  const { accounts, isAll, activeAccount, scopedAccountId } = useActiveAccount();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AccountStrategy | null>(null);
  const [cloneTarget, setCloneTarget] = useState<AccountStrategy | null>(null);
  const [rearmTarget, setRearmTarget] = useState<AccountStrategy | null>(null);
  const [topRunsTarget, setTopRunsTarget] = useState<AccountStrategy | null>(null);
  const [liveConfirmTarget, setLiveConfirmTarget] = useState<{
    strategy: AccountStrategy;
    fromStopped: boolean;
  } | null>(null);
  const activateMutation = useActivateStrategy();
  const deactivateMutation = useDeactivateStrategy();
  const intervalMutation = useUpdateStrategyInterval();
  const priorityMutation = useUpdateStrategyPriority();
  const rearmMutation = useRearmKillSwitch();
  const promoteMutation = useAccountStrategyPromote();
  const riskConfigMutation = useUpdateAccountRiskConfig();

  const ownedStrategies = scopedAccountId
    ? strategies.filter((s) => s.ownedByCurrentUser && s.accountId === scopedAccountId)
    : strategies.filter((s) => s.ownedByCurrentUser);
  const publicStrategies = strategies.filter((s) => !s.ownedByCurrentUser);
  const filteredOwned = showActiveOnly
    ? ownedStrategies.filter((s) => s.status === 'LIVE')
    : ownedStrategies;

  const presetsByTuple = new Map<string, number>();
  for (const s of ownedStrategies) {
    const k = tupleKey(s);
    presetsByTuple.set(k, (presetsByTuple.get(k) ?? 0) + 1);
  }

  const handleActivate = (strategy: AccountStrategy) => {
    activateMutation.mutate(strategy.id, {
      onSuccess: (s) => {
        toast.success({
          title: `Activated "${s.presetName}"`,
          description: `${s.strategyCode} · ${s.symbol} ${s.interval}`,
        });
      },
      onError: (err) => {
        toast.error({
          title: 'Could not activate preset',
          description: normalizeError(err),
        });
      },
    });
  };

  const handleStartAsPaper = (strategy: AccountStrategy) => {
    promoteMutation.mutate(
      {
        accountStrategyId: strategy.id,
        toState: 'PAPER_TRADE',
        reason: 'Operator started in paper mode from the strategies list',
      },
      {
        onSuccess: () => {
          toast.success({
            title: `Started "${strategy.presetName}" in paper mode`,
            description: 'Decisions divert to paper_trade_run — no Binance orders.',
          });
        },
        onError: (err) => {
          toast.error({
            title: 'Could not start in paper mode',
            description: normalizeError(err),
          });
        },
      },
    );
  };

  const handleSwitchToPaper = (strategy: AccountStrategy) => {
    promoteMutation.mutate(
      {
        accountStrategyId: strategy.id,
        toState: 'PAPER_TRADE',
        reason: 'Operator demoted to paper from the strategies list',
      },
      {
        onSuccess: () => {
          toast.success({
            title: `Switched "${strategy.presetName}" to paper`,
            description: 'Open positions still close real; new entries divert to paper.',
          });
        },
        onError: (err) => {
          toast.error({
            title: 'Could not switch to paper',
            description: normalizeError(err),
          });
        },
      },
    );
  };

  const confirmSwitchToLive = (strategy: AccountStrategy) => {
    activateMutation.mutate(strategy.id, {
      onSuccess: (s) => {
        toast.success({
          title: `"${s.presetName}" is LIVE`,
          description: `${s.strategyCode} · ${s.symbol} ${s.interval} — real orders fire on next bar close.`,
        });
        setLiveConfirmTarget(null);
      },
      onError: (err) => {
        toast.error({
          title: 'Could not switch to LIVE',
          description: normalizeError(err),
        });
      },
    });
  };

  const handleDeactivate = (strategy: AccountStrategy) => {
    deactivateMutation.mutate(strategy.id, {
      onSuccess: (s) => {
        toast.success({
          title: `Stopped "${s.presetName}"`,
          description: 'Open positions will continue to be managed until they close.',
        });
      },
      onError: (err) => {
        toast.error({
          title: 'Could not stop preset',
          description: normalizeError(err),
        });
      },
    });
  };

  const handleRearmConfirmed = (strategy: AccountStrategy) => {
    rearmMutation.mutate(strategy.id, {
      onSuccess: (s) => {
        toast.success({
          title: `Re-armed "${s.presetName}"`,
          description: 'Kill-switch cleared — strategy resumes on the next signal.',
        });
        setRearmTarget(null);
      },
      onError: (err) => {
        toast.error({
          title: 'Could not re-arm kill-switch',
          description: normalizeError(err),
        });
      },
    });
  };

  const handleIntervalChange = (strategy: AccountStrategy, intervalName: string) => {
    intervalMutation.mutate(
      { id: strategy.id, intervalName },
      {
        onSuccess: (s) => {
          toast.success({
            title: `Interval changed`,
            description: `${s.presetName} now runs on ${s.interval}.`,
          });
        },
        onError: (err) => {
          toast.error({
            title: 'Could not change interval',
            description: normalizeError(err),
          });
        },
      },
    );
  };

  /**
   * Drop handler: takes the freshly-reordered list within an interval
   * group and PATCHes priorityOrder on every row whose position changed.
   * Priorities are 1-based within the group — different groups can share
   * numbers because the orchestrator scopes the cap per (account, interval).
   */
  const handleReorder = (_sourceId: string, _targetId: string, ordered: AccountStrategy[]) => {
    const updates = ordered
      .map((s, i) => ({ id: s.id, newPriority: i + 1, oldPriority: s.priorityOrder }))
      .filter((u) => u.newPriority !== u.oldPriority);
    if (updates.length === 0) return;
    for (const u of updates) {
      priorityMutation.mutate(
        { id: u.id, priorityOrder: u.newPriority },
        {
          onError: (err) => {
            toast.error({
              title: 'Could not update priority',
              description: normalizeError(err),
            });
          },
        },
      );
    }
  };

  const handleTopRuns = (strategy: AccountStrategy) => setTopRunsTarget(strategy);

  const handleMaxTradesChange = (accountId: string, value: number | null) => {
    const wireValue = value == null || value < 1 ? 0 : Math.trunc(value);
    riskConfigMutation.mutate(
      { accountId, payload: { maxConcurrentTrades: wireValue } },
      {
        onSuccess: (a) => {
          toast.success({
            title: `Max trades updated`,
            description:
              a.maxConcurrentTrades == null
                ? `${a.label}: cap cleared (no total limit).`
                : `${a.label}: max ${a.maxConcurrentTrades} concurrent trade(s).`,
          });
        },
        onError: (err) => {
          toast.error({
            title: 'Could not update max trades',
            description: normalizeError(err),
          });
        },
      },
    );
  };

  const headerSubtitle = isAll
    ? `${showActiveOnly ? 'Active strategies' : 'All presets'} across ${accounts.length} account${accounts.length === 1 ? '' : 's'}.`
    : activeAccount
      ? `${showActiveOnly ? 'Active strategies' : 'All presets'} on ${activeAccount.label}.`
      : `${showActiveOnly ? 'Active strategies' : 'All presets'}.`;

  const canCreate = accounts.some((a) => a.active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account strategies"
        title="Strategies"
        description={headerSubtitle}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowActiveOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                showActiveOnly
                  ? 'bg-[var(--color-mint)]/10 border-[var(--color-mint)] text-[var(--color-mint)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Radio size={12} strokeWidth={2.2} className="shrink-0" />
              {showActiveOnly ? 'Show all' : 'Active only'}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreate}
              className="mm-btn mm-btn-mint inline-flex items-center gap-1 whitespace-nowrap"
              style={{ padding: '10px 18px', borderRadius: 9999, fontSize: 14 }}
            >
              <Plus size={14} strokeWidth={2.2} className="shrink-0" />
              New Preset
            </button>
          </div>
        }
      />

      {}
      {accounts.length > 0 && (
        <section className="space-y-2">
          {(scopedAccountId ? accounts.filter((a) => a.id === scopedAccountId) : accounts).map(
            (acc) => (
              <MaxTradesPanel
                key={acc.id}
                account={acc}
                disabled={
                  riskConfigMutation.isPending && riskConfigMutation.variables?.accountId === acc.id
                }
                onChange={(value) => handleMaxTradesChange(acc.id, value)}
              />
            ),
          )}
        </section>
      )}

      {isError ? (
        <EmptyState
          title="Could not load strategies"
          description="The strategies endpoint returned an error."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Retry
            </button>
          }
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <StrategyCardSkeleton key={i} />
          ))}
        </div>
      ) : ownedStrategies.length === 0 && publicStrategies.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={
            isAll
              ? 'No strategies yet'
              : `No strategies on ${activeAccount?.label ?? 'this account'}`
          }
          description={
            isAll
              ? 'Once an account has an active strategy configured, it will appear here.'
              : 'Switch to another account from the top bar, or configure a strategy here.'
          }
        />
      ) : (
        <>
          {filteredOwned.length === 0 ? (
            <EmptyState
              icon={Zap}
              title={
                showActiveOnly && ownedStrategies.length > 0
                  ? 'No active strategies'
                  : isAll
                    ? 'No strategies of your own yet'
                    : `No strategies on ${activeAccount?.label ?? 'this account'}`
              }
              description={
                showActiveOnly && ownedStrategies.length > 0
                  ? `${ownedStrategies.length} preset${ownedStrategies.length === 1 ? '' : 's'} exist but none are active — toggle "All presets" to see them.`
                  : publicStrategies.length > 0
                    ? 'Browse the public catalogue below and clone one to get started.'
                    : 'Create a preset to get started.'
              }
              action={
                showActiveOnly && ownedStrategies.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowActiveOnly(false)}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    Show all presets
                  </button>
                ) : undefined
              }
            />
          ) : (
            <AccountsAndIntervalsView
              accounts={accounts}
              strategies={filteredOwned}
              presetsByTuple={presetsByTuple}
              showAccountHeaders={isAll && accounts.length > 1}
              onDelete={setDeleteTarget}
              onClone={setCloneTarget}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onIntervalChange={handleIntervalChange}
              onRearm={setRearmTarget}
              onTopRuns={handleTopRuns}
              onReorder={handleReorder}
              onStartAsPaper={handleStartAsPaper}
              onStartAsLive={(s) => setLiveConfirmTarget({ strategy: s, fromStopped: true })}
              onSwitchToPaper={handleSwitchToPaper}
              onSwitchToLive={(s) => setLiveConfirmTarget({ strategy: s, fromStopped: false })}
              activatingId={activateMutation.isPending ? activateMutation.variables : undefined}
              deactivatingId={
                deactivateMutation.isPending ? deactivateMutation.variables : undefined
              }
              updatingIntervalId={
                intervalMutation.isPending ? intervalMutation.variables?.id : undefined
              }
              rearmingId={rearmMutation.isPending ? rearmMutation.variables : undefined}
              promotingId={
                promoteMutation.isPending ? promoteMutation.variables?.accountStrategyId : undefined
              }
            />
          )}
          {publicStrategies.length > 0 && (
            <PublicStrategiesSection
              strategies={publicStrategies}
              presetsByTuple={presetsByTuple}
              onClone={setCloneTarget}
              onTopRuns={handleTopRuns}
            />
          )}
        </>
      )}

      <NewStrategyDialog
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        defaultAccountId={scopedAccountId}
      />
      <DeleteStrategyDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        strategy={deleteTarget}
      />
      <CloneStrategyDialog
        open={Boolean(cloneTarget)}
        onOpenChange={(open) => {
          if (!open) setCloneTarget(null);
        }}
        strategy={cloneTarget}
      />
      <RearmKillSwitchDialog
        open={Boolean(rearmTarget)}
        onOpenChange={(open) => {
          if (!open && !rearmMutation.isPending) setRearmTarget(null);
        }}
        strategy={rearmTarget}
        isRearming={rearmMutation.isPending && rearmMutation.variables === rearmTarget?.id}
        onConfirm={handleRearmConfirmed}
      />
      <SwitchToLiveDialog
        open={Boolean(liveConfirmTarget)}
        onOpenChange={(open) => {
          if (
            !open &&
            !(
              activateMutation.isPending &&
              activateMutation.variables === liveConfirmTarget?.strategy.id
            )
          ) {
            setLiveConfirmTarget(null);
          }
        }}
        strategy={liveConfirmTarget?.strategy ?? null}
        fromStopped={liveConfirmTarget?.fromStopped ?? false}
        isPending={
          activateMutation.isPending &&
          activateMutation.variables === liveConfirmTarget?.strategy.id
        }
        onConfirm={confirmSwitchToLive}
      />
      <StrategyTopRunsDialog
        open={topRunsTarget != null}
        onOpenChange={(open) => { if (!open) setTopRunsTarget(null); }}
        strategy={topRunsTarget}
      />
    </div>
  );
}

/**
 * Orders presets so sibling presets (same tuple) are adjacent, with the
 * active preset first inside each cluster. Keeps the grid reading like
 * "here's the strategy, these are its variants" instead of scrambled.
 */
/**
 * Renders strategies grouped first by account, then by interval. Each
 * (account, interval) leaf is a sortable grid where dragging a card
 * rewrites priorityOrder within that group only — different intervals
 * have independent priority numbers because the orchestrator's cap is
 * per-interval-group.
 */
function AccountsAndIntervalsView({
  accounts,
  strategies,
  presetsByTuple,
  showAccountHeaders,
  onDelete,
  onClone,
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  onTopRuns,
  onReorder,
  onStartAsPaper,
  onStartAsLive,
  onSwitchToPaper,
  onSwitchToLive,
  activatingId,
  deactivatingId,
  updatingIntervalId,
  rearmingId,
  promotingId,
}: {
  accounts: AccountSummary[];
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  showAccountHeaders: boolean;
  onDelete: (s: AccountStrategy) => void;
  onClone: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  onTopRuns: (s: AccountStrategy) => void;
  onReorder: (sourceId: string, targetId: string, ordered: AccountStrategy[]) => void;
  onStartAsPaper: (s: AccountStrategy) => void;
  onStartAsLive: (s: AccountStrategy) => void;
  onSwitchToPaper: (s: AccountStrategy) => void;
  onSwitchToLive: (s: AccountStrategy) => void;
  activatingId: string | undefined;
  deactivatingId: string | undefined;
  updatingIntervalId: string | undefined;
  rearmingId: string | undefined;
  promotingId: string | undefined;
}) {
  const byAccount = new Map<string, AccountStrategy[]>();
  for (const s of strategies) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push(s);
    byAccount.set(s.accountId, list);
  }
  const orderedAccountIds = accounts.filter((a) => byAccount.has(a.id)).map((a) => a.id);
  byAccount.forEach((_, id) => {
    if (!orderedAccountIds.includes(id)) orderedAccountIds.push(id);
  });

  return (
    <div className="space-y-8">
      {orderedAccountIds.map((accountId) => {
        const accountStrategies = byAccount.get(accountId) ?? [];
        const account = accounts.find((a) => a.id === accountId);

        const byInterval = new Map<string, AccountStrategy[]>();
        for (const s of accountStrategies) {
          const list = byInterval.get(s.interval) ?? [];
          list.push(s);
          byInterval.set(s.interval, list);
        }
        const orderedIntervals = Array.from(byInterval.keys()).sort(compareIntervals);

        return (
          <section key={accountId} className="space-y-4">
            {showAccountHeaders && (
              <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-mono text-sm font-semibold tracking-wide text-[var(--text-primary)]">
                    {account?.label ?? accountId.slice(0, 8)}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {account?.exchange ?? 'UNKNOWN'}
                  </span>
                  {account && !account.active && (
                    <span className="rounded bg-[rgba(229,72,77,0.12)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-loss)]">
                      INACTIVE
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {accountStrategies.length} preset
                  {accountStrategies.length === 1 ? '' : 's'}
                </span>
              </div>
            )}
            <div className="space-y-5">
              {orderedIntervals.map((interval) => (
                <IntervalGroupSortable
                  key={`${accountId}::${interval}`}
                  interval={interval}
                  strategies={byInterval.get(interval) ?? []}
                  presetsByTuple={presetsByTuple}
                  onDelete={onDelete}
                  onClone={onClone}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  onIntervalChange={onIntervalChange}
                  onRearm={onRearm}
                  onTopRuns={onTopRuns}
                  onReorder={onReorder}
                  onStartAsPaper={onStartAsPaper}
                  onStartAsLive={onStartAsLive}
                  onSwitchToPaper={onSwitchToPaper}
                  onSwitchToLive={onSwitchToLive}
                  activatingId={activatingId}
                  deactivatingId={deactivatingId}
                  updatingIntervalId={updatingIntervalId}
                  rearmingId={rearmingId}
                  promotingId={promotingId}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
