import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawdownVsBuyHoldPanel, type DrawdownSeriesPoint } from './DrawdownVsBuyHoldPanel';

const STRAT: DrawdownSeriesPoint[] = [
  { time: 1, drawdownPct: 0 },
  { time: 2, drawdownPct: -8 },
  { time: 3, drawdownPct: -3 },
];

const BUYHOLD: DrawdownSeriesPoint[] = [
  { time: 1, drawdownPct: 0 },
  { time: 2, drawdownPct: -22 },
  { time: 3, drawdownPct: -15 },
];

describe('DrawdownVsBuyHoldPanel', () => {
  it('renders the empty state when the BTC buy-hold series is unavailable', () => {
    render(<DrawdownVsBuyHoldPanel strategySeries={STRAT} buyHoldSeries={null} />);
    expect(screen.getByText('Drawdown vs buy-hold')).toBeInTheDocument();
    expect(screen.getByText(/requires price history/i)).toBeInTheDocument();
  });

  it('renders the empty state when the strategy series is empty', () => {
    render(<DrawdownVsBuyHoldPanel strategySeries={[]} buyHoldSeries={BUYHOLD} />);
    expect(screen.getByText(/requires price history/i)).toBeInTheDocument();
  });

  it('overlays both drawdown curves when both series are present', () => {
    render(<DrawdownVsBuyHoldPanel strategySeries={STRAT} buyHoldSeries={BUYHOLD} />);
    expect(screen.queryByText(/requires price history/i)).not.toBeInTheDocument();
    // legend distinguishes the two series
    expect(screen.getByText(/Strategy/)).toBeInTheDocument();
    expect(screen.getByText(/BTC buy-hold/)).toBeInTheDocument();
  });
});
