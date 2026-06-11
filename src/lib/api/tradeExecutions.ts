import { apiClient } from './client';

export type FailureCategory =
  | 'MIN_NOTIONAL' | 'INSUFFICIENT_BALANCE' | 'QUANTITY_PRECISION'
  | 'NO_FILL_TIMEOUT' | 'EXCHANGE_API_ERROR' | 'OTHER';

export type ExecutionStatusFilter = 'FAILED' | 'SUCCESS' | 'ALL';

export interface ExecutionEvent {
  id: string;
  executionType: 'OPEN' | 'CLOSE';
  side: 'LONG' | 'SHORT' | null;
  status: 'SUCCESS' | 'FAILED';
  accountId: string | null;
  username: string | null;
  asset: string | null;
  strategyName: string | null;
  executionReason: string | null;
  errorMessage: string | null;
  tradeId: string | null;
  executedAt: string;
  failureCategory: FailureCategory | null;
}

export interface ExecutionsPage {
  content: ExecutionEvent[];
  page: number;
  size: number;
  total: number;
}

export interface ExecutionCategoryCount {
  category: FailureCategory;
  count: number;
  pct: number;
}

export interface ExecutionSummary {
  totalExecutions: number;
  failedCount: number;
  successCount: number;
  successRatePct: number;
  topCategory: FailureCategory | null;
  byCategory: ExecutionCategoryCount[];
}

export interface ExecutionFilters {
  status?: ExecutionStatusFilter;
  symbol?: string;
  strategyName?: string;
  executionType?: 'OPEN' | 'CLOSE' | 'ALL';
  failureCategory?: FailureCategory | null;
  from?: string;
  to?: string;
  accountId?: string;
  page?: number;
  size?: number;
}

function buildParams(f: ExecutionFilters): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (f.status && f.status !== 'ALL') p.status = f.status;
  if (f.symbol) p.symbol = f.symbol.toUpperCase();
  if (f.strategyName) p.strategyName = f.strategyName;
  if (f.executionType && f.executionType !== 'ALL') p.executionType = f.executionType;
  if (f.failureCategory) p.failureCategory = f.failureCategory;
  if (f.from) p.from = f.from;
  if (f.to) p.to = f.to;
  if (f.accountId) p.accountId = f.accountId;
  if (f.page != null) p.page = f.page;
  if (f.size != null) p.size = f.size;
  return p;
}

interface BackendExecutionsPage {
  content: ExecutionEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function getExecutions(f: ExecutionFilters = {}): Promise<ExecutionsPage> {
  const { data } = await apiClient.get<BackendExecutionsPage>('/api/v1/trade-executions', {
    params: buildParams(f),
  });
  return {
    content: data?.content ?? [],
    page: data?.page ?? f.page ?? 0,
    size: data?.size ?? f.size ?? 20,
    total: data?.totalElements ?? 0,
  };
}

export async function getExecutionSummary(
  f: Omit<ExecutionFilters, 'status' | 'failureCategory' | 'page' | 'size'> = {},
): Promise<ExecutionSummary> {
  const { data } = await apiClient.get<ExecutionSummary>('/api/v1/trade-executions/summary', {
    params: buildParams(f),
  });
  return {
    totalExecutions: data?.totalExecutions ?? 0,
    failedCount: data?.failedCount ?? 0,
    successCount: data?.successCount ?? 0,
    successRatePct: data?.successRatePct ?? 0,
    topCategory: data?.topCategory ?? null,
    byCategory: data?.byCategory ?? [],
  };
}
