'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccount,
  deleteAccount,
  getMyAccounts,
  rotateAccountCredentials,
  updateAccount,
  updateAccountRiskConfig,
  type CreateAccountPayload,
  type RiskConfigPayload,
  type RotateAccountCredentialsPayload,
  type UpdateAccountPayload,
} from '@/lib/api/accounts';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import { useAccountStore } from '@/store/accountStore';
import { useAuthStore } from '@/store/authStore';
import { ACCOUNT_TYPES, type AccountType } from '@/types/accountType';
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
  /** Accounts grouped by their `accountType`, for the "All" view's per-type
   *  sections. Every {@link AccountType} key is always present (empty array
   *  when none). */
  accountsByType: Record<AccountType, AccountSummary[]>;
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
      setSelection(accounts.length === 1 ? accounts[0].id : 'all');
    }
  }, [accounts, selection, isLoading, setSelection]);

  const resolved: ActiveAccountSelection = selection ?? 'all';

  const activeAccount = useMemo(() => {
    if (resolved === 'all') return null;
    return accounts.find((a) => a.id === resolved) ?? null;
  }, [accounts, resolved]);

  const accountsByType = useMemo(() => {
    const groups = {} as Record<AccountType, AccountSummary[]>;
    for (const type of ACCOUNT_TYPES) groups[type] = [];
    for (const account of accounts) {
      groups[account.accountType].push(account);
    }
    return groups;
  }, [accounts]);

  return {
    accounts,
    accountsByType,
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

      if (existingSelection == null) {
        setSelection(account.id);
      }
    },
  });
}

/**
 * Rotate the Binance API key + secret for an account the user owns. Summary
 * shape is unchanged, but we still refresh the accounts query so any stale
 * derived data (e.g. a disabled "active" flag the backend might toggle on
 * the next health check) picks up.
 */
export function useRotateAccountCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: string;
      payload: RotateAccountCredentialsPayload;
    }) => rotateAccountCredentials(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Update the per-account risk policy — concurrency caps and the
 * vol-targeting toggle/target. Phase 2a/2b.
 */
export function useUpdateAccountRiskConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: RiskConfigPayload }) =>
      updateAccountRiskConfig(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Rename and/or change the exchange of an account the user owns. Used by
 * EditAccountDialog. Mutation result is the refreshed AccountSummary so
 * downstream consumers get the new label/exchange without an extra round-trip.
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: UpdateAccountPayload }) =>
      updateAccount(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Soft-delete an account the user owns. Used by DeleteAccountDialog. Backend
 * rejects when open trades reference the account; the rejection flows through
 * normalizeError into the dialog's inline alert.
 *
 * <p>If the user happens to be sitting on the deleted account in the
 * persisted selection, reset the selection so the rest of the dashboard
 * doesn't try to scope queries to a row that was just removed.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const selection = useAccountStore((s) => s.selection);
  const setSelection = useAccountStore((s) => s.setSelection);

  return useMutation({
    mutationFn: (accountId: string) => deleteAccount(accountId),
    onSuccess: (_data, accountId) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      if (selection === accountId) {
        setSelection('all');
      }
    },
  });
}
