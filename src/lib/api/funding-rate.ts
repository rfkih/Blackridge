
import { apiClient } from './client';

export interface FundingRatePoint {
  fundingTime: string;
  fundingRate: number;
}

export interface FundingRateSummary {
  symbol: string;
  startTime: string;
  endTime: string;
  count: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  /** Mean × 3 settlements/day × 365 (in % terms — already multiplied by 100). */
  annualizedPct: number | null;
  latestRate: number | null;
  latestTime: string | null;
  recent: FundingRatePoint[];
}

export interface FundingSummaryOpts {
  symbol: string;
  /** ISO LocalDateTime — e.g. "2024-01-01T00:00:00". */
  startTime: string;
  endTime: string;
  limit?: number;
}

export async function getFundingRateSummary(
  opts: FundingSummaryOpts,
): Promise<FundingRateSummary> {
  const { data } = await apiClient.get<FundingRateSummary>(
    '/api/v1/funding-rate/summary',
    {
      params: {
        symbol: opts.symbol,
        startTime: opts.startTime,
        endTime: opts.endTime,
        limit: opts.limit ?? 200,
      },
    },
  );
  return data;
}
