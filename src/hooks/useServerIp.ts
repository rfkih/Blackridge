'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getServerIp,
  getServerIpStatus,
  getWsStatus,
  type ServerIpStatus,
  type WsStatus,
} from '@/lib/api/server';
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

/**
 * Polls the IP_MONITOR snapshot so the dashboard banner can warn the user
 * to update their Binance whitelist when the server's outbound IP changes.
 * Reads from the persisted log on the backend, so polling is cheap.
 */
export function useServerIpStatus() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ServerIpStatus>({
    queryKey: ['system', 'server-ip-status'],
    queryFn: getServerIpStatus,
    enabled: Boolean(userId),
    staleTime: 55_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

/**
 * Polls the live Binance WebSocket heartbeat for the admin /research tile.
 * 10s cadence — fast enough to catch a feed outage well before the backend's
 * 30s watchdog logs it, slow enough that an idle dashboard tab does not
 * hammer the trading JVM.
 */
export function useWsStatus() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<WsStatus>({
    queryKey: ['system', 'ws-status'],
    queryFn: getWsStatus,
    enabled: Boolean(userId),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
