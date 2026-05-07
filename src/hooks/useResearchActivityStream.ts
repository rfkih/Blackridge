'use client';

import { useEffect } from 'react';
import { subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';
import type { AgentActivity } from '@/types/research';

/**
 * Subscribes to the STOMP topic {@code /topic/research/activity} and calls
 * {@code onActivity} for every well-formed frame received.
 *
 * The Trading JVM forwards raw JSON strings published by the orchestrator on
 * the Redis {@code research:activity} channel — this hook parses them and
 * surfaces them to the call site.
 *
 * @param onActivity - Stable callback (wrap in `useCallback`) invoked with
 *   each parsed {@link AgentActivity}. If the reference changes every render
 *   the hook will unsubscribe and resubscribe on each cycle — always memoize.
 * @param enabled - Set to {@code false} to skip subscribing (e.g. on pages
 *   that should not receive live events). Defaults to {@code true}.
 */
export function useResearchActivityStream(
  onActivity: (activity: AgentActivity) => void,
  enabled = true,
): void {
  const connected = useWsStore((s) => s.connected);

  useEffect(() => {
    if (!enabled || !connected) return;

    const unsubscribe = subscribeToTopic('/topic/research/activity', (body) => {
      try {
        const activity = JSON.parse(body) as AgentActivity;
        onActivity(activity);
      } catch (err) {
        console.warn('[useResearchActivityStream] malformed frame dropped:', err);
      }
    });

    return unsubscribe;
  }, [enabled, connected, onActivity]);
}
