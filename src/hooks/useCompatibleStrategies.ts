'use client';

import { useMemo } from 'react';
import { useActiveAccount } from './useAccounts';
import { useStrategyDefinitions } from './useStrategyDefinitions';
import { ACCOUNT_TYPE_VIEW } from '@/lib/accountType/registry';
import type { StrategyDefinition } from '@/types/strategyDefinition';

/** The subset of the underlying definitions query this hook re-exposes. */
export interface UseCompatibleStrategiesResult {
  /** Definitions bindable on the active account, or the full list in All mode.
   *  `undefined` while the underlying query has no data yet. */
  data: StrategyDefinition[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Strategy-definition catalogue filtered to the strategies bindable on the
 * *active* account. A thin, typed wrapper over {@link useStrategyDefinitions}
 * — it does not refetch differently.
 *
 * When a single account is active, only definitions whose `strategyKind`
 * matches the account's `accountType` survive (via the type's `catalogFilter`,
 * which the bind-time backend gate also enforces). In "All" mode there is no
 * single account to scope to, so the full list passes through unfiltered —
 * callers section it by type themselves.
 */
export function useCompatibleStrategies(): UseCompatibleStrategiesResult {
  const { data, isLoading, isError } = useStrategyDefinitions();
  const { activeAccount, isAll } = useActiveAccount();

  const filtered = useMemo(() => {
    if (!data) return undefined;
    if (isAll || !activeAccount) return data;
    const keep = ACCOUNT_TYPE_VIEW[activeAccount.accountType].catalogFilter;
    return data.filter((def) => keep(def.strategyKind));
  }, [data, isAll, activeAccount]);

  return { data: filtered, isLoading, isError };
}
