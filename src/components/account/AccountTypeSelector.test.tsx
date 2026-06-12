import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountTypeSelector } from './AccountTypeSelector';

describe('AccountTypeSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
  });

  it('renders an option per account type with the labels', () => {
    render(<AccountTypeSelector value="TRADING" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Trading/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hedging/ })).toBeInTheDocument();
  });

  it('calls onChange with HEDGING when the Hedging option is clicked', () => {
    render(<AccountTypeSelector value="TRADING" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Hedging/ }));
    expect(onChange).toHaveBeenCalledWith('HEDGING');
  });

  it('does not fire onChange for the already-selected value', () => {
    render(<AccountTypeSelector value="TRADING" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Trading/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects disabled — no onChange on click', () => {
    render(<AccountTypeSelector value="TRADING" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /Hedging/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the selected option with aria-pressed', () => {
    render(<AccountTypeSelector value="HEDGING" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Hedging/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Trading/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
