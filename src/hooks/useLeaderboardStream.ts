'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';

/**
 * Subscribes to the STOMP topic `/topic/leaderboard` and invalidates the
 * leaderboard query whenever the Trading JVM signals an approval change
 * (create / attach-evidence / revoke). The frame body is a cache-bust signal
 * only — any message means "refetch the ranked top-strategies list".
 *
 * Matches the `['leaderboard', 'top-strategies']` key prefix from
 * `useTopStrategies`, so every cached limit (5/10/25) is marked stale; only
 * the currently-mounted limit actually refetches.
 *
 * @param enabled - Set to `false` to skip subscribing. Defaults to true.
 */
export function useLeaderboardStream(enabled = true): void {
  const connected = useWsStore((s) => s.connected);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !connected) return;

    return subscribeToTopic('/topic/leaderboard', () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard', 'top-strategies'] });
    });
  }, [enabled, connected, queryClient]);
}
