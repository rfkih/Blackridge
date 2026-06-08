import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndicatorBar } from '../IndicatorBar';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';

describe('IndicatorBar', () => {
  it('renders a pill per indicator and fires onToggle with the key', () => {
    const onToggle = vi.fn();
    render(<IndicatorBar indicators={DEFAULT_INDICATORS} onToggle={onToggle} />);
    const ema20 = screen.getByRole('button', { name: /^EMA 20$/i });
    expect(ema20).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ema20);
    expect(onToggle).toHaveBeenCalledWith('ema20');
  });
  it('marks active indicators as pressed', () => {
    render(<IndicatorBar indicators={{ ...DEFAULT_INDICATORS, rsi: true }} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /RSI/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
