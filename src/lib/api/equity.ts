import { apiClient } from './client';
import type { EquityPoint } from '@/types/market';

export async function fetchEquityPoints(
  accountId: string,
  from: number,
  to: number,
): Promise<EquityPoint[]> {
  const { data } = await apiClient.get<EquityPoint[]>('/api/v1/pnl/equity', {
    params: { accountId, from, to },
  });
  return data;
}
