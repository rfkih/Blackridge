import { apiClient } from './client';
import { buildPageParams } from './queryParams';
import type { PageEnvelope } from '@/types/api';
import type { TradeExecutionEvent } from '@/types/trading';

export type { TradeExecutionEvent } from '@/types/trading';

export type TradeExecutionPage = PageEnvelope<TradeExecutionEvent>;

export interface ListTradeExecutionsParams {
  page?: number;
  size?: number;
}

/**
 * Per-user trade-execution feed — every real execution outcome (OPEN/CLOSE ×
 * SUCCESS/FAILED) for the caller's own accounts, newest first. Scoped by the
 * JWT server-side; paper (DIVERTED) rows never appear.
 */
export async function listTradeExecutions(
  opts: ListTradeExecutionsParams = {},
): Promise<TradeExecutionPage> {
  const params = buildPageParams(opts, 10);
  const { data } = await apiClient.get<TradeExecutionPage>('/api/v1/trade-executions', {
    params,
  });
  return data;
}
