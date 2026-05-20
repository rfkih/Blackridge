import { apiClient } from './client';
import type {
  PortfolioWeightsResponse,
  RebalanceRequest,
  RebalanceResponse,
} from '@/types/portfolioRebalance';

/**
 * Portfolio rebalance surface (V109, Phase A — scorecard #10).
 *
 * <p>Routes are served by the research orchestrator on 127.0.0.1:8082;
 * the trading JVM proxy at {@code /api/v1/research-orch/**} forwards the
 * request and injects the shared-secret token server-side so the
 * browser never sees it. Same proxy plumbing as {@code orchestrator.ts}.
 *
 * <p>Reads ({@link listPortfolioWeights}) are cheap GETs that just
 * SELECT the current state. Mutations ({@link rebalancePortfolio})
 * write to {@code account_strategy.portfolio_weight} and journal a
 * {@code CROSS_STRATEGY_FINDING} row -- pass {@code dry_run: true} for
 * a forensic-only preview that doesn't UPDATE anything but does write
 * a {@code [DRY-RUN]} journal entry for auditability.
 */
const BASE = '/api/v1/research-orch';

/**
 * Fetch current portfolio_weight per live AccountStrategy row.
 *
 * <p>{@code accountId} is optional on the read path: pass it for the
 * per-user view, omit it for the admin "view all accounts" surface. The
 * write path ({@link rebalancePortfolio}) always requires it.
 */
export async function listPortfolioWeights(
  accountId?: string,
): Promise<PortfolioWeightsResponse> {
  const { data } = await apiClient.get<PortfolioWeightsResponse>(`${BASE}/portfolio/weights`, {
    params: accountId ? { account_id: accountId } : undefined,
  });
  return data;
}

export async function rebalancePortfolio(
  request: RebalanceRequest,
  idempotencyKey: string,
): Promise<RebalanceResponse> {
  const { data } = await apiClient.post<RebalanceResponse>(`${BASE}/portfolio/rebalance`, request, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}
