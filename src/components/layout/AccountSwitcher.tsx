'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Layers, Plug, Plus } from 'lucide-react';
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
import { NewAccountDialog } from '@/components/account/NewAccountDialog';
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
  const [newOpen, setNewOpen] = useState(false);

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

  // Empty state is now an actionable CTA — clicking the "Connect" pill opens
  // the new-account dialog right there in the top bar.
  if (accounts.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-[11px] transition-colors',
            'border-[var(--border-default)] text-[var(--text-muted)]',
            'hover:border-[var(--color-profit)] hover:text-[var(--color-profit)]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
          )}
          aria-label="Connect your first exchange account"
        >
          <Plug size={11} strokeWidth={1.75} aria-hidden="true" />
          Connect account
        </button>
        <NewAccountDialog open={newOpen} onOpenChange={setNewOpen} />
      </>
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Switch account"
            className={cn(
              'inline-flex h-7 max-w-[220px] items-center gap-2 rounded-sm border px-2 transition-colors duration-fast',
              'border-bd-subtle bg-bg-surface text-text-primary',
              'hover:border-bd hover:bg-bg-elevated',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <AccountAvatar account={activeAccount} isAll={isAll} />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="truncate text-[11px] font-medium">{triggerLabel}</span>
              {triggerSubtle && (
                <span className="truncate font-mono text-[9px] text-text-muted">
                  {triggerSubtle}
                </span>
              )}
            </span>
            <ChevronDown size={12} strokeWidth={1.75} className="shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuLabel className="label-caps !text-[10px]">Account context</DropdownMenuLabel>

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

          <DropdownMenuSeparator />
          <DropdownMenuItem
            // Radix closes the menu synchronously on select, which would race
            // with the dialog's mount. `preventDefault` keeps the menu open
            // just long enough for React to flush the dialog state update
            // before we finally close both.
            onSelect={(event) => {
              event.preventDefault();
              setNewOpen(true);
            }}
            className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-[12px] text-[var(--color-profit)]"
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-sm"
              style={{ background: 'var(--accent-glow)' }}
              aria-hidden="true"
            >
              <Plus size={12} strokeWidth={2} />
            </span>
            <span className="font-medium">Connect another account</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewAccountDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

function AccountAvatar({ account, isAll }: { account: AccountSummary | null; isAll: boolean }) {
  if (isAll) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-bg-elevated text-profit">
        <Layers size={11} strokeWidth={1.75} />
      </span>
    );
  }
  if (!account) {
    return <span className="size-5 shrink-0 rounded-sm bg-bg-elevated" aria-hidden="true" />;
  }
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] font-semibold',
        account.active ? 'bg-tint-profit text-profit' : 'bg-bg-elevated text-text-muted',
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
        'flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-[12px]',
        selected ? 'bg-bg-elevated' : '',
      )}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-text-primary">{label}</span>
          {active === false && (
            <span className="rounded-sm bg-tint-loss px-1 py-px font-mono text-[9px] text-loss">
              inactive
            </span>
          )}
        </div>
        <span className="truncate font-mono text-[9px] text-text-muted">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] text-text-muted">{count}</span>
        {selected ? (
          <Check size={12} strokeWidth={2} className="text-profit" />
        ) : (
          <span className="size-3" aria-hidden="true" />
        )}
      </div>
    </DropdownMenuItem>
  );
}
