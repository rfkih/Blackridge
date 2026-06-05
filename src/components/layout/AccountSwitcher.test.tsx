import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';
import type { ActiveAccountContext } from '@/hooks/useAccounts';

// --- mock the account + strategy hooks ---
const useActiveAccount = vi.fn();
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));

const useStrategies = vi.fn();
vi.mock('@/hooks/useStrategies', () => ({
  useStrategies: () => useStrategies(),
}));

// --- NewAccountDialog drags in a mutation hook / portal we don't need here ---
vi.mock('@/components/account/NewAccountDialog', () => ({
  NewAccountDialog: () => null,
}));

import { AccountSwitcher } from './AccountSwitcher';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return {
    id: 'acc-1',
    userId: 'user-1',
    label: 'Hedge book',
    exchange: 'BNC',
    active: true,
    createdAt: '2026-06-01T00:00:00Z',
    accountType: 'TRADING',
    maxConcurrentLongs: 2,
    maxConcurrentShorts: 2,
    maxConcurrentTrades: null,
    volTargetingEnabled: false,
    bookVolTargetPct: 15,
    ...p,
  };
}

function mkContext(account: AccountSummary): ActiveAccountContext {
  return {
    accounts: [account],
    accountsByType: { TRADING: [], HEDGING: [account] },
    selection: account.id,
    activeAccount: account,
    isAll: false,
    scopedAccountId: account.id,
    setSelection: vi.fn(),
    isLoading: false,
    isError: false,
  };
}

describe('AccountSwitcher — account-type badge', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
    useStrategies.mockReset();
    useStrategies.mockReturnValue({ data: [] });
  });

  it('renders an AccountTypeBadge for the active HEDGING account', () => {
    const account = mkAccount({ accountType: 'HEDGING', label: 'Hedge book' });
    useActiveAccount.mockReturnValue(mkContext(account));

    render(<AccountSwitcher />);

    expect(screen.getByText('Hedging')).toBeInTheDocument();
  });

  it('renders the Trading badge for a TRADING account', () => {
    const account = mkAccount({ accountType: 'TRADING', label: 'Main' });
    useActiveAccount.mockReturnValue(mkContext(account));

    render(<AccountSwitcher />);

    expect(screen.getByText('Trading')).toBeInTheDocument();
  });
});
