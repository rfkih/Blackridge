import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { getExecutions, getExecutionSummary } from '@/lib/api/tradeExecutions';

vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn() } }));

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

describe('tradeExecutions api', () => {
  beforeEach(() => mockGet.mockReset());

  it('maps the paginated execution envelope (totalElements → total)', async () => {
    mockGet.mockResolvedValue({
      data: {
        content: [{ id: '1', status: 'FAILED', failureCategory: 'MIN_NOTIONAL', asset: 'BTCUSDT' }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    });
    const res = await getExecutions({
      status: 'FAILED',
      from: '2026-05-01',
      to: '2026-06-01',
      page: 0,
      size: 20,
    });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/trade-executions',
      expect.objectContaining({
        params: expect.objectContaining({ status: 'FAILED', from: '2026-05-01', to: '2026-06-01' }),
      }),
    );
    expect(res.total).toBe(1);
    expect(res.content[0].failureCategory).toBe('MIN_NOTIONAL');
  });

  it('reads the summary payload', async () => {
    mockGet.mockResolvedValue({
      data: {
        totalExecutions: 20,
        failedCount: 3,
        successCount: 17,
        successRatePct: 85,
        topCategory: 'MIN_NOTIONAL',
        byCategory: [{ category: 'MIN_NOTIONAL', count: 2, pct: 66.7 }],
      },
    });
    const s = await getExecutionSummary({ from: '2026-05-01', to: '2026-06-01' });
    expect(s.failedCount).toBe(3);
    expect(s.byCategory[0].category).toBe('MIN_NOTIONAL');
  });

  it('omits failureCategory param when not set', async () => {
    mockGet.mockResolvedValue({
      data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
    });
    await getExecutions({ status: 'ALL' });
    const params = mockGet.mock.calls[0][1].params;
    expect(params).not.toHaveProperty('failureCategory');
  });
});
