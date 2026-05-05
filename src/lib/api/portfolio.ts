import { apiClient } from './client';
import { toNum } from './coerce';
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

function mapAsset(a: BackendPortfolioAsset): PortfolioAsset {
  return {
    asset: a.asset ?? '',
    free: toNum(a.free),
    locked: toNum(a.locked),
    usdtValue: toNum(a.usdtValue),
  };
}

function mapBalance(b: BackendPortfolioBalance): PortfolioBalance {
  return {
    accountId: b.accountId ?? '',
    totalUsdt: toNum(b.totalUsdt),
    availableUsdt: toNum(b.availableUsdt),
    lockedUsdt: toNum(b.lockedUsdt),
    assets: (b.assets ?? []).map(mapAsset),
  };
}

export async function getPortfolioBalance(accountId?: string): Promise<PortfolioBalance> {
  const { data } = await apiClient.get<BackendPortfolioBalance>('/api/v1/portfolio', {
    params: accountId ? { accountId } : undefined,
  });
  return mapBalance(data);
}
