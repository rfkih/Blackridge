import type {
  AssetAllocationTarget,
  AssetRebalancePlan,
  AssetRebalancePolicy,
  UpdateAssetPolicyRequest,
  UpsertAssetTargetsRequest,
} from '@/types/assetAllocation';
import { apiClient } from './client';
import { toNum } from './coerce';

// The apiClient response interceptor unwraps the ResponseDto envelope
// (responseCode + data) before returning, so `data` is the inner payload.

function mapTarget(raw: any): AssetAllocationTarget {
  return {
    id: raw.id ?? null,
    accountId: raw.accountId,
    asset: raw.asset,
    targetPct: toNum(raw.targetPct, 0),
    minBandPp: toNum(raw.minBandPp, 5),
    updatedTime: raw.updatedTime ?? null,
  };
}

function mapPolicy(raw: any): AssetRebalancePolicy {
  return {
    id: raw.id ?? null,
    accountId: raw.accountId,
    calendarMinDays: toNum(raw.calendarMinDays, 7),
    slippageBpsAssumed: toNum(raw.slippageBpsAssumed, 10),
    feeBpsAssumed: toNum(raw.feeBpsAssumed, 4),
    usdtReserveFloorPct: toNum(raw.usdtReserveFloorPct, 20),
    requireManualApproval: Boolean(raw.requireManualApproval),
    enabled: Boolean(raw.enabled),
    persisted: Boolean(raw.persisted),
    updatedTime: raw.updatedTime ?? null,
  };
}

function mapPlan(raw: any): AssetRebalancePlan {
  return {
    rebalanceId: raw.rebalanceId ?? null,
    accountId: raw.accountId,
    method: raw.method,
    status: raw.status,
    portfolioValueUsdt: raw.portfolioValueUsdt == null ? null : toNum(raw.portfolioValueUsdt),
    estimatedCostUsdt: raw.estimatedCostUsdt == null ? null : toNum(raw.estimatedCostUsdt),
    estimatedBenefitUsdt: raw.estimatedBenefitUsdt == null ? null : toNum(raw.estimatedBenefitUsdt),
    skipReason: raw.skipReason ?? null,
    driftItems: (raw.driftItems ?? []).map((d: any) => ({
      asset: d.asset,
      currentUsdtValue: toNum(d.currentUsdtValue, 0),
      currentPct: toNum(d.currentPct, 0),
      targetPct: toNum(d.targetPct, 0),
      minBandPp: toNum(d.minBandPp, 0),
      driftPp: toNum(d.driftPp, 0),
      withinBand: Boolean(d.withinBand),
    })),
    tradePlan: (raw.tradePlan ?? []).map((l: any) => ({
      action: l.action,
      asset: l.asset,
      quoteAsset: l.quoteAsset,
      estQuoteQtyUsdt: toNum(l.estQuoteQtyUsdt, 0),
      estBaseQty: l.estBaseQty == null ? null : toNum(l.estBaseQty),
      referencePrice: l.referencePrice == null ? null : toNum(l.referencePrice),
      reason: l.reason,
    })),
    generatedAt: raw.generatedAt,
    lastRebalanceAt: raw.lastRebalanceAt ?? null,
  };
}

export async function fetchAssetTargets(accountId: string): Promise<AssetAllocationTarget[]> {
  const { data } = await apiClient.get<any[]>(`/api/v1/portfolio/assets/targets`, {
    params: { accountId },
  });
  return (data ?? []).map(mapTarget);
}

export async function upsertAssetTargets(
  payload: UpsertAssetTargetsRequest,
): Promise<AssetAllocationTarget[]> {
  const { data } = await apiClient.put<any[]>(`/api/v1/portfolio/assets/targets`, payload);
  return (data ?? []).map(mapTarget);
}

export async function fetchAssetPolicy(accountId: string): Promise<AssetRebalancePolicy> {
  const { data } = await apiClient.get<any>(`/api/v1/portfolio/assets/policy`, {
    params: { accountId },
  });
  return mapPolicy(data);
}

export async function updateAssetPolicy(
  payload: UpdateAssetPolicyRequest,
): Promise<AssetRebalancePolicy> {
  const { data } = await apiClient.patch<any>(`/api/v1/portfolio/assets/policy`, payload);
  return mapPolicy(data);
}

export async function computeAssetRebalancePlan(
  accountId: string,
  persist: boolean,
): Promise<AssetRebalancePlan> {
  const { data } = await apiClient.post<any>(
    `/api/v1/portfolio/assets/rebalance/plan`,
    null,
    { params: { accountId, persist } },
  );
  return mapPlan(data);
}
