import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionTable } from '@/components/trades/execution/ExecutionTable';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';

const rows: ExecutionEvent[] = [{
  id: '1', executionType: 'OPEN', side: 'LONG', status: 'FAILED', accountId: 'a', username: 'u',
  asset: 'BTCUSDT', strategyName: 'VRP_BTC', executionReason: null,
  errorMessage: 'Pre-trade validation: below minimum notional. min=7, estimated=4',
  tradeId: null, executedAt: '2026-06-11T12:34:07', failureCategory: 'MIN_NOTIONAL',
}];

describe('ExecutionTable', () => {
  it('renders a row with its cause badge and calls onRowClick', () => {
    const onRowClick = vi.fn();
    render(<ExecutionTable rows={rows} isLoading={false} onRowClick={onRowClick} />);
    expect(screen.getByText('Min-notional')).toBeInTheDocument();
    fireEvent.click(screen.getByText('BTCUSDT'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
