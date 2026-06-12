import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseAllocationResult } from '@/hooks/useAllocation';

import { HedgingDashboard } from './HedgingDashboard';

// The composition renders leaf widgets that each read their own data hooks.
// Mock the leaf hooks so the dashboard renders without a query client / network.
const useAllocation = vi.fn();
const useEquityCurve = vi.fn();
const useRebalances = vi.fn();
const useBtcBuyHold = vi.fn();
const useEarnPosition = vi.fn();
const useCurrencyFormatter = vi.fn();

vi.mock('@/hooks/useEarnPosition', () => ({
  useEarnPosition: (...a: unknown[]) => useEarnPosition(...a),
}));
// Leaf card with its own account/mutation hooks — stub it in this composition test.
vi.mock('./EarnToggleCard', () => ({ EarnToggleCard: () => null }));
vi.mock('@/hooks/useCurrency', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useCurrency')>()),
  useCurrencyFormatter: () => useCurrencyFormatter(),
}));
vi.mock('@/hooks/useAllocation', () => ({
  useAllocation: (...a: unknown[]) => useAllocation(...a),
}));
vi.mock('@/hooks/useEquityCurve', () => ({
  useEquityCurve: () => useEquityCurve(),
}));
vi.mock('@/hooks/useRebalances', () => ({
  useRebalances: (...a: unknown[]) => useRebalances(...a),
}));
vi.mock('@/hooks/useBtcBuyHold', () => ({
  useBtcBuyHold: (...a: unknown[]) => useBtcBuyHold(...a),
}));

function mkAllocation(overrides: Partial<UseAllocationResult> = {}): UseAllocationResult {
  return {
    btcWeightPct: 72,
    cashWeightPct: 28,
    targetWeightPct: 75,
    btcValue: 7_200,
    cashValue: 2_800,
    equity: 10_000,
    earnUsdt: 0,
    isLoading: false,
    isError: false,
    ...overrides,
  };
}

describe('HedgingDashboard', () => {
  beforeEach(() => {
    useAllocation.mockReset();
    useEquityCurve.mockReset();
    useRebalances.mockReset();
    useBtcBuyHold.mockReset();
    useEarnPosition.mockReset();
    useCurrencyFormatter.mockReset();
    useEarnPosition.mockReturnValue({ data: { asset: 'USDT', amountUsdt: 0, enabled: false } });
    useCurrencyFormatter.mockReturnValue((n: number) => `$${Number(n).toFixed(2)}`);
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({
      stats: { maxDrawdown: -18.4 },
      points: [{ time: 1, equity: 100, drawdown: 0 }],
      period: '30D',
    });
    useRebalances.mockReturnValue({ data: [], isLoading: false, isError: false });
    // Default: real BTC compare series available (panels render content, not empty states)
    useBtcBuyHold.mockReturnValue({
      strategyDrawdown: [
        { time: 1, drawdownPct: 0 },
        { time: 2, drawdownPct: -8 },
      ],
      buyHoldDrawdown: [
        { time: 1, drawdownPct: 0 },
        { time: 2, drawdownPct: -22 },
      ],
      btcStack: [
        { time: 1, stackMultiple: 1 },
        { time: 2, stackMultiple: 1.1 },
      ],
      verdict: { upsideCapturedPct: null, ddCutPct: 63 },
      isLoading: false,
    });
  });

  it('renders the hedging widget set for the active account', () => {
    render(<HedgingDashboard accountId="acc-1" />);

    // AllocationStatCards
    expect(screen.getByText('BTC weight')).toBeInTheDocument();
    expect(screen.getByText('Cash weight')).toBeInTheDocument();
    // AllocationPanel
    expect(screen.getByText('Allocation')).toBeInTheDocument();
    // BtcStackPanel
    expect(screen.getByText('BTC stack')).toBeInTheDocument();
    // DrawdownVsBuyHoldPanel
    expect(screen.getByText('Drawdown vs buy-hold')).toBeInTheDocument();
    // RebalanceHistory
    expect(screen.getByText('Rebalances')).toBeInTheDocument();
  });

  it('shows USDT parked in Earn and folds it into the cash weight', () => {
    // 1000 USDT in Earn on top of 7200 BTC / 2800 spot cash (spot equity 10000).
    // useAllocation now performs the fold itself; the dashboard renders its result.
    // cash = (2800 + 1000) / (10000 + 1000) = 34.55% ; btc = 7200 / 11000 = 65.45%
    useEarnPosition.mockReturnValue({ data: { asset: 'USDT', amountUsdt: 1000, enabled: true } });
    useAllocation.mockReturnValue(
      mkAllocation({
        btcWeightPct: 65.4545454545,
        cashWeightPct: 34.5454545454,
        cashValue: 3_800,
        equity: 11_000,
        earnUsdt: 1_000,
      }),
    );
    render(<HedgingDashboard accountId="acc-1" />);

    expect(screen.getByTestId('stat-inEarn')).toHaveTextContent('$1000.00');
    expect(screen.getByTestId('stat-cashWeight')).toHaveTextContent('34.55%');
    expect(screen.getByTestId('stat-btcWeight')).toHaveTextContent('65.45%');
  });

  it('shows "Off" in the Earn card when the feature is disabled', () => {
    useEarnPosition.mockReturnValue({ data: { asset: 'USDT', amountUsdt: 0, enabled: false } });
    render(<HedgingDashboard accountId="acc-1" />);
    expect(screen.getByTestId('stat-inEarn')).toHaveTextContent('Off');
  });

  it('fills the BTC-stack and drawdown panels with real series — no "coming soon" shells', () => {
    render(<HedgingDashboard accountId="acc-1" />);
    // both panels render plotted content, not their price-history empty state
    expect(screen.queryByText(/requires price history/i)).not.toBeInTheDocument();
    // the equity points + period are forwarded to the BTC compare hook
    expect(useBtcBuyHold).toHaveBeenCalledWith([{ time: 1, equity: 100, drawdown: 0 }], '30D');
  });

  it('still renders the panels honestly when the BTC compare series is unavailable', () => {
    useBtcBuyHold.mockReturnValue({
      strategyDrawdown: null,
      buyHoldDrawdown: null,
      btcStack: null,
      verdict: null,
      isLoading: false,
    });
    render(<HedgingDashboard accountId="acc-1" />);
    // panels are present but show their honest empty state rather than fabricated data
    expect(screen.getByText('BTC stack')).toBeInTheDocument();
    expect(screen.getByText('Drawdown vs buy-hold')).toBeInTheDocument();
  });

  it('passes the scoped account id down to the data hooks', () => {
    render(<HedgingDashboard accountId="acc-1" />);
    expect(useAllocation).toHaveBeenCalledWith('acc-1');
    expect(useRebalances).toHaveBeenCalledWith('acc-1');
  });
});
