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

// --- stub the journal chart (pulls live candle queries + a TV/canvas chart) ---
vi.mock('@/components/trades/TradeHistoryChart', () => ({
  TradeHistoryChart: ({ symbol }: { symbol: string }) => (
    <div data-testid="trade-history-chart">chart:{symbol}</div>
  ),
}));

// --- neutralize the trading path's data hooks (controllable per test) ---
const useTradesList = vi.fn();
const useTradeStats = vi.fn();
vi.mock('@/hooks/useTrades', () => ({
  useTradesList: () => useTradesList(),
  useTradeStats: () => useTradeStats(),
}));
vi.mock('@/hooks/useStrategies', () => ({ useStrategies: () => ({ data: [] }) }));
vi.mock('@/hooks/usePortfolio', () => ({
  usePortfolio: () => ({ data: { availableUsdt: 1000 } }),
}));
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

import type { Trades } from '@/types/trading';
import TradesPage from './page';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return { id: 'a1', accountType: 'TRADING', ...p } as AccountSummary;
}

function mkTrade(p: Partial<Trades>): Trades {
  return {
    id: 't-1',
    accountId: 'a1',
    accountStrategyId: 'as-1',
    strategyCode: 'DCB',
    symbol: 'ETHUSDT',
    direction: 'LONG',
    status: 'OPEN',
    entryTime: 1_700_000_000_000,
    entryPrice: 3_000,
    exitTime: null,
    exitAvgPrice: null,
    stopLossPrice: 0,
    tp1Price: null,
    tp2Price: null,
    quantity: 1,
    realizedPnl: 0,
    unrealizedPnl: 0,
    feeUsdt: 0,
    markPrice: 3_210,
    unrealizedPnlPct: 0,
    positions: [],
    ...p,
  };
}

describe('TradesPage account-type branch', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
    useTradesList.mockReturnValue({ data: { content: [], total: 0 }, isLoading: false });
    useTradeStats.mockReturnValue({ data: undefined });
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

  it('leaves the Exit column blank for OPEN trades and shows the fill for CLOSED', () => {
    useActiveAccount.mockReturnValue({
      scopedAccountId: 't1',
      isAll: false,
      activeAccount: mkAccount({ id: 't1', accountType: 'TRADING' }),
    });
    useTradesList.mockReturnValue({
      data: {
        content: [
          // OPEN: no real exit — must NOT display the live markPrice (3210).
          mkTrade({ id: 'open-1', status: 'OPEN', exitAvgPrice: null, markPrice: 3_210 }),
          // CLOSED: real exit fill is shown.
          mkTrade({
            id: 'closed-1',
            status: 'CLOSED',
            exitTime: 1_700_000_100_000,
            exitAvgPrice: 3_150,
            markPrice: 3_210,
          }),
        ],
        total: 2,
      },
      isLoading: false,
    });

    render(<TradesPage />);
    // The closed trade's real exit fill renders; the open trade's mark price does not.
    expect(screen.getByText('3,150.0000')).toBeInTheDocument();
    expect(screen.queryByText('3,210.0000')).not.toBeInTheDocument();
  });
});
