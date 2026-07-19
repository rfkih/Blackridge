import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBooks, getBookTargets } from '../books';
import { apiClient } from '../client';

vi.mock('../client', () => ({ apiClient: { get: vi.fn() } }));

describe('books api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getBooks maps + coerces', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          bookCode: 'EQ7_AGGRESSIVE',
          version: 1,
          status: 'CANDIDATE',
          frozenAt: null,
          createdTime: '2026-07-19T00:00:00',
        },
      ],
    });
    const books = await getBooks();
    expect(apiClient.get).toHaveBeenCalledWith('/api/portfolio-books');
    expect(books[0]).toMatchObject({
      bookCode: 'EQ7_AGGRESSIVE',
      version: 1,
      status: 'CANDIDATE',
    });
  });

  it('getBookTargets maps fraction weights + string notionals', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          targetId: 't1',
          bookCode: 'EQ7_AGGRESSIVE',
          bookVersion: 1,
          sleeveCode: 'EQ_US_TREND',
          symbol: 'NVDA',
          exchange: 'NASDAQ',
          currency: 'USD',
          side: 'LONG',
          targetWeight: '0.15',
          targetNotional: '1500.00',
          asOfDate: '2026-07-17',
        },
      ],
    });
    const targets = await getBookTargets('EQ7_AGGRESSIVE', '2026-07-17');
    expect(apiClient.get).toHaveBeenCalledWith('/api/portfolio-books/EQ7_AGGRESSIVE/targets', {
      params: { asOfDate: '2026-07-17' },
    });
    expect(targets[0].targetWeight).toBeCloseTo(0.15);
    expect(targets[0].targetNotional).toBe(1500);
  });
});
