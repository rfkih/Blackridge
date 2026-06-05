import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseAllocationResult } from '@/hooks/useAllocation';

// The composition renders leaf widgets that each read their own data hooks.
// Mock the leaf hooks so the dashboard renders without a query client / network.
const useAllocation = vi.fn();
const useEquityCurve = vi.fn();
const useRebalances = vi.fn();
const useBtcBuyHold = vi.fn();

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

import { HedgingDashboard } from './HedgingDashboard';

function mkAllocation(overrides: Partial<UseAllocationResult> = {}): UseAllocationResult {
  return {
    btcWeightPct: 72,
    cashWeightPct: 28,
    targetWeightPct: 75,
    btcValue: 7_200,
    cashValue: 2_800,
    equity: 10_000,
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

  it('fills the BTC-stack and drawdown panels with real series — no "coming soon" shells', () => {
    render(<HedgingDashboard accountId="acc-1" />);
    // both panels render plotted content, not their price-history empty state
    expect(screen.queryByText(/requires price history/i)).not.toBeInTheDocument();
    // the equity points + period are forwarded to the BTC compare hook
    expect(useBtcBuyHold).toHaveBeenCalledWith(
      [{ time: 1, equity: 100, drawdown: 0 }],
      '30D',
    );
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
