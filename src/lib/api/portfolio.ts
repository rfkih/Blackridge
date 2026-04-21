import { apiClient } from './client';
import type { UUID } from '@/types/api';
import type { PortfolioAsset, PortfolioBalance } from '@/types/portfolio';

interface BackendPortfolioAsset {
  asset: string | null;
  free: number | string | null;
  locked: number | string | null;
  usdtValue: number | string | null;
}

interface BackendPortfolioBalance {
  accountId: UUID | null;
  totalUsdt: number | string | null;
  availableUsdt: number | string | null;
  lockedUsdt: number | string | null;
  assets: BackendPortfolioAsset[] | null;
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapAsset(a: BackendPortfolioAsset): PortfolioAsset {
  return {
    asset: a.asset ?? '',
    free: toNumber(a.free),
    locked: toNumber(a.locked),
    usdtValue: toNumber(a.usdtValue),
  };
}

function mapBalance(b: BackendPortfolioBalance): PortfolioBalance {
  return {
    accountId: b.accountId ?? '',
    totalUsdt: toNumber(b.totalUsdt),
    availableUsdt: toNumber(b.availableUsdt),
    lockedUsdt: toNumber(b.lockedUsdt),
    assets: (b.assets ?? []).map(mapAsset),
  };
}

export async function getPortfolioBalance(): Promise<PortfolioBalance> {
  const { data } = await apiClient.get<BackendPortfolioBalance>('/api/v1/portfolio');
  return mapBalance(data);
}
