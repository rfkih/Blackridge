'use client';

import { useQuery } from '@tanstack/react-query';
import { getServerIp } from '@/lib/api/server';
import { useAuthStore } from '@/store/authStore';

/**
 * Fetches the backend's current public IP. Used in the broker-management
 * surfaces (Rotate keys, New account, Settings → Brokers) so users know
 * which IP to whitelist on Binance's API key restrictions.
 *
 * <p>Cached for a minute — the server IP doesn't change often and asking
 * every render burns the ipify rate limit for nothing.
 */
export function useServerIp() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<string>({
    queryKey: ['system', 'server-ip'],
    queryFn: getServerIp,
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 1,
  });
}
