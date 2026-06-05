import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';
import type { AccountStrategy } from '@/types/strategy';

// --- control the strategies list + the accounts/active-account context ---
const useAllVisibleStrategies = vi.fn();
const useActiveAccount = vi.fn();
vi.mock('@/hooks/useStrategies', () => ({
  useAllVisibleStrategies: () => useAllVisibleStrategies(),
  useActivateStrategy: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useDeactivateStrategy: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRearmKillSwitch: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useUpdateStrategyInterval: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useUpdateStrategyPriority: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
  useUpdateAccountRiskConfig: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock('@/hooks/useStrategyPromotion', () => ({
  useAccountStrategyPromote: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

// --- toast no-op ---
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- next/link needs an app-router context jsdom lacks ---
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: any) => {
    const R = require('react');
    return R.createElement('a', rest, children);
  },
}));

// --- dialogs render nothing in the test; they pull their own data hooks ---
vi.mock('@/components/strategy/NewStrategyDialog', () => ({ NewStrategyDialog: () => null }));
vi.mock('@/components/strategy/DeleteStrategyDialog', () => ({ DeleteStrategyDialog: () => null }));
vi.mock('@/components/strategy/CloneStrategyDialog', () => ({ CloneStrategyDialog: () => null }));
vi.mock('@/components/strategy/RearmKillSwitchDialog', () => ({ RearmKillSwitchDialog: () => null }));
vi.mock('@/components/strategy/SwitchToLiveDialog', () => ({ SwitchToLiveDialog: () => null }));
vi.mock('@/components/strategy/StrategyTopRunsDialog', () => ({ StrategyTopRunsDialog: () => null }));

import StrategiesPage from './page';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return {
    id: 'a1',
    userId: 'u1',
    label: 'Main',
    exchange: 'BNC',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    accountType: 'TRADING',
    maxConcurrentLongs: 3,
    maxConcurrentShorts: 3,
    maxConcurrentTrades: null,
    volTargetingEnabled: false,
    bookVolTargetPct: 15,
    ...p,
  };
}

function mkStrategy(p: Partial<AccountStrategy>): AccountStrategy {
  return {
    id: 's1',
    accountId: 'a1',
    strategyCode: 'LSR',
    strategyKind: 'TRADING',
    archetype: 'LEGACY_JAVA',
    presetName: 'Preset',
    symbol: 'BTCUSDT',
    interval: '1h',
    status: 'LIVE',
    simulated: false,
    capitalAllocationPct: 10,
    maxOpenPositions: 1,
    allowLong: true,
    allowShort: false,
    priorityOrder: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ddKillThresholdPct: 0,
    isKillSwitchTripped: false,
    killSwitchTrippedAt: null,
    killSwitchReason: null,
    ownedByCurrentUser: true,
    ownerLabel: 'me',
    ...p,
  } as AccountStrategy;
}

describe('StrategiesPage — account-type badge on All-view group headers', () => {
  beforeEach(() => {
    useAllVisibleStrategies.mockReset();
    useActiveAccount.mockReset();
  });

  it('shows the account-type badge next to each account group header in the All view', () => {
    const trading = mkAccount({ id: 't1', label: 'Trade book', accountType: 'TRADING' });
    const hedging = mkAccount({ id: 'h1', label: 'Hedge book', accountType: 'HEDGING' });

    useActiveAccount.mockReturnValue({
      accounts: [trading, hedging],
      isAll: true,
      activeAccount: null,
      scopedAccountId: undefined,
    });
    useAllVisibleStrategies.mockReturnValue({
      data: [
        mkStrategy({ id: 's-t', accountId: 't1', strategyKind: 'TRADING' }),
        mkStrategy({ id: 's-h', accountId: 'h1', strategyKind: 'HEDGING' }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<StrategiesPage />);

    // The trading group header carries a "Trading" badge; the hedging one "Hedging".
    const tradingHeading = screen.getByRole('heading', { name: 'Trade book' });
    const tradingHeader = tradingHeading.closest('div');
    expect(tradingHeader).not.toBeNull();
    expect(within(tradingHeader as HTMLElement).getByText('Trading')).toBeInTheDocument();

    const hedgingHeading = screen.getByRole('heading', { name: 'Hedge book' });
    const hedgingHeader = hedgingHeading.closest('div');
    expect(hedgingHeader).not.toBeNull();
    expect(within(hedgingHeader as HTMLElement).getByText('Hedging')).toBeInTheDocument();
  });
});
