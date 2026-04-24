import { apiClient } from './client';

/**
 * Wire shape of {@code GET /api/v1/market/rates}. All values are
 * server-cached; the frontend polls on a gentle interval for freshness
 * rather than hitting on every format call.
 */
export interface CurrencyRates {
  /** USDT per one BTC (Binance mid). */
  btcUsdt: number;
  /** IDR per one USD. */
  idrUsd: number;
  /** Epoch-ms timestamp of the capture. */
  timestamp: number;
}

interface BackendRates {
  btcUsdt: number | string | null;
  idrUsd: number | string | null;
  timestamp: number | string | null;
}

export async function getCurrencyRates(): Promise<CurrencyRates> {
  const { data } = await apiClient.get<BackendRates>('/api/v1/market/rates');
  return {
    btcUsdt: toNumber(data.btcUsdt, 0),
    idrUsd: toNumber(data.idrUsd, 0),
    timestamp: toNumber(data.timestamp, Date.now()),
  };
}

function toNumber(v: number | string | null | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
