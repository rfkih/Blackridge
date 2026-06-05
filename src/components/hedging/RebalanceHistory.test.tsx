import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RebalanceEvent } from '@/hooks/useRebalances';

const useRebalances = vi.fn();
vi.mock('@/hooks/useRebalances', () => ({
  useRebalances: (...a: unknown[]) => useRebalances(...a),
}));

import { RebalanceHistory } from './RebalanceHistory';

const EVENTS: RebalanceEvent[] = [
  {
    id: 'r1',
    time: 1_700_000_500_000,
    fromWeightPct: null,
    toWeightPct: null,
    reason: 'runner close',
    realizedDelta: 512.5,
  },
  {
    id: 'r2',
    time: 1_700_000_000_000,
    fromWeightPct: null,
    toWeightPct: null,
    reason: 'de-risk',
    realizedDelta: -88,
  },
];

describe('RebalanceHistory', () => {
  beforeEach(() => useRebalances.mockReset());

  it('renders a row per rebalance event with reason and realized delta', () => {
    useRebalances.mockReturnValue({ data: EVENTS, isLoading: false, isError: false });
    render(<RebalanceHistory accountId="a1" />);

    expect(screen.getByText('runner close')).toBeInTheDocument();
    expect(screen.getByText('de-risk')).toBeInTheDocument();
    expect(screen.getByText(/\+512\.50 USDT/)).toBeInTheDocument();
    expect(screen.getByText(/-88\.00 USDT/)).toBeInTheDocument();
  });

  it('does not render an always-empty from/to weight column', () => {
    useRebalances.mockReturnValue({ data: [EVENTS[0]], isLoading: false, isError: false });
    render(<RebalanceHistory accountId="a1" />);
    // the weight is null on every event today, so the column is dropped entirely
    // rather than rendered as a permanent "—"
    expect(screen.queryByRole('columnheader', { name: /weight/i })).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    // the informative columns remain
    expect(screen.getByRole('columnheader', { name: /time/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /reason/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /realized/i })).toBeInTheDocument();
  });

  it('renders the empty state when there are no rebalances', () => {
    useRebalances.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<RebalanceHistory accountId="a1" />);
    expect(screen.getByText(/no rebalances yet/i)).toBeInTheDocument();
  });
});
