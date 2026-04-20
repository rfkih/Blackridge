'use client';

import { useMemo } from 'react';
import { Check, ChevronDown, Layers, Plug } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useStrategies } from '@/hooks/useStrategies';
import { cn } from '@/lib/utils';
import type { AccountSummary } from '@/types/account';

function accountInitials(label: string): string {
  return label
    .split(/[\s_-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AccountSwitcher() {
  const { accounts, selection, activeAccount, isAll, setSelection, isLoading } = useActiveAccount();
  const { data: strategies = [] } = useStrategies();

  const strategyCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of strategies) {
      map.set(s.accountId, (map.get(s.accountId) ?? 0) + 1);
    }
    return map;
  }, [strategies]);

  if (isLoading && accounts.length === 0) {
    return <Skeleton className="h-7 w-32" />;
  }

  if (accounts.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
        <Plug size={11} />
        No accounts
      </span>
    );
  }

  const hasMultiple = accounts.length > 1;

  // Trigger button content — mirrors current selection
  let triggerLabel: string;
  let triggerSubtle: string;
  if (isAll) {
    triggerLabel = 'All accounts';
    triggerSubtle = `${accounts.length}`;
  } else if (activeAccount) {
    triggerLabel = activeAccount.label;
    triggerSubtle = activeAccount.exchange;
  } else {
    triggerLabel = 'Select account';
    triggerSubtle = '';
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch account"
          className={cn(
            'inline-flex h-7 max-w-[220px] items-center gap-2 rounded-md border px-2 text-xs transition-colors',
            'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]',
            'hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
          )}
        >
          <AccountAvatar account={activeAccount} isAll={isAll} />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="truncate font-medium">{triggerLabel}</span>
            {triggerSubtle && (
              <span className="truncate font-mono text-[9px] text-[var(--text-muted)]">
                {triggerSubtle}
              </span>
            )}
          </span>
          <ChevronDown size={12} className="shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Account context
        </DropdownMenuLabel>

        {hasMultiple && (
          <>
            <AccountOption
              label="All accounts"
              subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
              icon={<Layers size={13} className="text-[var(--text-muted)]" />}
              count={strategies.length}
              selected={isAll}
              onSelect={() => setSelection('all')}
            />
            <DropdownMenuSeparator />
          </>
        )}

        {accounts.map((a) => {
          const count = strategyCountByAccount.get(a.id) ?? 0;
          return (
            <AccountOption
              key={a.id}
              label={a.label}
              subtitle={a.exchange}
              icon={<AccountAvatar account={a} isAll={false} />}
              active={a.active}
              count={count}
              selected={!isAll && selection === a.id}
              onSelect={() => setSelection(a.id)}
            />
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountAvatar({
  account,
  isAll,
}: {
  account: AccountSummary | null;
  isAll: boolean;
}) {
  if (isAll) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[var(--bg-hover)] text-[var(--accent-primary)]">
        <Layers size={11} />
      </span>
    );
  }
  if (!account) {
    return (
      <span className="size-5 shrink-0 rounded bg-[var(--bg-hover)]" aria-hidden="true" />
    );
  }
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded font-mono text-[9px] font-semibold',
        account.active
          ? 'bg-[rgba(78,158,255,0.14)] text-[var(--accent-primary)]'
          : 'bg-[var(--bg-hover)] text-[var(--text-muted)]',
      )}
      aria-hidden="true"
    >
      {accountInitials(account.label)}
    </span>
  );
}

function AccountOption({
  label,
  subtitle,
  icon,
  count,
  selected,
  active,
  onSelect,
}: {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  selected: boolean;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-xs',
        selected ? 'bg-[var(--bg-elevated)]' : '',
      )}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-[var(--text-primary)]">{label}</span>
          {active === false && (
            <span className="rounded bg-[rgba(255,77,106,0.12)] px-1 py-px font-mono text-[9px] text-[var(--color-loss)]">
              inactive
            </span>
          )}
        </div>
        <span className="truncate font-mono text-[9px] text-[var(--text-muted)]">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{count}</span>
        {selected ? (
          <Check size={12} className="text-[var(--accent-primary)]" />
        ) : (
          <span className="size-3" aria-hidden="true" />
        )}
      </div>
    </DropdownMenuItem>
  );
}
