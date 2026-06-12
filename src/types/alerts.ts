import type { PageEnvelope } from './api';

/** Operational alert severity — `INFO`/`WARN` route to the inbox; `CRITICAL` also pages on-call. */
export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface AlertEvent {
  alertEventId: string;
  severity: AlertSeverity;
  kind: string;
  message: string;
  /** Free-form JSON; null when no context attached. */
  context: unknown;
  dedupeKey: string | null;
  suppressed: boolean;
  sentTelegram: boolean | null;
  sentEmail: boolean | null;
  /** ISO LocalDateTime, no zone. */
  createdAt: string | null;
}

export type AlertEventPage = PageEnvelope<AlertEvent>;

export interface ListAlertsParams {
  severity?: AlertSeverity;
  kind?: string;
  /** ISO datetime (no zone). Returns rows with createdAt >= since. */
  since?: string;
  includeSuppressed?: boolean;
  /** Free-text ILIKE across message and kind. */
  search?: string;
  /** Spring sort string — "createdAt,desc" / "severity,desc" / "createdAt,asc". */
  sort?: string;
  page?: number;
  size?: number;
}
