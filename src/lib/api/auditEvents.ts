import { apiClient } from './client';
import type { PageEnvelope } from '@/types/api';

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

export type AuditEventPage = PageEnvelope<AuditEvent>;

export async function listMyAuditEvents(page = 0, size = 25): Promise<AuditEventPage> {
  const { data } = await apiClient.get<AuditEventPage>('/api/v1/audit-events', {
    params: { page, size },
  });
  return data;
}
