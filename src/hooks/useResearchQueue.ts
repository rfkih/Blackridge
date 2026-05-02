'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelQueueItem,
  createQueueItem,
  listQueue,
  updateQueuePriority,
} from '@/lib/api/research-queue';
import { useAuthStore } from '@/store/authStore';
import type {
  CreateQueueItemRequest,
  ResearchQueueItem,
  UpdateQueueItemRequest,
} from '@/types/research-queue';

const QUEUE_KEY = ['research', 'queue'] as const;

export function useResearchQueue(filters?: {
  strategyCode?: string;
  status?: string[];
}) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ResearchQueueItem[]>({
    queryKey: [...QUEUE_KEY, filters?.strategyCode ?? '*', filters?.status ?? []],
    queryFn: () => listQueue(filters),
    enabled: Boolean(userId),
    // 10s while running so PENDING/RUNNING transitions land quickly without
    // hammering the research JVM. The orchestrator tick is on the order of
    // tens of seconds, so faster polling buys nothing.
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useCreateQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQueueItemRequest) => createQueueItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });
}

export function useUpdateQueuePriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { queueId: string; payload: UpdateQueueItemRequest }) =>
      updateQueuePriority(vars.queueId, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });
}

export function useCancelQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queueId: string) => cancelQueueItem(queueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });
}
