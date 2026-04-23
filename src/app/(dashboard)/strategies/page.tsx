'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Check,
  Loader2,
  Plus,
  Radio,
  Trash2,
  Zap,
} from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { NewStrategyDialog } from '@/components/strategy/NewStrategyDialog';
import { DeleteStrategyDialog } from '@/components/strategy/DeleteStrategyDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAccountStrategies, useActivateStrategy } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';
import type { AccountSummary } from '@/types/account';

/** Key identifying a preset family: presets with the same key compete for "active". */
function tupleKey(s: AccountStrategy): string {
  return `${s.accountId}::${s.strategyCode}::${s.symbol}::${s.interval}`;
}

function StrategyCard({
  strategy,
  groupHasOtherPreset,
  onDelete,
  onActivate,
  isActivating,
}: {
  strategy: AccountStrategy;
  groupHasOtherPreset: boolean;
  onDelete: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  isActivating: boolean;
}) {
  const isLive = strategy.status === 'LIVE';
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between gap-4 rounded-lg border bg-[var(--bg-surface)] p-4 shadow-panel transition-colors',
        isLive
          ? 'border-[var(--accent-primary)]/60 shadow-[0_0_0_1px_var(--accent-primary),0_4px_18px_rgba(31,200,150,0.12)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]',
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(strategy);
        }}
        className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-all hover:bg-[rgba(255,77,106,0.12)] hover:text-[var(--color-loss)] focus:opacity-100 group-hover:opacity-100"
        aria-label={`Delete preset ${strategy.presetName}`}
      >
        <Trash2 size={14} />
      </button>

      <Link href={`/strategies/${strategy.id}`} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2 pr-8">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <StrategyBadge code={strategy.strategyCode} size="md" />
              <span
                className="truncate rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{
                  borderColor: isLive ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: isLive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  backgroundColor: isLive ? 'var(--accent-glow)' : 'transparent',
                }}
                title={strategy.presetName}
              >
                {strategy.presetName}
              </span>
            </div>
            <p className="font-mono text-sm font-medium text-[var(--text-primary)]">
              {strategy.symbol}
              <span className="ml-2 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">
                {strategy.interval}
              </span>
            </p>
          </div>
          <StrategyStatusBadge status={strategy.status} />
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Allocation
            </span>
            <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
              {strategy.capitalAllocationPct.toFixed(1)}
              <span className="ml-1 text-[10px] text-[var(--text-muted)]">%</span>
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <DirectionPill direction="long" enabled={strategy.allowLong} />
            <DirectionPill direction="short" enabled={strategy.allowShort} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Priority #{strategy.priorityOrder}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent-primary)]">
            Edit Params
            <ChevronRight size={12} />
          </span>
        </div>
      </Link>

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
              {isActivating ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Check size={10} />
              )}
              {isActivating ? 'Activating…' : 'Activate'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DirectionPill({ direction, enabled }: { direction: 'long' | 'short'; enabled: boolean }) {
  const Icon = direction === 'long' ? ArrowUpRight : ArrowDownRight;
  const activeColor = direction === 'long' ? 'var(--color-profit)' : 'var(--color-loss)';
  const bg = direction === 'long' ? 'rgba(31,200,150,0.12)' : 'rgba(255,77,106,0.1)';
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
  const activateMutation = useActivateStrategy();

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

  const headerSubtitle = isAll
    ? `Live strategies across ${accounts.length} account${accounts.length === 1 ? '' : 's'}. Each tuple can hold multiple presets — one active at a time.`
    : activeAccount
      ? `Strategies on ${activeAccount.label}. Switch accounts in the top bar to see others.`
      : 'Live strategies. Click any card to edit its parameters.';

  const canCreate = accounts.some((a) => a.active);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            Account strategies
          </p>
          <h1 className="mt-1 font-display text-2xl text-[var(--text-primary)]">Strategies</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={!canCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          New Preset
        </button>
      </header>

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
      ) : isAll && accounts.length > 1 ? (
        <GroupedStrategies
          accounts={accounts}
          strategies={visibleStrategies}
          presetsByTuple={presetsByTuple}
          onDelete={setDeleteTarget}
          onActivate={handleActivate}
          activatingId={activateMutation.isPending ? activateMutation.variables : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortPresetsByTuple(visibleStrategies).map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              groupHasOtherPreset={(presetsByTuple.get(tupleKey(s)) ?? 0) > 1}
              onDelete={setDeleteTarget}
              onActivate={handleActivate}
              isActivating={activateMutation.isPending && activateMutation.variables === s.id}
            />
          ))}
        </div>
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
    </div>
  );
}

/**
 * Orders presets so sibling presets (same tuple) are adjacent, with the
 * active preset first inside each cluster. Keeps the grid reading like
 * "here's the strategy, these are its variants" instead of scrambled.
 */
function sortPresetsByTuple(items: AccountStrategy[]): AccountStrategy[] {
  const grouped = new Map<string, AccountStrategy[]>();
  for (const s of items) {
    const k = tupleKey(s);
    const list = grouped.get(k) ?? [];
    list.push(s);
    grouped.set(k, list);
  }
  const lists = Array.from(grouped.values());
  const ordered: AccountStrategy[] = [];
  lists.forEach((list: AccountStrategy[]) => {
    list.sort((a: AccountStrategy, b: AccountStrategy) => {
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
      return a.presetName.localeCompare(b.presetName);
    });
    ordered.push(...list);
  });
  return ordered;
}

/** Groups strategy cards under a per-account header when "All accounts" is active. */
function GroupedStrategies({
  accounts,
  strategies,
  presetsByTuple,
  onDelete,
  onActivate,
  activatingId,
}: {
  accounts: AccountSummary[];
  strategies: AccountStrategy[];
  presetsByTuple: Map<string, number>;
  onDelete: (s: AccountStrategy) => void;
  onActivate: (s: AccountStrategy) => void;
  activatingId: string | undefined;
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
        const group = sortPresetsByTuple(byAccount.get(accountId) ?? []);
        const account = accounts.find((a) => a.id === accountId);
        return (
          <section key={accountId} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-mono text-sm font-semibold tracking-wide text-[var(--text-primary)]">
                  {account?.label ?? accountId.slice(0, 8)}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {account?.exchange ?? 'UNKNOWN'}
                </span>
                {account && !account.active && (
                  <span className="rounded bg-[rgba(255,77,106,0.12)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-loss)]">
                    INACTIVE
                  </span>
                )}
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {group.length} preset{group.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((s) => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  groupHasOtherPreset={(presetsByTuple.get(tupleKey(s)) ?? 0) > 1}
                  onDelete={onDelete}
                  onActivate={onActivate}
                  isActivating={activatingId === s.id}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
