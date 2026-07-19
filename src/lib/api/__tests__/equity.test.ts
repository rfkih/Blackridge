import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEquityPositions, getEquityOrders } from '../equityService';
import { equityClient } from '../client';

vi.mock('../client', () => ({ equityClient: { get: vi.fn() } }));

describe('equity api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getEquityPositions maps + coerces', async () => {
    (equityClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          symbol: 'NVDA',
          profile: 'PAPER',
          venue: 'US',
          bookCode: 'EQ7_AGGRESSIVE',
          sleeveCode: 'EQ_US_TREND',
          qty: '10',
          avgPrice: '120.50',
        },
      ],
    });
    const pos = await getEquityPositions('PAPER');
    expect(equityClient.get).toHaveBeenCalledWith('/positions', { params: { profile: 'PAPER' } });
    expect(pos[0]).toMatchObject({ symbol: 'NVDA', qty: 10, avgPrice: 120.5 });
  });

  it('getEquityOrders maps', async () => {
    (equityClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          symbol: 'NVDA',
          side: 'BUY',
          qty: '10',
          status: 'SUBMITTED',
          brokerOrderId: 'brk-1',
          asOfDate: '2026-07-17',
          profile: 'PAPER',
        },
      ],
    });
    const orders = await getEquityOrders('PAPER', '2026-07-17');
    expect(equityClient.get).toHaveBeenCalledWith('/orders', {
      params: { profile: 'PAPER', asOfDate: '2026-07-17' },
    });
    expect(orders[0]).toMatchObject({
      symbol: 'NVDA',
      side: 'BUY',
      qty: 10,
      status: 'SUBMITTED',
    });
  });
});
