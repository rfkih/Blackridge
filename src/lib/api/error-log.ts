// Phase B/C error inbox API. Backed by GET /api/v1/error-log on the
// trading JVM — admin-only, surfaces fingerprint-deduped error_log rows
// captured by DbErrorAppender (backend) and ErrorIngestController
// (frontend/middleware). Distinct from /api/v1/alerts which is the
// operational alert dispatcher.
import { apiClient } from './client';

export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ErrorStatus =
  | 'NEW'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'IGNORED'
  | 'WONT_FIX';

export interface ErrorLogRow {
  errorId: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  jvm: string;
  loggerName: string;
  threadName: string | null;
  level: string;
  message: string;
  exceptionClass: string | null;
  fingerprint: string;
  occurrenceCount: number;
  /** ISO LocalDateTime, no zone. */
  occurredAt: string | null;
  lastSeenAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ErrorLogDetail extends ErrorLogRow {
  stackTrace: string | null;
  mdc: unknown;
  notifiedAt: string | null;
  notificationChannels: string[] | null;
  developerFindingId: string | null;
}

export interface ErrorLogPage {
  content: ErrorLogRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ListErrorLogParams {
  severity?: ErrorSeverity;
  status?: ErrorStatus;
  jvm?: string;
  /** ISO datetime (no zone). Returns rows with lastSeenAt >= since. */
  since?: string;
  page?: number;
  size?: number;
}

export async function listErrorLog(
  opts: ListErrorLogParams = {},
): Promise<ErrorLogPage> {
  const params: Record<string, string | number> = {
    page: opts.page ?? 0,
    size: opts.size ?? 50,
  };
  if (opts.severity) params.severity = opts.severity;
  if (opts.status) params.status = opts.status;
  if (opts.jvm) params.jvm = opts.jvm;
  if (opts.since) params.since = opts.since;
  const { data } = await apiClient.get<ErrorLogPage>('/api/v1/error-log', {
    params,
  });
  return data;
}

export async function getErrorLogRow(id: string): Promise<ErrorLogDetail> {
  const { data } = await apiClient.get<ErrorLogDetail>(
    `/api/v1/error-log/${id}`,
  );
  return data;
}

export interface OpenErrorCount {
  count: number;
}

export async function getOpenErrorCount(opts: {
  minSeverity?: ErrorSeverity;
} = {}): Promise<OpenErrorCount> {
  const params: Record<string, string> = {};
  if (opts.minSeverity) params.minSeverity = opts.minSeverity;
  const { data } = await apiClient.get<OpenErrorCount>(
    '/api/v1/error-log/open-count',
    { params },
  );
  return data;
}

export interface UpdateStatusResult {
  errorId: string;
  status: ErrorStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export async function updateErrorStatus(
  id: string,
  status: ErrorStatus,
): Promise<UpdateStatusResult> {
  const { data } = await apiClient.patch<UpdateStatusResult>(
    `/api/v1/error-log/${id}/status`,
    { status },
  );
  return data;
}
