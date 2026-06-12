import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionDetailDrawer } from '@/components/trades/execution/ExecutionDetailDrawer';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';

const base: ExecutionEvent = {
  id: '1',
  executionType: 'OPEN',
  side: 'LONG',
  status: 'FAILED',
  accountId: 'a',
  username: 'u',
  asset: 'BTCUSDT',
  strategyName: 'VRP_BTC',
  executionReason: 'ZSCORE entry',
  errorMessage: 'Pre-trade validation: below minimum notional',
  tradeId: null,
  executedAt: '2026-06-11T12:34:07',
  failureCategory: 'MIN_NOTIONAL',
};

describe('ExecutionDetailDrawer', () => {
  it('shows the raw error and the no-trade note when tradeId is null', () => {
    render(<ExecutionDetailDrawer event={base} onClose={() => {}} />);
    expect(screen.getByText(/below minimum notional/)).toBeInTheDocument();
    expect(screen.getByText(/rejected before a trade was created/i)).toBeInTheDocument();
  });

  it('renders a trade link when tradeId is present', () => {
    render(<ExecutionDetailDrawer event={{ ...base, tradeId: 't-9' }} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /view trade/i })).toHaveAttribute(
      'href',
      '/trades/t-9',
    );
  });

  it('calls onClose', () => {
    const onClose = vi.fn();
    render(<ExecutionDetailDrawer event={base} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when event is null', () => {
    const { container } = render(<ExecutionDetailDrawer event={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a failure header title + cause badge + copy button for a failed OPEN', () => {
    render(<ExecutionDetailDrawer event={base} onClose={() => {}} />);
    expect(screen.getByText('Open failed')).toBeInTheDocument();
    expect(screen.getByText(/Min-notional/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy error message/i })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ExecutionDetailDrawer event={base} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
