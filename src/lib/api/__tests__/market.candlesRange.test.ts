import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import { fetchCandlesRange } from '../market';

vi.mock('../client', () => ({
  apiClient: { get: vi.fn() },
  researchClient: { get: vi.fn() },
  normalizeError: vi.fn(),
  consumeSessionExpiredFlag: vi.fn(),
}));

describe('fetchCandlesRange', () => {
  beforeEach(() => vi.clearAllMocks());
  it('calls the market endpoint with the explicit from/to window (ms) and maps a row', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [
      { time: 1704067200, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    ]});
    const out = await fetchCandlesRange('BTCUSDT', '1d', 1704067200000, 1717804800000);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/market', {
      params: { symbol: 'BTCUSDT', interval: '1d', from: 1704067200000, to: 1717804800000 },
    });
    expect(out[0]).toMatchObject({ time: 1704067200, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
  });

  // Regression: computeWindow pads with span*0.15 (fractional ms). The backend
  // rejects non-integer timestamps ("Unsupported date format: …503.2", 400),
  // which broke the 15m trades chart. The range fetch must floor/ceil to ints.
  it('coerces fractional epoch-ms to integers (floor from, ceil to)', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await fetchCandlesRange('ETHUSDT', '15m', 1779559920503.2, 1779646320755.8);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/market', {
      params: { symbol: 'ETHUSDT', interval: '15m', from: 1779559920503, to: 1779646320756 },
    });
  });
});
