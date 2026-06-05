import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';
import type { AccountType } from '@/types/accountType';
import { ACCOUNT_TYPE_VIEW } from '@/lib/accountType/registry';

// --- control the active account + its view ---
const useActiveAccount = vi.fn();
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));
vi.mock('@/lib/accountType/registry', () => ({
  ACCOUNT_TYPE_VIEW: {
    TRADING: { monitorLabel: 'Trades' },
    HEDGING: { monitorLabel: 'Rebalances' },
  },
  useAccountView: () => {
    const type: AccountType = useActiveAccount().activeAccount?.accountType ?? 'TRADING';
    return (ACCOUNT_TYPE_VIEW as Record<AccountType, { monitorLabel: string }>)[type];
  },
}));

// --- stub the rebalance list so the hedging branch is observable ---
vi.mock('@/components/hedging/RebalanceHistory', () => ({
  RebalanceHistory: ({ accountId }: { accountId: string | undefined }) => (
    <div data-testid="rebalance-history">rebalances:{accountId}</div>
  ),
}));

// --- neutralize the trading path's data hooks ---
vi.mock('@/hooks/useTrades', () => ({
  useTradesList: () => ({ data: { content: [], total: 0 }, isLoading: false }),
  useTradeStats: () => ({ data: undefined }),
}));
vi.mock('@/hooks/useStrategies', () => ({ useStrategies: () => ({ data: [] }) }));
vi.mock('@/hooks/useLivePnl', () => ({
  useLivePnl: () => undefined,
  useSyncOpenPositions: () => undefined,
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrencyFormatter: () => (n: number) => `$${n.toFixed(2)}`,
}));
vi.mock('@/store/positionStore', () => ({ usePositionStore: () => undefined }));

// next/navigation
const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(''),
}));

import TradesPage from './page';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return { id: 'a1', accountType: 'TRADING', ...p } as AccountSummary;
}

describe('TradesPage account-type branch', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
  });

  it('renders a Rebalances monitor for a HEDGING active account', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: 'h1',
      isAll: false,
      activeAccount: mkAccount({ id: 'h1', accountType: 'HEDGING' }),
    });

    render(<TradesPage />);
    expect(screen.getByRole('heading', { name: 'Rebalances' })).toBeInTheDocument();
    expect(screen.getByTestId('rebalance-history')).toHaveTextContent('rebalances:h1');
    // trading-only ledger chrome is NOT rendered
    expect(screen.queryByText('TRADE LEDGER')).not.toBeInTheDocument();
  });

  it('renders the existing trades ledger for a TRADING active account', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: 't1',
      isAll: false,
      activeAccount: mkAccount({ id: 't1', accountType: 'TRADING' }),
    });

    render(<TradesPage />);
    expect(screen.getByText('TRADE LEDGER')).toBeInTheDocument();
    expect(screen.queryByTestId('rebalance-history')).not.toBeInTheDocument();
  });

  it('renders the existing trades ledger in All mode', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: undefined,
      isAll: true,
      activeAccount: null,
    });

    render(<TradesPage />);
    expect(screen.getByText('TRADE LEDGER')).toBeInTheDocument();
    expect(screen.queryByTestId('rebalance-history')).not.toBeInTheDocument();
  });
});
