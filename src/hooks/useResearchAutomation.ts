'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getResearchAutomationStatus,
  pauseResearchAutomation,
  resumeResearchAutomation,
  type ResearchAutomationStatus,
} from '@/lib/api/researchAutomation';

const KEY = ['research-automation', 'status'] as const;

/**
 * Polls the global research-pause flag every 30s. The flag is consumed by
 * OS-cron-driven research-tick.sh on its next tick — pause takes effect at
 * the start of the next 30-min cron window, not instantly mid-tick.
 */
export function useResearchAutomationStatus() {
  return useQuery<ResearchAutomationStatus>({
    queryKey: KEY,
    queryFn: getResearchAutomationStatus,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useResearchAutomationControl() {
  const queryClient = useQueryClient();

  const onSuccess = (data: ResearchAutomationStatus) => {
    queryClient.setQueryData(KEY, data);
  };

  const pause = useMutation<ResearchAutomationStatus, Error, string | undefined>({
    mutationFn: (reason) => pauseResearchAutomation(reason),
    onSuccess,
  });

  const resume = useMutation<ResearchAutomationStatus>({
    mutationFn: resumeResearchAutomation,
    onSuccess,
  });

  return { pause, resume };
}
