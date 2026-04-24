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
