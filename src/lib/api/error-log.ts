// Error-inbox API. Backed by GET /api/v1/error-log on the trading JVM —
// admin-only, surfaces fingerprint-deduped error_log rows captured by
// DbErrorAppender (backend) and ErrorIngestController (frontend/middleware).
// Distinct from /api/v1/alerts which is the operational alert dispatcher.
import { apiClient } from './client';
import { addOptionalParam, buildPageParams } from './queryParams';
import type {
  ErrorLogDetail,
  ErrorLogPage,
  ErrorStatus,
  ListErrorLogParams,
  UpdateStatusResult,
} from '@/types/errors';

// Re-exported from canonical home `@/types/errors`; prefer direct import in new code.
export type { ErrorLogRow, ErrorSeverity, ErrorStatus } from '@/types/errors';

export async function listErrorLog(opts: ListErrorLogParams = {}): Promise<ErrorLogPage> {
  const params: Record<string, string | number | boolean> = buildPageParams(opts, 50);
  addOptionalParam(params, 'severity', opts.severity);
  addOptionalParam(params, 'status', opts.status);
  addOptionalParam(params, 'jvm', opts.jvm);
  addOptionalParam(params, 'since', opts.since);
  addOptionalParam(params, 'search', opts.search);
  addOptionalParam(params, 'sort', opts.sort);
  const { data } = await apiClient.get<ErrorLogPage>('/api/v1/error-log', {
    params,
  });
  return data;
}

export async function getErrorLogRow(id: string): Promise<ErrorLogDetail> {
  const { data } = await apiClient.get<ErrorLogDetail>(`/api/v1/error-log/${id}`);
  return data;
}

export async function updateErrorStatus(
  id: string,
  status: ErrorStatus,
): Promise<UpdateStatusResult> {
  const { data } = await apiClient.patch<UpdateStatusResult>(`/api/v1/error-log/${id}/status`, {
    status,
  });
  return data;
}
