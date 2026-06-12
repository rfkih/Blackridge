import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureBreakdownPanel } from '@/components/trades/execution/FailureBreakdownPanel';
import type { ExecutionSummary } from '@/lib/api/tradeExecutions';

const summary: ExecutionSummary = {
  totalExecutions: 20,
  failedCount: 3,
  successCount: 17,
  successRatePct: 85,
  topCategory: 'MIN_NOTIONAL',
  byCategory: [
    { category: 'MIN_NOTIONAL', count: 2, pct: 66.7 },
    { category: 'INSUFFICIENT_BALANCE', count: 1, pct: 33.3 },
  ],
};

describe('FailureBreakdownPanel', () => {
  it('renders summary stats and cause bars', () => {
    render(
      <FailureBreakdownPanel
        summary={summary}
        isLoading={false}
        activeCategory={null}
        onSelectCategory={() => {}}
      />,
    );
    expect(screen.getByText('85%')).toBeInTheDocument();
    // "Min-notional" appears both as the Top-cause stat and the bar label — both are intended.
    expect(screen.getAllByText('Min-notional').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Min-notional/ })).toBeInTheDocument();
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });

  it('fires onSelectCategory when a bar is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FailureBreakdownPanel
        summary={summary}
        isLoading={false}
        activeCategory={null}
        onSelectCategory={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    expect(onSelect).toHaveBeenCalledWith('MIN_NOTIONAL');
  });

  it('toggles category off when the active bar is clicked again', () => {
    const onSelect = vi.fn();
    render(
      <FailureBreakdownPanel
        summary={summary}
        isLoading={false}
        activeCategory="MIN_NOTIONAL"
        onSelectCategory={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
