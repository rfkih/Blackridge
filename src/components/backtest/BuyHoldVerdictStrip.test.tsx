import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuyHoldVerdictStrip } from './BuyHoldVerdictStrip';

describe('BuyHoldVerdictStrip', () => {
  it('shows both returns, both drawdowns, and a captured-upside verdict when buy-hold was up', () => {
    render(
      <BuyHoldVerdictStrip
        symbol="BTCUSDT"
        strategyReturnPct={40}
        strategyMaxDdPct={-26}
        buyHoldReturnPct={83}
        buyHoldMaxDdPct={-49}
      />,
    );
    // both returns present
    expect(screen.getByText('+40.00%')).toBeInTheDocument();
    expect(screen.getByText('+83.00%')).toBeInTheDocument();
    // both drawdowns present (magnitudes)
    expect(screen.getByText('-26.00%')).toBeInTheDocument();
    expect(screen.getByText('-49.00%')).toBeInTheDocument();
    // verdict mentions captured upside and the drawdown framing
    expect(screen.getByText(/Captured/i)).toBeInTheDocument();
    expect(screen.getByText(/upside/i)).toBeInTheDocument();
    expect(screen.getByText(/drawdown/i)).toBeInTheDocument();
  });

  it('handles the buy-hold-was-down case without a nonsense upside figure', () => {
    render(
      <BuyHoldVerdictStrip
        symbol="ETHUSDT"
        strategyReturnPct={12}
        strategyMaxDdPct={-8}
        buyHoldReturnPct={-30}
        buyHoldMaxDdPct={-55}
      />,
    );
    // never claims "captured X% of upside" when buy-hold lost money
    expect(screen.queryByText(/Captured/i)).not.toBeInTheDocument();
    // says buy-hold was down and the strategy was up
    expect(screen.getByText(/buy-hold was down/i)).toBeInTheDocument();
    expect(screen.getByText(/strategy was up/i)).toBeInTheDocument();
    // returns still rendered
    expect(screen.getByText('+12.00%')).toBeInTheDocument();
    expect(screen.getByText('-30.00%')).toBeInTheDocument();
  });
});
