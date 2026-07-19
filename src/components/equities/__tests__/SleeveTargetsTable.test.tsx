import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SleeveTargetsTable } from '../SleeveTargetsTable';
import type { SleeveTarget } from '@/types/equity';

const sampleTarget: SleeveTarget = {
  targetId: 't1',
  bookCode: 'EQ7_AGGRESSIVE',
  bookVersion: 1,
  sleeveCode: 'EQ_US_TREND',
  symbol: 'NVDA',
  exchange: 'NASDAQ',
  currency: 'USD',
  side: 'LONG',
  targetWeight: 0.15, // fraction — should display as 15.00%
  targetNotional: 1500,
  asOfDate: '2026-07-17',
};

describe('SleeveTargetsTable', () => {
  it('renders a target row with symbol, single-multiplied weight, and side', () => {
    render(<SleeveTargetsTable targets={[sampleTarget]} isLoading={false} isError={false} />);
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('15.00%')).toBeInTheDocument();
    expect(screen.getByText('LONG')).toBeInTheDocument();
  });

  it('does NOT render double-multiplied weight (1500%)', () => {
    render(<SleeveTargetsTable targets={[sampleTarget]} isLoading={false} isError={false} />);
    expect(screen.queryByText('1500.00%')).not.toBeInTheDocument();
  });

  it('renders the empty state title when no targets provided', () => {
    render(<SleeveTargetsTable targets={[]} isLoading={false} isError={false} />);
    expect(screen.getByText('No targets')).toBeInTheDocument();
  });

  it('renders the empty description for empty targets', () => {
    render(<SleeveTargetsTable targets={[]} isLoading={false} isError={false} />);
    expect(
      screen.getByText('Run the Book Authority compute for this book/date.'),
    ).toBeInTheDocument();
  });

  it('renders sleeveCode in the row', () => {
    render(<SleeveTargetsTable targets={[sampleTarget]} isLoading={false} isError={false} />);
    expect(screen.getByText('EQ_US_TREND')).toBeInTheDocument();
  });
});
