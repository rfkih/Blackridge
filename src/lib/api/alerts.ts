// Phase 7 alert-inbox API. Backed by GET /api/v1/alerts on the trading
// JVM — admin-only, surfaces operational alerts (kill-switch trips,
// ingest stalls, P&L deviation, verdict drift, etc.). Distinct from the
// composed NotificationPanel feed, which mixes user-visible signals
// without admin authority.
import { apiClient } from './client';

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

export interface AlertEventPage {
  content: AlertEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ListAlertsParams {
  severity?: AlertSeverity;
  kind?: string;
  /** ISO datetime (no zone). Returns rows with createdAt >= since. */
  since?: string;
  includeSuppressed?: boolean;
  page?: number;
  size?: number;
}

export async function listAlerts(opts: ListAlertsParams = {}): Promise<AlertEventPage> {
  const params: Record<string, string | number | boolean> = {
    page: opts.page ?? 0,
    size: opts.size ?? 50,
    includeSuppressed: opts.includeSuppressed ?? true,
  };
  if (opts.severity) params.severity = opts.severity;
  if (opts.kind) params.kind = opts.kind;
  if (opts.since) params.since = opts.since;
  const { data } = await apiClient.get<AlertEventPage>('/api/v1/alerts', { params });
  return data;
}

export interface UnreadCount {
  count: number;
  /** Echoes the cutoff the backend used (defaults to last 24h). */
  since: string;
}

export async function getUnreadAlertCount(opts: {
  since?: string;
  minSeverity?: AlertSeverity;
} = {}): Promise<UnreadCount> {
  const params: Record<string, string> = {};
  if (opts.since) params.since = opts.since;
  if (opts.minSeverity) params.minSeverity = opts.minSeverity;
  const { data } = await apiClient.get<UnreadCount>('/api/v1/alerts/unread-count', { params });
  return data;
}
