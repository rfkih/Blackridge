import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountTypeBadge } from './AccountTypeBadge';

describe('AccountTypeBadge', () => {
  it('renders the Hedging label and an icon for HEDGING', () => {
    const { container } = render(<AccountTypeBadge type="HEDGING" />);
    expect(screen.getByText('Hedging')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the Trading label for TRADING', () => {
    render(<AccountTypeBadge type="TRADING" />);
    expect(screen.getByText('Trading')).toBeInTheDocument();
  });

  it('forwards a custom className', () => {
    const { container } = render(<AccountTypeBadge type="TRADING" className="custom-x" />);
    expect(container.querySelector('.custom-x')).toBeInTheDocument();
  });
});
