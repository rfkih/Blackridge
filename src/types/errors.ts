import type { PageEnvelope } from './api';

/** Logged-error severity — distinct from {@link AlertSeverity}; finer-grained. */
export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Lifecycle of a deduped error row. NEW rows reopen on each occurrence. */
export type ErrorStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED' | 'WONT_FIX';

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

export type ErrorLogPage = PageEnvelope<ErrorLogRow>;

export interface ListErrorLogParams {
  severity?: ErrorSeverity;
  status?: ErrorStatus;
  jvm?: string;
  /** ISO datetime (no zone). Returns rows with lastSeenAt >= since. */
  since?: string;
  /** Free-text ILIKE across message, loggerName, exceptionClass. */
  search?: string;
  /** Spring sort string — "lastSeenAt,desc" / "occurrenceCount,desc" / "occurredAt,asc" etc. */
  sort?: string;
  page?: number;
  size?: number;
}

export interface UpdateStatusResult {
  errorId: string;
  status: ErrorStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
}
