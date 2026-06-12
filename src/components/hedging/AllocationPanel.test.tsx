import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseAllocationResult } from '@/hooks/useAllocation';

import { AllocationPanel } from './AllocationPanel';

const useAllocation = vi.fn();
vi.mock('@/hooks/useAllocation', () => ({
  useAllocation: (...a: unknown[]) => useAllocation(...a),
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

describe('AllocationPanel', () => {
  beforeEach(() => useAllocation.mockReset());

  it('renders the current BTC and cash split', () => {
    useAllocation.mockReturnValue(mkAllocation());
    render(<AllocationPanel accountId="a1" />);
    expect(screen.getByText('Allocation')).toBeInTheDocument();
    expect(screen.getByText(/BTC 72.00%/)).toBeInTheDocument();
    expect(screen.getByText(/Cash 28.00%/)).toBeInTheDocument();
  });

  it('shows the target weight marker label when a target is configured', () => {
    useAllocation.mockReturnValue(mkAllocation({ targetWeightPct: 75 }));
    render(<AllocationPanel accountId="a1" />);
    expect(screen.getByTestId('target-marker')).toBeInTheDocument();
    expect(screen.getAllByText(/Target 75%/).length).toBeGreaterThan(0);
  });

  it('omits the target marker and notes no target when none is configured', () => {
    useAllocation.mockReturnValue(mkAllocation({ targetWeightPct: null }));
    render(<AllocationPanel accountId="a1" />);
    expect(screen.queryByTestId('target-marker')).not.toBeInTheDocument();
    expect(screen.getByText(/no target/i)).toBeInTheDocument();
  });

  it('renders an empty state when the account has no equity (no active strategy)', () => {
    useAllocation.mockReturnValue(
      mkAllocation({ equity: 0, btcWeightPct: 0, cashWeightPct: 0, targetWeightPct: null }),
    );
    render(<AllocationPanel accountId="a1" />);
    expect(screen.getByText(/no active hedging/i)).toBeInTheDocument();
  });

  it('shows an "Add a hedging strategy" CTA linking to strategies when empty', () => {
    useAllocation.mockReturnValue(
      mkAllocation({ equity: 0, btcWeightPct: 0, cashWeightPct: 0, targetWeightPct: null }),
    );
    render(<AllocationPanel accountId="a1" />);
    const cta = screen.getByRole('link', { name: /add a hedging strategy/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/strategies');
  });

  it('does not show the add-strategy CTA when the account is funded', () => {
    useAllocation.mockReturnValue(mkAllocation());
    render(<AllocationPanel accountId="a1" />);
    expect(screen.queryByRole('link', { name: /add a hedging strategy/i })).not.toBeInTheDocument();
  });
});
