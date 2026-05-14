// Domain types for the ML/sentiment ingestion control plane (V67).
//
// Mirrors:
//   - blackheart/src/main/java/id/co/blackheart/model/MlIngestSchedule.java
//   - blackheart/src/main/java/id/co/blackheart/model/MlSourceHealth.java
//
// Wire types live alongside the canonical domain shapes — Jackson serialises
// LocalDateTime as ISO-8601 with no trailing Z (server is UTC by convention),
// numeric audit cols already typed as string|null by the backend serializer
// in some edge cases. Keep both representations explicit so we don't crash on
// either.

/** Source identifier — matches Python module names + `ml_ingest_schedule.source`. */
export type MlSource =
  | 'fred'
  | 'binance_macro'
  | 'defillama'
  | 'coinmetrics'
  | 'coingecko'
  | 'alternative_me'
  | 'forexfactory';

/** Health rollup status — see MlSourceHealth.java for transition rules. */
export type MlSourceHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'disabled'
  | 'unknown';

export interface MlIngestSchedule {
  id: number;
  source: MlSource;
  /** NULL for macro-only sources (fred, alternative_me, forexfactory). */
  symbol: string | null;
  /** Spring 6-field cron (sec min hour day month dow). */
  cronExpression: string;
  /** Lookback window (hours) for live-ingest ticks. Range [1, 720]. */
  lookbackHours: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorMessage: string | null;
  nextRunAt: string | null;
  /** Source-specific JSON config (series IDs, feeds, etc.). */
  config: Record<string, unknown>;
  createdTime: string;
  createdBy: string | null;
  updatedTime: string;
  updatedBy: string | null;
}

export interface MlSourceHealth {
  source: MlSource;
  lastPullAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  /** V68: cumulative lifetime counter (renamed from rowsInserted24h). */
  rowsInsertedTotal: number;
  /** V68: cumulative lifetime counter (renamed from errors24h). */
  errorsTotal: number;
  /** V68: cumulative lifetime counter (renamed from rejectedPitViolations24h). */
  rejectedPitViolationsTotal: number;
  healthStatus: MlSourceHealthStatus;
  healthMessage: string | null;
  metrics: Record<string, unknown> | null;
  updatedAt: string;
  createdTime: string;
  createdBy: string | null;
  updatedTime: string;
  updatedBy: string | null;
}

/** PATCH body for `/api/v1/ml-ingest/schedules/{id}` — partial update. */
export interface UpdateMlScheduleRequest {
  cronExpression?: string;
  lookbackHours?: number;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/** POST body for `/api/v1/ml-ingest/backfill` — kicks off a historical backfill. */
export interface TriggerMlBackfillRequest {
  source: MlSource;
  symbol?: string | null;
  params?: Record<string, unknown>;
}

/** Convenience: source → user-facing label for cards/dropdowns. */
export const ML_SOURCE_LABELS: Record<MlSource, string> = {
  fred: 'FRED + ALFRED',
  binance_macro: 'Binance Macro',
  defillama: 'DefiLlama',
  coinmetrics: 'CoinMetrics',
  coingecko: 'CoinGecko',
  alternative_me: 'Fear & Greed (alternative.me)',
  forexfactory: 'ForexFactory Calendar',
};

/** Source description shown in tooltips on the dashboard cards. */
export const ML_SOURCE_DESCRIPTIONS: Record<MlSource, string> = {
  fred: 'Macro series: DXY, real yields, VIX, M2, CPI. ALFRED vintage for revision-prone series.',
  binance_macro: 'Public macro feeds: funding rate, open interest, top trader L/S, taker volume.',
  defillama: 'Stablecoin supply (USDT+USDC) + chain TVL.',
  coinmetrics: 'Community-tier on-chain metrics: exchange netflow, active addresses, realized cap.',
  coingecko: 'Free-tier global market caps + BTC dominance.',
  alternative_me: 'Fear & Greed Index daily history.',
  forexfactory: 'Economic calendar scrape: FOMC, CPI, NFP, Unemployment.',
};
