import { apiClient } from './client';
import { toNum } from './coerce';
import type { EquityPoint } from '@/types/market';

interface BackendPnlEquityPoint {
  time?: number | string | null;
  ts?: number | string | null;
  equity?: number | string | null;
  // ``drawdown`` is a negative-or-zero PERCENT (backend percentDrop = (equity -
  // peak)/peak * 100), NOT dollars. There is no separate drawdownPct field.
  drawdown?: number | string | null;
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
  const { data } = await apiClient.get<BackendPnlEquityPoint[]>('/api/v1/pnl/equity', {
    params: { accountId, from, to },
  });

  return (data ?? [])
    .map((p) => ({
      time: toMs(p.time ?? p.ts) ?? 0,
      equity: toNum(p.equity),
      drawdown: toNum(p.drawdown),
    }))
    .filter((p) => p.time > 0);
}
