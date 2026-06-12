import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';

import DashboardPage from './page';

// --- control the active account ---
const useActiveAccount = vi.fn();
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));

// --- stub the hedging surface so the branch is observable without its hooks ---
vi.mock('@/components/hedging/HedgingDashboard', () => ({
  HedgingDashboard: ({ accountId }: { accountId: string }) => (
    <div data-testid="hedging-dashboard">hedging:{accountId}</div>
  ),
}));

// --- neutralize the trading path's data hooks (defaults render the hero) ---
vi.mock('@/hooks/useTrades', () => ({
  useOpenTrades: () => ({ data: [] }),
  usePnlSummary: () => ({ data: undefined }),
}));
vi.mock('@/hooks/useStrategies', () => ({ useStrategies: () => ({ data: [] }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Trader' } }) }));
vi.mock('@/hooks/usePortfolio', () => ({ usePortfolio: () => ({ data: undefined }) }));
vi.mock('@/hooks/useEquityCurve', () => ({
  useEquityCurve: () => ({ points: [], period: '7D', setPeriod: vi.fn() }),
}));
vi.mock('@/hooks/useLivePnl', () => ({
  useLivePnl: () => undefined,
  useSyncOpenPositions: () => undefined,
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrencyFormatter: () => (n: number) => `$${n.toFixed(2)}`,
}));

// dashboard sub-panels that read other stores/hooks — stub to keep the test
// focused on the type branch, not the banner internals.
vi.mock('@/components/dashboard/OnboardingPanel', () => ({ OnboardingPanel: () => null }));
vi.mock('@/components/dashboard/EmailVerificationBanner', () => ({
  EmailVerificationBanner: () => null,
}));
vi.mock('@/components/dashboard/KillSwitchBanner', () => ({ KillSwitchBanner: () => null }));
vi.mock('@/components/ml/MlHealthStrip', () => ({ MlHealthStrip: () => null }));
vi.mock('@/store/positionStore', () => ({ usePositionStore: () => undefined }));

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return { id: 'a1', accountType: 'TRADING', ...p } as AccountSummary;
}

describe('DashboardPage account-type branch', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
  });

  it('renders the hedging dashboard for a HEDGING active account', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: 'h1',
      isAll: false,
      activeAccount: mkAccount({ id: 'h1', accountType: 'HEDGING' }),
    });

    render(<DashboardPage />);
    expect(screen.getByTestId('hedging-dashboard')).toHaveTextContent('hedging:h1');
    // trading-only hero is NOT rendered
    expect(screen.queryByText('Your positions')).not.toBeInTheDocument();
  });

  it('renders the existing trading hero for a TRADING active account', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: 't1',
      isAll: false,
      activeAccount: mkAccount({ id: 't1', accountType: 'TRADING' }),
    });

    render(<DashboardPage />);
    expect(screen.getByText('Your positions')).toBeInTheDocument();
    expect(screen.queryByTestId('hedging-dashboard')).not.toBeInTheDocument();
  });

  it('renders the existing trading hero in All mode', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: undefined,
      isAll: true,
      activeAccount: null,
      accountsByType: { TRADING: [], HEDGING: [] },
    });

    render(<DashboardPage />);
    expect(screen.getByText('Your positions')).toBeInTheDocument();
    expect(screen.queryByTestId('hedging-dashboard')).not.toBeInTheDocument();
  });

  it('appends a hedging-accounts section in the All view when a hedging account exists', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: undefined,
      isAll: true,
      activeAccount: null,
      setSelection: vi.fn(),
      accountsByType: {
        TRADING: [mkAccount({ id: 't1', label: 'Trade book', accountType: 'TRADING' })],
        HEDGING: [mkAccount({ id: 'h1', label: 'Hedge book', accountType: 'HEDGING' })],
      },
    });

    render(<DashboardPage />);
    // existing trading aggregate still renders above
    expect(screen.getByText('Your positions')).toBeInTheDocument();
    // additive hedging section + its account card render below
    expect(screen.getByTestId('all-view-hedging-section')).toBeInTheDocument();
    expect(screen.getByText('Hedge book')).toBeInTheDocument();
  });

  it('renders no hedging section in the All view when only TRADING accounts exist', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: undefined,
      isAll: true,
      activeAccount: null,
      setSelection: vi.fn(),
      accountsByType: {
        TRADING: [mkAccount({ id: 't1', label: 'Trade book', accountType: 'TRADING' })],
        HEDGING: [],
      },
    });

    render(<DashboardPage />);
    expect(screen.getByText('Your positions')).toBeInTheDocument();
    expect(screen.queryByTestId('all-view-hedging-section')).not.toBeInTheDocument();
  });
});
