import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountSummary } from '@/types/account';
import type { LeaderboardEntry } from '@/types/leaderboard';
import type { BacktestLeaderboardEntry, BacktestLeaderboardPage } from '@/types/leaderboardBacktest';
import type { PaperRow } from '@/types/papers';

// --- control the leaderboard data hooks + the active-account context ---
const useTopStrategies = vi.fn();
const useBacktestLeaderboard = vi.fn();
const usePapersLeaderboard = vi.fn();
const useActiveAccount = vi.fn();

vi.mock('@/hooks/useLeaderboard', () => ({
  useTopStrategies: (...args: unknown[]) => useTopStrategies(...args),
  useBacktestLeaderboard: (...args: unknown[]) => useBacktestLeaderboard(...args),
  usePapersLeaderboard: (...args: unknown[]) => usePapersLeaderboard(...args),
  useDeployStrategy: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));
vi.mock('@/hooks/useLeaderboardStream', () => ({
  useLeaderboardStream: () => undefined,
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

// --- the deploy dialog pulls its own hooks; render nothing in the test ---
vi.mock('@/components/leaderboard/DeployStrategyDialog', () => ({
  DeployStrategyDialog: () => null,
}));
vi.mock('@/components/leaderboard/RequestApprovalDialog', () => ({
  RequestApprovalDialog: () => null,
}));

import LeaderboardPage from './page';

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
    earnEnabled: false,
    bookVolTargetPct: 15,
    ...p,
  };
}

function mkEntry(p: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    rank: 1,
    symbol: 'BTCUSDT',
    strategyCode: 'LSR',
    interval: '1h',
    cagrPct: 50,
    maxDrawdownPct: -10,
    psr: 0.9,
    deflatedSharpe: 1.2,
    profitFactor: 1.5,
    sortino: 2,
    calmar: 5,
    trades: 120,
    nLive: null,
    walkForwardVerdict: 'ROBUST',
    driftStatus: null,
    capacityTier: null,
    score: 0.8,
    computedAt: null,
    corrToBook: null,
    nearSubstitute: false,
    bestParams: {},
    strategyKind: 'TRADING',
    ...p,
  };
}

function mkBacktest(p: Partial<BacktestLeaderboardEntry>): BacktestLeaderboardEntry {
  return {
    rank: 1,
    symbol: 'BTCUSDT',
    strategyCode: 'LSR',
    interval: '1h',
    backtestRunId: 'run-1',
    cagrPct: 40,
    maxDrawdownPct: -12,
    psr: 0.8,
    deflatedSharpe: 1.1,
    dsrNTrials: 10,
    profitFactor: 1.4,
    sortino: 1.9,
    trades: 150,
    winRate: 0.55,
    dataStart: '2022-01-01',
    dataEnd: '2024-01-01',
    spanDays: 730,
    runCreatedAt: '2024-01-02T00:00:00',
    walkForwardVerdict: 'ROBUST',
    bestParams: {},
    strategyKind: 'TRADING',
    ...p,
  };
}

function mkPaper(p: Partial<PaperRow>): PaperRow {
  return {
    paper_id: 'BH-LSR-BTCUSDT-1H-aaaa1111',
    queue_id: 'q1',
    title: 'A trading paper',
    abstract: null,
    paper_status: 'FINALIZED',
    version: 1,
    strategy_code: 'LSR',
    instrument: 'BTCUSDT',
    interval_name: '1h',
    final_verdict: 'PASS',
    total_iterations: 5,
    win_rate: 0.55,
    annualized_return_pct: 40,
    profit_factor: 1.4,
    n_trades: 150,
    max_drawdown_pct: -12,
    sharpe_ratio: 1.1,
    created_time: '2024-01-01T00:00:00Z',
    updated_time: '2024-01-01T00:00:00Z',
    strategy_kind: 'TRADING',
    ...p,
  };
}

// Trading-kind fixtures use BTC symbols; hedging-kind use SOL — so a rendered
// symbol uniquely identifies which kind reached a section.
const tradingEntry = mkEntry({ symbol: 'BTCUSDT', strategyKind: 'TRADING' });
const hedgingEntry = mkEntry({
  symbol: 'SOLUSDT',
  strategyCode: 'DYNAMIC_TILT_BTC',
  strategyKind: 'HEDGING',
});

const backtestPage: BacktestLeaderboardPage = {
  entries: [mkBacktest({ symbol: 'BTCUSDT', strategyKind: 'TRADING' })],
  qualifyingCells: 3,
  shown: 1,
  hedgingEntries: [
    mkBacktest({ symbol: 'SOLUSDT', strategyCode: 'DYNAMIC_TILT_BTC', strategyKind: 'HEDGING' }),
  ],
  hedgingQualifyingCells: 2,
  hedgingShown: 1,
};

const tradingPaper = mkPaper({
  paper_id: 'BH-LSR-BTCUSDT-1H-aaaa1111',
  instrument: 'BTCUSDT',
  strategy_kind: 'TRADING',
});
const hedgingPaper = mkPaper({
  paper_id: 'BH-DYNAMIC_TILT_BTC-SOLUSDT-1H-bbbb2222',
  instrument: 'SOLUSDT',
  strategy_code: 'DYNAMIC_TILT_BTC',
  strategy_kind: 'HEDGING',
});

function primeHooks() {
  useTopStrategies.mockReturnValue({
    data: [tradingEntry, hedgingEntry],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useBacktestLeaderboard.mockReturnValue({
    data: backtestPage,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  usePapersLeaderboard.mockReturnValue({
    data: { items: [tradingPaper, hedgingPaper], next_cursor: null, next_actions: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

describe('LeaderboardPage — filter by active account type', () => {
  beforeEach(() => {
    useTopStrategies.mockReset();
    useBacktestLeaderboard.mockReset();
    usePapersLeaderboard.mockReset();
    useActiveAccount.mockReset();
    primeHooks();
  });

  it('All mode (no single active account) shows both trading and hedging strategies in every tab', async () => {
    useActiveAccount.mockReturnValue({
      accounts: [mkAccount({ id: 't1' }), mkAccount({ id: 'h1', accountType: 'HEDGING' })],
      scopedAccountId: undefined,
      activeAccount: null,
    });

    render(<LeaderboardPage />);

    // Conviction tab is the default — both kinds present.
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();

    // Backtest tab — both sets present.
    await userEvent.click(screen.getByRole('tab', { name: 'Backtest' }));
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();

    // Papers tab — both rows present.
    await userEvent.click(screen.getByRole('tab', { name: 'Research papers' }));
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();
  });

  it('HEDGING account shows only hedging strategies across all three tabs', async () => {
    useActiveAccount.mockReturnValue({
      accounts: [mkAccount({ id: 'h1', accountType: 'HEDGING' })],
      scopedAccountId: 'h1',
      activeAccount: mkAccount({ id: 'h1', accountType: 'HEDGING' }),
    });

    render(<LeaderboardPage />);

    // Conviction
    expect(screen.queryByText('BTCUSDT')).not.toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();

    // Backtest
    await userEvent.click(screen.getByRole('tab', { name: 'Backtest' }));
    expect(screen.queryByText('BTCUSDT')).not.toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();

    // Papers
    await userEvent.click(screen.getByRole('tab', { name: 'Research papers' }));
    expect(screen.queryByText('BTCUSDT')).not.toBeInTheDocument();
    expect(screen.getByText('SOLUSDT')).toBeInTheDocument();
  });

  it('TRADING account shows only trading strategies across all three tabs', async () => {
    useActiveAccount.mockReturnValue({
      accounts: [mkAccount({ id: 't1', accountType: 'TRADING' })],
      scopedAccountId: 't1',
      activeAccount: mkAccount({ id: 't1', accountType: 'TRADING' }),
    });

    render(<LeaderboardPage />);

    // Conviction
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.queryByText('SOLUSDT')).not.toBeInTheDocument();

    // Backtest
    await userEvent.click(screen.getByRole('tab', { name: 'Backtest' }));
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.queryByText('SOLUSDT')).not.toBeInTheDocument();

    // Papers
    await userEvent.click(screen.getByRole('tab', { name: 'Research papers' }));
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    expect(screen.queryByText('SOLUSDT')).not.toBeInTheDocument();
  });

  it('legacy null strategyKind counts as trading (visible to a TRADING account, hidden from HEDGING)', () => {
    useTopStrategies.mockReturnValue({
      data: [mkEntry({ symbol: 'XRPUSDT', strategyKind: null })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useBacktestLeaderboard.mockReturnValue({
      data: { entries: [], qualifyingCells: 0, shown: 0, hedgingEntries: [], hedgingQualifyingCells: 0, hedgingShown: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePapersLeaderboard.mockReturnValue({
      data: { items: [], next_cursor: null, next_actions: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useActiveAccount.mockReturnValue({
      accounts: [mkAccount({ id: 'h1', accountType: 'HEDGING' })],
      scopedAccountId: 'h1',
      activeAccount: mkAccount({ id: 'h1', accountType: 'HEDGING' }),
    });

    const { unmount } = render(<LeaderboardPage />);
    // HEDGING account: a null-kind (legacy trading) row must NOT appear.
    expect(screen.queryByText('XRPUSDT')).not.toBeInTheDocument();
    unmount();

    useActiveAccount.mockReturnValue({
      accounts: [mkAccount({ id: 't1', accountType: 'TRADING' })],
      scopedAccountId: 't1',
      activeAccount: mkAccount({ id: 't1', accountType: 'TRADING' }),
    });
    render(<LeaderboardPage />);
    // TRADING account: the null-kind row IS visible.
    expect(screen.getByText('XRPUSDT')).toBeInTheDocument();
  });
});
