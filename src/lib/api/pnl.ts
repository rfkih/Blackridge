import { apiClient } from './client';
import type { PnlSummary } from '@/types/trading';

export async function getPnlSummary(period: 'today' | 'week' | 'month'): Promise<PnlSummary> {
  const { data } = await apiClient.get<PnlSummary>('/api/v1/pnl/summary', { params: { period } });
  return data;
}
