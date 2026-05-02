// Phase 1 decoupling: historical-backfill is a heavy I/O operation that
// belongs on the research JVM (8081), away from live trading.
import { researchClient as apiClient } from './client';

export interface WarmupResult {
  symbol: string;
  interval: string;
  message: string;
}

export interface IndicatorBackfillResult {
  symbol: string;
  interval: string;
  from: string;
  to: string;
  /**
   * Whether the request asked for a full recompute (delete-then-insert)
   * rather than the default missing-only fill. Echoed by the backend so
   * the UI can confirm what mode actually ran.
   */
  recompute?: boolean;
  recordsUpdated: number;
}

/** @deprecated Backwards-compat alias — prefer {@link IndicatorBackfillResult}. */
export type VcbBackfillResult = IndicatorBackfillResult;

export async function backfillHistoricalData(
  symbol: string,
  interval: string,
): Promise<WarmupResult> {
  const { data } = await apiClient.post<WarmupResult>('/api/v1/historical/backfill', null, {
    params: { symbol, interval },
  });
  return data;
}

export interface IndicatorBackfillRequest {
  symbol: string;
  interval: string;
  /** ISO LocalDateTime, e.g. `2024-01-15T10:30:00` (no trailing Z). */
  from: string;
  to: string;
  /**
   * When true, delete all FeatureStore rows in the range first, then
   * recompute. Use when indicator code or params changed and existing
   * rows are stale. Default: false (only fill missing rows).
   */
  recompute?: boolean;
}

/**
 * General feature-store backfill across a date range. Recomputes the same
 * indicator columns the live ingestion path produces (Bollinger Bands,
 * Keltner Channels, ATR ratio, signed ER, EMAs, RSI, MACD, ADX, Donchian, …)
 * — works for every strategy, not just VCB.
 *
 * <p>Spring's default {@code LocalDateTime} format is ISO without the
 * trailing {@code Z} — the native {@code <input type="datetime-local">}
 * value is already the right shape.
 */
export async function backfillIndicators(
  req: IndicatorBackfillRequest,
): Promise<IndicatorBackfillResult> {
  const { data } = await apiClient.post<IndicatorBackfillResult>(
    '/api/v1/historical/backfill-features',
    null,
    { params: req },
  );
  return data;
}

/** @deprecated Backwards-compat alias — prefer {@link backfillIndicators}. */
export async function backfillVcbIndicators(
  symbol: string,
  interval: string,
  from: string,
  to: string,
): Promise<IndicatorBackfillResult> {
  return backfillIndicators({ symbol, interval, from, to });
}
