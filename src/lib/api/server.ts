import { apiClient } from './client';

/** Returns the current public IP of the backend — used in the Settings
 *  Brokers view so users know which IP to whitelist on Binance. */
export async function getServerIp(): Promise<string> {
  const { data } = await apiClient.get<string>('/api/v1/server/ip');
  // Backend echoes the raw IP as the `data` field of the envelope. Axios
  // interceptor has already unwrapped the envelope, so `data` is the string.
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
