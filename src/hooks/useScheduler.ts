'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSchedulers,
  runSchedulerOnce,
  updateScheduler,
  type SchedulerJobStatus,
  type SchedulerUpdateInput,
} from '@/lib/api/scheduler';

/**
 * Polls /api/v1/scheduler every 30s for the dashboard Scheduler panel.
 * Pauses while the tab is hidden and keeps the previous payload visible
 * during the next fetch so the panel doesn't flicker empty between ticks.
 */
export function useSchedulerStatus() {
  return useQuery<SchedulerJobStatus[]>({
    queryKey: ['scheduler', 'status'],
    queryFn: listSchedulers,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateScheduler() {
  const qc = useQueryClient();
  return useMutation<SchedulerJobStatus, Error, { id: number; patch: SchedulerUpdateInput }>({
    mutationFn: ({ id, patch }) => updateScheduler(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduler', 'status'] });
    },
  });
}

export function useRunSchedulerOnce() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => runSchedulerOnce(id),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['scheduler', 'status'] }), 2_000);
    },
  });
}
