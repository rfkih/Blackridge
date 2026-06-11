import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../test-utils';

const summary = {
  totalExecutions: 20, failedCount: 3, successCount: 17, successRatePct: 85, topCategory: 'MIN_NOTIONAL',
  byCategory: [{ category: 'MIN_NOTIONAL', count: 2, pct: 66.7 }, { category: 'INSUFFICIENT_BALANCE', count: 1, pct: 33.3 }],
};
const listData = {
  content: [{
    id: '1', executionType: 'OPEN', side: 'LONG', status: 'FAILED', accountId: 'a', username: 'u',
    asset: 'BTCUSDT', strategyName: 'VRP_BTC', executionReason: null,
    errorMessage: 'below minimum notional', tradeId: null,
    executedAt: '2026-06-11T12:34:07', failureCategory: 'MIN_NOTIONAL',
  }],
  page: 0, size: 20, total: 1,
};

const useExecutionSummary = vi.fn();
const useExecutionsList = vi.fn();
vi.mock('@/hooks/useTradeExecutions', () => ({
  useExecutionSummary: (...a: unknown[]) => useExecutionSummary(...a),
  useExecutionsList: (...a: unknown[]) => useExecutionsList(...a),
}));
vi.mock('@/hooks/useStrategies', () => ({ useStrategies: () => ({ data: [] }) }));

import { ExecutionHistoryTab } from '@/components/trades/execution/ExecutionHistoryTab';

describe('ExecutionHistoryTab', () => {
  beforeEach(() => {
    useExecutionSummary.mockReturnValue({ data: summary, isLoading: false });
    useExecutionsList.mockReturnValue({ data: listData, isLoading: false });
  });

  it('renders breakdown + table', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
  });

  it('clicking a cause bar passes failureCategory to the list hook', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    const lastCall = useExecutionsList.mock.calls.at(-1)![0];
    expect(lastCall.failureCategory).toBe('MIN_NOTIONAL');
  });

  it('opens the drawer on row click', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    fireEvent.click(screen.getByText('BTCUSDT'));
    expect(screen.getByRole('dialog', { name: /execution detail/i })).toBeInTheDocument();
  });
});
