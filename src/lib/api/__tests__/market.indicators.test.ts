import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import { fetchIndicatorsRange } from '../market';

vi.mock('../client', () => ({
  apiClient: { get: vi.fn() },
  researchClient: { get: vi.fn() },
  normalizeError: vi.fn(),
  consumeSessionExpiredFlag: vi.fn(),
}));

describe('fetchIndicatorsRange', () => {
  beforeEach(() => vi.clearAllMocks());
  it('calls the indicators endpoint with the explicit from/to window (ms)', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [
      { time: 1704067200, ema20: 100, rsi: 55 },
    ]});
    const out = await fetchIndicatorsRange('BTCUSDT', '1d', 1704067200000, 1717804800000);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/market/indicators', {
      params: { symbol: 'BTCUSDT', interval: '1d', from: 1704067200000, to: 1717804800000 },
    });
    expect(out[0]).toMatchObject({ time: 1704067200, ema20: 100, rsi: 55, ema50: null });
  });
});
