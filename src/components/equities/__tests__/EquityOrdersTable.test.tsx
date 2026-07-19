import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EquityOrdersTable } from '../EquityOrdersTable';
import type { EquityOrder } from '@/types/equity';

const rejectedOrder: EquityOrder = {
  symbol: 'NVDA',
  side: 'BUY',
  qty: 10,
  status: 'REJECTED',
  brokerOrderId: 'brk-rejected-1',
  asOfDate: '2026-07-17',
  profile: 'PAPER',
};

const filledOrder: EquityOrder = {
  symbol: 'AAPL',
  side: 'SELL',
  qty: 5,
  status: 'FILLED',
  brokerOrderId: 'brk-filled-2',
  asOfDate: '2026-07-18',
  profile: 'PAPER',
};

describe('EquityOrdersTable', () => {
  it('renders both a REJECTED and a FILLED order with their status pills', () => {
    render(
      <EquityOrdersTable orders={[rejectedOrder, filledOrder]} isLoading={false} isError={false} />,
    );
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByText('FILLED')).toBeInTheDocument();
  });

  it('applies profit color class to BUY side', () => {
    render(<EquityOrdersTable orders={[rejectedOrder]} isLoading={false} isError={false} />);
    const buyCell = screen.getByText('BUY');
    expect(buyCell.className).toContain('color-profit');
  });

  it('applies loss color class to SELL side', () => {
    render(<EquityOrdersTable orders={[filledOrder]} isLoading={false} isError={false} />);
    const sellCell = screen.getByText('SELL');
    expect(sellCell.className).toContain('color-loss');
  });

  it('renders dates without "Invalid Date"', () => {
    render(
      <EquityOrdersTable orders={[rejectedOrder, filledOrder]} isLoading={false} isError={false} />,
    );
    // All date cells should not contain "Invalid Date"
    const cells = screen.queryAllByText(/Invalid Date/);
    expect(cells).toHaveLength(0);
  });

  it('renders the broker order IDs', () => {
    render(
      <EquityOrdersTable orders={[rejectedOrder, filledOrder]} isLoading={false} isError={false} />,
    );
    expect(screen.getByText('brk-rejected-1')).toBeInTheDocument();
    expect(screen.getByText('brk-filled-2')).toBeInTheDocument();
  });

  it('renders a dash for null brokerOrderId', () => {
    const orderWithoutBrokerId: EquityOrder = {
      ...rejectedOrder,
      brokerOrderId: null,
    };
    render(<EquityOrdersTable orders={[orderWithoutBrokerId]} isLoading={false} isError={false} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the empty state title when no orders provided', () => {
    render(<EquityOrdersTable orders={[]} isLoading={false} isError={false} />);
    expect(screen.getByText('No equity orders')).toBeInTheDocument();
  });

  it('renders the error title when isError=true (proves empty ≠ error)', () => {
    render(<EquityOrdersTable orders={[]} isLoading={false} isError />);
    expect(screen.getByText('Equity service unavailable')).toBeInTheDocument();
    // Error state should NOT show the empty title
    expect(screen.queryByText('No equity orders')).not.toBeInTheDocument();
  });
});
