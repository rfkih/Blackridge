import { apiClient } from './client';
import type { EquityPoint } from '@/types/market';

interface BackendEquityPoint {
  time?: number | string | null;
  ts?: number | string | null;
  equity?: number | string | null;
  drawdown?: number | string | null;
  drawdownPct?: number | string | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMs(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isFinite(n)) return n > 32_503_680_000 ? n : n * 1_000;
  const parsed = Date.parse(String(v));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchEquityPoints(
  accountId: string,
  from: number,
  to: number,
): Promise<EquityPoint[]> {
  const { data } = await apiClient.get<BackendEquityPoint[]>('/api/v1/pnl/equity', {
    params: { accountId, from, to },
  });
  // Accept either `time` or `ts` (the backtest endpoint uses the latter) and
  // coerce numeric strings through toMs/num so the chart never receives NaN.
  return (data ?? [])
    .map((p) => ({
      time: toMs(p.time ?? p.ts) ?? 0,
      equity: num(p.equity),
      drawdown: num(p.drawdown ?? p.drawdownPct),
    }))
    .filter((p) => p.time > 0);
}
