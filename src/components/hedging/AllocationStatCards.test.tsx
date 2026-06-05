import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseAllocationResult } from '@/hooks/useAllocation';

const useAllocation = vi.fn();
const useEquityCurve = vi.fn();

vi.mock('@/hooks/useAllocation', () => ({
  useAllocation: (...a: unknown[]) => useAllocation(...a),
}));
vi.mock('@/hooks/useEquityCurve', () => ({
  useEquityCurve: () => useEquityCurve(),
}));

import { AllocationStatCards } from './AllocationStatCards';

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

describe('AllocationStatCards', () => {
  beforeEach(() => {
    useAllocation.mockReset();
    useEquityCurve.mockReset();
  });

  it('shows BTC weight and cash weight as percentages', () => {
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({ stats: null });

    render(<AllocationStatCards accountId="a1" />);
    expect(screen.getByText('BTC weight')).toBeInTheDocument();
    expect(screen.getByText('72.00%')).toBeInTheDocument();
    expect(screen.getByText('Cash weight')).toBeInTheDocument();
    expect(screen.getByText('28.00%')).toBeInTheDocument();
  });

  it('renders max drawdown from the equity series when available', () => {
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({ stats: { maxDrawdown: -18.4 } });

    render(<AllocationStatCards accountId="a1" />);
    expect(screen.getByText('Max drawdown')).toBeInTheDocument();
    expect(screen.getByText('-18.40%')).toBeInTheDocument();
  });

  it('shows a not-available dash for max drawdown when no equity history', () => {
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({ stats: null });

    render(<AllocationStatCards accountId="a1" />);
    const dd = screen.getByTestId('stat-maxDrawdown');
    expect(dd).toHaveTextContent('—');
  });

  it('omits btcStack and sharpe cards (require data the app does not expose)', () => {
    useAllocation.mockReturnValue(mkAllocation());
    useEquityCurve.mockReturnValue({ stats: { maxDrawdown: -5 } });

    render(<AllocationStatCards accountId="a1" />);
    // BTC-stack× and Sharpe need a price-aligned equity history the app
    // doesn't expose yet — they are intentionally not faked here.
    expect(screen.queryByText(/BTC-stack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sharpe/i)).not.toBeInTheDocument();
  });
});
