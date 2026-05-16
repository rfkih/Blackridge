
import { apiClient } from './client';
import { addOptionalParam, buildPageParams } from './queryParams';
import type { PageEnvelope } from '@/types/api';

export type SupportMessageStatus = 'NEW' | 'READ' | 'RESOLVED';

export interface SupportMessage {
  supportMessageId: string;
  fromUserId: string;
  fromEmail: string;
  subject: string;
  body: string;
  diagnostic?: string | null;
  status: SupportMessageStatus;
  createdAt: string;
  readAt?: string | null;
}

export interface SupportMessagePage extends PageEnvelope<SupportMessage> {
  /** Live count of NEW messages — drives the inbox badge. */
  unreadCount: number;
}

export interface SubmitSupportMessagePayload {
  subject: string;
  body: string;
  diagnostic?: string;
}

export async function submitSupportMessage(
  payload: SubmitSupportMessagePayload,
): Promise<{ supportMessageId: string; createdAt: string; message: string }> {
  const { data } = await apiClient.post<{
    supportMessageId: string;
    createdAt: string;
    message: string;
  }>('/api/v1/support', payload);
  return data;
}

export async function listSupportMessages(
  page = 0,
  size = 25,
  status?: SupportMessageStatus,
): Promise<SupportMessagePage> {
  const params: Record<string, string | number> = buildPageParams({ page, size }, 25);
  addOptionalParam(params, 'status', status);
  const { data } = await apiClient.get<SupportMessagePage>('/api/v1/support', { params });
  return data;
}

export async function updateSupportMessageStatus(
  id: string,
  status: SupportMessageStatus,
): Promise<SupportMessage> {
  const { data } = await apiClient.patch<SupportMessage>(`/api/v1/support/${id}`, { status });
  return data;
}
