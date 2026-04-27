// Audit-event read API. The caller only ever sees their own events —
// no admin-wide endpoint exposed (yet). Page/size based pagination
// matches the Spring Data shape on the wire.
import { apiClient } from './client';

export interface AuditEvent {
  auditEventId: string;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  /** ISO LocalDateTime, no zone — display via formatDate(new Date(s).getTime()). */
  createdAt: string | null;
}

export interface AuditEventPage {
  content: AuditEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function listMyAuditEvents(page = 0, size = 25): Promise<AuditEventPage> {
  const { data } = await apiClient.get<AuditEventPage>('/api/v1/audit-events', {
    params: { page, size },
  });
  return data;
}
