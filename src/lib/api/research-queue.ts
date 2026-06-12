import { researchClient } from './client';
import type {
  CreateQueueItemRequest,
  ResearchQueueItem,
  UpdateQueueItemRequest,
} from '@/types/research-queue';

const BASE = '/api/v1/research/queue';

export async function listQueue(params?: {
  strategyCode?: string;
  status?: string[];
}): Promise<ResearchQueueItem[]> {
  const { data } = await researchClient.get<ResearchQueueItem[]>(BASE, {
    params: {
      strategyCode: params?.strategyCode || undefined,

      status: params?.status && params.status.length > 0 ? params.status : undefined,
    },
  });
  return data;
}

export async function createQueueItem(payload: CreateQueueItemRequest): Promise<ResearchQueueItem> {
  const { data } = await researchClient.post<ResearchQueueItem>(`${BASE}/me`, payload);
  return data;
}

export async function updateQueuePriority(
  queueId: string,
  payload: UpdateQueueItemRequest,
): Promise<ResearchQueueItem> {
  const { data } = await researchClient.patch<ResearchQueueItem>(`${BASE}/${queueId}`, payload);
  return data;
}

/**
 * Soft-cancel: the backend transitions the row to COMPLETED with
 * finalVerdict=CANCELLED rather than DELETEing, so iteration_log FKs and
 * the audit trail remain intact. The orchestrator's claim filter
 * (status='PENDING') skips the row naturally on the next tick.
 */
export async function cancelQueueItem(queueId: string): Promise<ResearchQueueItem> {
  const { data } = await researchClient.delete<ResearchQueueItem>(`${BASE}/${queueId}`);
  return data;
}
