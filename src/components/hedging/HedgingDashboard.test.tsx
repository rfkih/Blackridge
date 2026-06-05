import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseAllocationResult } from '@/hooks/useAllocation';

// The composition renders leaf widgets that each read their own data hooks.
// Mock the leaf hooks so the dashboard renders without a query client / network.
const useAllocation = vi.fn();
const useEquityCurve = vi.fn();
const useRebalances = vi.fn();

vi.mock('@/hooks/useAllocation', () => ({
  useAllocation: (...a: unknown[]) => useAllocation(...a),
}));
vi.mock('@/hooks/useEquityCurve', () => ({
  useEquityCurve: () => useEquityCurve(),
}));
vi.mock('@/hooks/useRebalances', () => ({
  useRebalances: (...a: unknown[]) => useRebalances(...a),
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
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({ stats: { maxDrawdown: -18.4 } });
    useRebalances.mockReturnValue({ data: [], isLoading: false, isError: false });
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

  it('passes the scoped account id down to the data hooks', () => {
    render(<HedgingDashboard accountId="acc-1" />);
    expect(useAllocation).toHaveBeenCalledWith('acc-1');
    expect(useRebalances).toHaveBeenCalledWith('acc-1');
  });
});
