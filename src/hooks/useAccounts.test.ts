import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AccountSummary } from '@/types/account';

// --- mock the accounts API the query calls ---
const getMyAccounts = vi.fn();
vi.mock('@/lib/api/accounts', () => ({
  getMyAccounts: () => getMyAccounts(),
}));

import { useActiveAccount } from './useAccounts';
import { useAccountStore } from '@/store/accountStore';
import { useAuthStore } from '@/store/authStore';

function mkAccount(p: Partial<AccountSummary> & Pick<AccountSummary, 'id'>): AccountSummary {
  return {
    userId: 'user-1',
    label: 'Acct',
    exchange: 'BIN',
    active: true,
    createdAt: '2026-05-01T00:00:00Z',
    accountType: 'TRADING',
    maxConcurrentLongs: 2,
    maxConcurrentShorts: 2,
    maxConcurrentTrades: null,
    volTargetingEnabled: false,
    bookVolTargetPct: 15,
    ...p,
  };
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('useActiveAccount — accountType', () => {
  beforeEach(() => {
    getMyAccounts.mockReset();
    // Auth: give the query a userId so `enabled` is true.
    useAuthStore.setState({ user: { id: 'user-1', email: 'a@b.c', name: 'A', role: 'USER' } as never });
    // Reset persisted selection between tests.
    useAccountStore.setState({ selection: null });
  });

  it("exposes the active account's accountType", async () => {
    getMyAccounts.mockResolvedValue([
      mkAccount({ id: 'a-trade', accountType: 'TRADING' }),
      mkAccount({ id: 'a-hedge', accountType: 'HEDGING' }),
    ]);
    useAccountStore.setState({ selection: 'a-hedge' });

    const { result } = renderHook(() => useActiveAccount(), { wrapper: makeWrapper(newClient()) });

    await waitFor(() => expect(result.current.activeAccount).not.toBeNull());
    expect(result.current.activeAccount?.accountType).toBe('HEDGING');
  });

  it('groups accounts by type via accountsByType', async () => {
    getMyAccounts.mockResolvedValue([
      mkAccount({ id: 'a-trade-1', accountType: 'TRADING' }),
      mkAccount({ id: 'a-trade-2', accountType: 'TRADING' }),
      mkAccount({ id: 'a-hedge-1', accountType: 'HEDGING' }),
    ]);
    useAccountStore.setState({ selection: 'all' });

    const { result } = renderHook(() => useActiveAccount(), { wrapper: makeWrapper(newClient()) });

    await waitFor(() => expect(result.current.accounts).toHaveLength(3));
    expect(result.current.accountsByType.TRADING.map((a) => a.id)).toEqual([
      'a-trade-1',
      'a-trade-2',
    ]);
    expect(result.current.accountsByType.HEDGING.map((a) => a.id)).toEqual(['a-hedge-1']);
  });

  it('returns empty arrays for each type when there are no accounts', async () => {
    getMyAccounts.mockResolvedValue([]);
    useAccountStore.setState({ selection: 'all' });

    const { result } = renderHook(() => useActiveAccount(), { wrapper: makeWrapper(newClient()) });

    expect(result.current.accountsByType.TRADING).toEqual([]);
    expect(result.current.accountsByType.HEDGING).toEqual([]);
  });
});
