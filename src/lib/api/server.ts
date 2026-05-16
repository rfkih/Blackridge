import { apiClient } from './client';

/** Returns the current public IP of the backend — used in the Settings
 *  Brokers view so users know which IP to whitelist on Binance. */
export async function getServerIp(): Promise<string> {
  const { data } = await apiClient.get<string>('/api/v1/server/ip');

  if (typeof data !== 'string' || !data.trim()) {
    throw new Error('Server IP not available');
  }
  return data.trim();
}

export interface ServerIpStatus {
  currentIp: string | null;
  previousIp: string | null;
  /** "INIT" on first observation, "CHANGED" when the IP differs from prior. */
  event: 'INIT' | 'CHANGED' | string | null;
  /** ISO timestamp from the IP_MONITOR scheduler. */
  recordedAt: string | null;
}

interface BackendServerIpStatus {
  currentIp?: string | null;
  previousIp?: string | null;
  event?: string | null;
  recordedAt?: string | null;
}

/** Latest IP-monitor snapshot. Empty object means no log row yet — fresh
 *  install or DB wipe; treat as "no warning to show". */
export async function getServerIpStatus(): Promise<ServerIpStatus> {
  const { data } = await apiClient.get<BackendServerIpStatus>('/api/v1/server/ip/status');
  return {
    currentIp: data?.currentIp ?? null,
    previousIp: data?.previousIp ?? null,
    event: data?.event ?? null,
    recordedAt: data?.recordedAt ?? null,
  };
}

export interface WsStatus {
  running: boolean;
  symbol: string | null;
  intervals: string[];
  lastMessageAt: string | null;
  ageMs: number;
  stale: boolean;
}

interface BackendWsStatus {
  running?: boolean | null;
  symbol?: string | null;
  intervals?: string[] | null;
  lastMessageAt?: string | null;
  ageMs?: number | null;
  stale?: boolean | null;
}

/**
 * Binance WebSocket heartbeat. Trading-JVM-only endpoint — research JVM does
 * not hold the WS client. `ageMs` is the wall-clock gap between the last
 * received frame and the request; `stale=true` once it exceeds the backend's
 * 30 s watchdog threshold.
 */
export async function getWsStatus(): Promise<WsStatus> {
  const { data } = await apiClient.get<BackendWsStatus>('/api/v1/server/ws-status');
  return {
    running: Boolean(data?.running),
    symbol: data?.symbol ?? null,
    intervals: Array.isArray(data?.intervals) ? data!.intervals! : [],
    lastMessageAt: data?.lastMessageAt ?? null,
    ageMs: typeof data?.ageMs === 'number' ? data.ageMs : 0,
    stale: Boolean(data?.stale),
  };
}
