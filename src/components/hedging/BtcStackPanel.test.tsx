import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BtcStackPanel, type BtcStackPoint } from './BtcStackPanel';

describe('BtcStackPanel', () => {
  it('renders the coming-soon empty state when no stack series is available', () => {
    render(<BtcStackPanel series={null} />);
    expect(screen.getByText('BTC stack')).toBeInTheDocument();
    expect(screen.getByText(/requires price history/i)).toBeInTheDocument();
  });

  it('renders the empty state for an empty series (does not fabricate a curve)', () => {
    render(<BtcStackPanel series={[]} />);
    expect(screen.getByText(/requires price history/i)).toBeInTheDocument();
  });

  it('plots the stack curve and labels the latest multiple when a series is provided', () => {
    const series: BtcStackPoint[] = [
      { time: 1, stackMultiple: 1.0 },
      { time: 2, stackMultiple: 1.12 },
      { time: 3, stackMultiple: 1.25 },
    ];
    render(<BtcStackPanel series={series} />);
    expect(screen.queryByText(/requires price history/i)).not.toBeInTheDocument();
    // latest BTC-stack multiple surfaced as a header figure
    expect(screen.getByTestId('btc-stack-latest')).toHaveTextContent('1.25×');
  });
});
