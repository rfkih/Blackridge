'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAccount, getMyAccounts, type CreateAccountPayload } from '@/lib/api/accounts';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useAccountStore } from '@/store/accountStore';
import { useAuthStore } from '@/store/authStore';
import type { AccountSummary, ActiveAccountSelection } from '@/types/account';

/** Raw accounts query. */
export function useAccounts() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['accounts', userId ?? null],
    queryFn: getMyAccounts,
    staleTime: QUERY_STALE_TIMES.strategyParams,
    enabled: Boolean(userId),
  });
}

export interface ActiveAccountContext {
  /** All accounts owned by the user. Empty array while loading. */
  accounts: AccountSummary[];
  /** The user's last-chosen selection (persisted). */
  selection: ActiveAccountSelection;
  /** The resolved active account, or `null` if the user is in "All" mode. */
  activeAccount: AccountSummary | null;
  /** True when the user is viewing an aggregate across every account. */
  isAll: boolean;
  /** Convenience: the account id for scoped queries, or `undefined` for "All". */
  scopedAccountId: string | undefined;
  /** Change the active selection. */
  setSelection: (sel: ActiveAccountSelection) => void;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolves the active account context for the current user.
 *
 * Auto-hydrates the persisted selection:
 *  - If the stored selection points at an account the user no longer owns → reset.
 *  - If nothing stored and user has exactly 1 account → select it.
 *  - If nothing stored and user has ≥2 accounts → default to "All".
 */
export function useActiveAccount(): ActiveAccountContext {
  const { data: accounts = [], isLoading, isError } = useAccounts();
  const selection = useAccountStore((s) => s.selection);
  const setSelection = useAccountStore((s) => s.setSelection);

  useEffect(() => {
    if (isLoading) return;
    if (accounts.length === 0) return;
    if (selection === null) {
      setSelection(accounts.length === 1 ? accounts[0].id : 'all');
      return;
    }
    if (selection !== 'all' && !accounts.some((a) => a.id === selection)) {
      // Stored selection no longer valid (account revoked, different user, etc.)
      setSelection(accounts.length === 1 ? accounts[0].id : 'all');
    }
  }, [accounts, selection, isLoading, setSelection]);

  const resolved: ActiveAccountSelection = selection ?? 'all';

  const activeAccount = useMemo(() => {
    if (resolved === 'all') return null;
    return accounts.find((a) => a.id === resolved) ?? null;
  }, [accounts, resolved]);

  return {
    accounts,
    selection: resolved,
    activeAccount,
    isAll: resolved === 'all',
    scopedAccountId: resolved === 'all' ? undefined : resolved,
    setSelection,
    isLoading,
    isError,
  };
}

/**
 * Create a new exchange account. On success invalidates the accounts query
 * so the switcher picks up the new row, and (if this is the user's very
 * first account) selects it so downstream hooks get a concrete scope.
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  const setSelection = useAccountStore((s) => s.setSelection);
  const existingSelection = useAccountStore((s) => s.selection);

  return useMutation({
    mutationFn: (payload: CreateAccountPayload) => createAccount(payload),
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // If the user had no selection yet, land them on the account they
      // just created so the rest of the dashboard isn't a ghost town.
      if (existingSelection == null) {
        setSelection(account.id);
      }
    },
  });
}
