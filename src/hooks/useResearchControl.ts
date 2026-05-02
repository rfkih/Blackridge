'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  restartResearch,
  startResearch,
  stopResearch,
  type ResearchLaunchResult,
} from '@/lib/api/researchControl';

/**
 * Mutations driving the research-JVM lifecycle from the /research dashboard.
 * After every action we invalidate the actuator health + telemetry queries
 * for the research JVM so the ServiceHealth panel reflects the new state on
 * the next render rather than waiting up to 30s for the next health poll.
 *
 * The trading JVM is the supervisor — these calls go to apiClient (8080),
 * never researchClient. Backend admin-only.
 */
export function useResearchControl() {
  const queryClient = useQueryClient();

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['actuator', 'health', 'research'] });
    queryClient.invalidateQueries({ queryKey: ['actuator', 'telemetry', 'research'] });
  };

  const start = useMutation<ResearchLaunchResult>({
    mutationFn: startResearch,
    onSuccess,
  });

  const stop = useMutation<ResearchLaunchResult>({
    mutationFn: stopResearch,
    onSuccess,
  });

  const restart = useMutation<ResearchLaunchResult>({
    mutationFn: restartResearch,
    onSuccess,
  });

  return { start, stop, restart };
}
