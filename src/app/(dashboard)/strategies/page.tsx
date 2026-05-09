'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Check,
  GripVertical,
  Loader2,
  Plus,
  Radio,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { NewStrategyDialog } from '@/components/strategy/NewStrategyDialog';
import { DeleteStrategyDialog } from '@/components/strategy/DeleteStrategyDialog';
import { RearmKillSwitchDialog } from '@/components/strategy/RearmKillSwitchDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useAccountStrategies,
  useActivateStrategy,
  useDeactivateStrategy,
  useRearmKillSwitch,
  useUpdateStrategyInterval,
  useUpdateStrategyPriority,
} from '@/hooks/useStrategies';
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

function StrategyCard({
  strategy,
  position,
  groupHasOtherPreset,
  onDelete,
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  isActivating,
  isDeactivating,
  isUpdatingInterval,
  isRearming,
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
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  isActivating: boolean;
  isDeactivating: boolean;
  isUpdatingInterval: boolean;
  isRearming: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const isLive = strategy.status === 'LIVE';
  const isToggling = isActivating || isDeactivating;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', strategy.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'group relative flex flex-col justify-between gap-4 rounded-xl border bg-[var(--bg-surface)] p-5 shadow-panel transition-all',
        isLive
          ? 'border-[var(--color-profit)]/60 shadow-[0_0_0_1px_var(--color-profit),0_8px_24px_rgba(22,179,100,0.14)]'
          : 'border-[var(--border-subtle)] hover:-translate-y-px hover:border-[var(--border-default)] hover:shadow-float',
        isDragging && 'cursor-grabbing opacity-40',
        isDragOver && 'ring-[var(--accent-primary)]/60 border-[var(--accent-primary)] ring-2',
      )}
      style={{ cursor: isDragging ? 'grabbing' : undefined }}
    >
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

      <Link href={`/strategies/${strategy.id}`} className="flex flex-col gap-4">
        {/* Top row — strategy-icon tile + tag pill (left) and status toggle
            (right). Mirrors the design pack's `.strat-head`. */}
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-[15px] font-bold"
              style={{
                background: 'var(--mm-mint-soft)',
                color: 'var(--mm-mint)',
              }}
            >
              {strategy.symbol.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <StrategyBadge code={strategy.strategyCode} size="sm" />
              <span
                className="truncate text-[11px]"
                style={{ color: 'var(--mm-ink-2)' }}
                title={strategy.presetName}
              >
                {strategy.presetName}
              </span>
            </div>
          </div>
          <StatusToggle
            status={strategy.status}
            disabled={isToggling}
            onToggle={() => (isLive ? onDeactivate(strategy) : onActivate(strategy))}
          />
        </div>

        {/* Symbol + interval — display headline */}
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
              disabled={isUpdatingInterval}
              onChange={(v) => onIntervalChange(strategy, v)}
            />
          </div>
        </div>

        {/* 3-stat grid — allocation, side, priority. Replaces the two-row
            stats block; mirrors the design pack's `.strat-stats`. */}
        <div
          className="grid grid-cols-3 gap-3"
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--mm-hair)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mm-ink-2)',
              }}
            >
              Allocation
            </div>
            <div
              className="mm-num"
              style={{ fontSize: 16, color: 'var(--mm-ink-0)', marginTop: 2 }}
            >
              {strategy.capitalAllocationPct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mm-ink-2)',
              }}
            >
              Side
            </div>
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <DirectionPill direction="long" enabled={strategy.allowLong} />
              <DirectionPill direction="short" enabled={strategy.allowShort} />
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mm-ink-2)',
              }}
            >
              Priority
            </div>
            <div
              className="mm-num"
              style={{ fontSize: 16, color: 'var(--mm-ink-0)', marginTop: 2 }}
            >
              #{position}
            </div>
          </div>
        </div>

        {/* Footer — drag affordance + edit-params arrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: '1px solid var(--mm-hair)',
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.04em',
              color: 'var(--mm-ink-3)',
            }}
          >
            Drag to reorder
          </span>
          <span
            className="flex items-center gap-1 text-xs transition-colors group-hover:text-[var(--accent-primary)]"
            style={{ color: 'var(--mm-ink-1)', fontWeight: 600 }}
          >
            Edit params
            <ChevronRight size={12} />
          </span>
        </div>
      </Link>

      {/* Drag handle — sits at the top-left corner. The whole card is the
          drag source; the handle is just the visual affordance. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-80"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>

      {strategy.isKillSwitchTripped && (
        <KillSwitchPanel strategy={strategy} onRearm={onRearm} isRearming={isRearming} />
      )}

      {groupHasOtherPreset && (
        <div className="-mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-primary)]">
              <Radio size={10} className="animate-pulse" />
              Active preset
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Inactive
            </span>
          )}
          {!isLive && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onActivate(strategy);
              }}
              disabled={isActivating}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActivating ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              {isActivating ? 'Activating…' : 'Activate'}
            </button>
          )}
        </div>
      )}
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
  // Native <select> overlaid on the existing pill styling. The input lives
  // inside the parent <Link> — stopPropagation keeps row clicks away from
  // the link navigation when the user is interacting with the picker.
  // Always include the current value as an option so a non-canonical
  // interval (e.g. an interval added after the constants list) doesn't
  // disappear from the dropdown.
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
  const isLive = status === 'LIVE';
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
      aria-label={isLive ? 'Stop strategy' : 'Start strategy'}
      title={isLive ? 'Click to stop' : 'Click to start'}
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
  const initial = account.maxConcurrentTrades == null ? '' : String(account.maxConcurrentTrades);
  const [draft, setDraft] = useState<string>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const commit = () => {
    if (draft.trim() === '') {
      // Empty input = clear the cap (null on the entity, sentinel 0 on wire).
      if (account.maxConcurrentTrades != null) onChange(null);
      return;
    }
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      setDraft(initial); // bounce back
      return;
    }
    if (Math.trunc(n) === account.maxConcurrentTrades) return;
    onChange(Math.trunc(n));
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
            background: 'var(--mm-mint-soft)',
            color: 'var(--mm-mint)',
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
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={20}
          step={1}
          value={draft}
          disabled={disabled}
          placeholder="—"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          onBlur={commit}
          className="mm-input w-16 text-center font-mono tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
          style={{ padding: '8px 10px', fontSize: 13 }}
          aria-label={`Max concurrent trades for ${account.label}`}
        />
        <span className="font-mono text-[10px]" style={{ color: 'var(--mm-ink-3)' }}>
          {account.maxConcurrentTrades == null ? 'no cap' : `1-20`}
        </span>
      </div>
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
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  onReorder,
  activatingId,
  deactivatingId,
  updatingIntervalId,
  rearmingId,
}: {
  interval: string;
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  onDelete: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  onReorder: (sourceId: string, targetId: string, ordered: AccountStrategy[]) => void;
  activatingId: string | undefined;
  deactivatingId: string | undefined;
  updatingIntervalId: string | undefined;
  rearmingId: string | undefined;
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
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            onIntervalChange={onIntervalChange}
            onRearm={onRearm}
            isActivating={activatingId === s.id}
            isDeactivating={deactivatingId === s.id}
            isUpdatingInterval={updatingIntervalId === s.id}
            isRearming={rearmingId === s.id}
            isDragging={draggedId === s.id}
            isDragOver={dragOverId === s.id}
            onDragStart={() => setDraggedId(s.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
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
  const { data: strategies = [], isLoading, isError, refetch } = useAccountStrategies();
  const { accounts, isAll, activeAccount, scopedAccountId } = useActiveAccount();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountStrategy | null>(null);
  const [rearmTarget, setRearmTarget] = useState<AccountStrategy | null>(null);
  const activateMutation = useActivateStrategy();
  const deactivateMutation = useDeactivateStrategy();
  const intervalMutation = useUpdateStrategyInterval();
  const priorityMutation = useUpdateStrategyPriority();
  const rearmMutation = useRearmKillSwitch();
  const riskConfigMutation = useUpdateAccountRiskConfig();

  const visibleStrategies = scopedAccountId
    ? strategies.filter((s) => s.accountId === scopedAccountId)
    : strategies;

  // Count siblings per tuple so cards know when to render the
  // "Active preset / Activate" footer vs. a lone-preset card.
  const presetsByTuple = new Map<string, number>();
  for (const s of visibleStrategies) {
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

  const handleMaxTradesChange = (accountId: string, value: number | null) => {
    // Wire 0 (or any value < 1) to the backend as "clear the cap" — the
    // service treats anything below 1 as null on the entity. null on the
    // wire means "leave unchanged", which isn't what we want here.
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
    ? `Live strategies across ${accounts.length} account${accounts.length === 1 ? '' : 's'}. Each tuple can hold multiple presets — one active at a time.`
    : activeAccount
      ? `Strategies on ${activeAccount.label}. Switch accounts in the top bar to see others.`
      : 'Live strategies. Click any card to edit its parameters.';

  const canCreate = accounts.some((a) => a.active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account strategies"
        title="Strategies"
        description={headerSubtitle}
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!canCreate}
            className="mm-btn mm-btn-mint whitespace-nowrap"
            style={{ padding: '10px 18px', borderRadius: 9999, fontSize: 14 }}
          >
            <Plus size={14} strokeWidth={2.2} />
            New Preset
          </button>
        }
      />

      {/* Per-account total-concurrency cap. Renders one row per account
          when scoped to "All accounts", or just the active account otherwise. */}
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
      ) : visibleStrategies.length === 0 ? (
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
        <AccountsAndIntervalsView
          accounts={accounts}
          strategies={visibleStrategies}
          presetsByTuple={presetsByTuple}
          showAccountHeaders={isAll && accounts.length > 1}
          onDelete={setDeleteTarget}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onIntervalChange={handleIntervalChange}
          onRearm={setRearmTarget}
          onReorder={handleReorder}
          activatingId={activateMutation.isPending ? activateMutation.variables : undefined}
          deactivatingId={deactivateMutation.isPending ? deactivateMutation.variables : undefined}
          updatingIntervalId={
            intervalMutation.isPending ? intervalMutation.variables?.id : undefined
          }
          rearmingId={rearmMutation.isPending ? rearmMutation.variables : undefined}
        />
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
      <RearmKillSwitchDialog
        open={Boolean(rearmTarget)}
        onOpenChange={(open) => {
          if (!open && !rearmMutation.isPending) setRearmTarget(null);
        }}
        strategy={rearmTarget}
        isRearming={rearmMutation.isPending && rearmMutation.variables === rearmTarget?.id}
        onConfirm={handleRearmConfirmed}
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
  onActivate,
  onDeactivate,
  onIntervalChange,
  onRearm,
  onReorder,
  activatingId,
  deactivatingId,
  updatingIntervalId,
  rearmingId,
}: {
  accounts: AccountSummary[];
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  showAccountHeaders: boolean;
  onDelete: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  onDeactivate: (s: AccountStrategy) => void;
  onIntervalChange: (s: AccountStrategy, intervalName: string) => void;
  onRearm: (s: AccountStrategy) => void;
  onReorder: (sourceId: string, targetId: string, ordered: AccountStrategy[]) => void;
  activatingId: string | undefined;
  deactivatingId: string | undefined;
  updatingIntervalId: string | undefined;
  rearmingId: string | undefined;
}) {
  // Bucket by accountId. Preserve account list order; tack on stragglers.
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

        // Bucket this account's strategies by interval.
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
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  onIntervalChange={onIntervalChange}
                  onRearm={onRearm}
                  onReorder={onReorder}
                  activatingId={activatingId}
                  deactivatingId={deactivatingId}
                  updatingIntervalId={updatingIntervalId}
                  rearmingId={rearmingId}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
