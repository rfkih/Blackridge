import type {
  AssetAllocationTarget,
  AssetRebalanceHistoryView,
  AssetRebalancePlan,
  AssetRebalancePlanStatus,
  AssetRebalancePolicy,
  UpdateAssetPolicyRequest,
  UpsertAssetTargetsRequest,
} from '@/types/assetAllocation';
import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';

// The apiClient response interceptor unwraps the ResponseDto envelope
// (responseCode + data) before returning, so `data` is the inner payload.

// Private wire shapes — Jackson serializes BigDecimal as number-or-string,
// so every numeric field is widened and coerced in the mappers below.
type WireNum = number | string | null | undefined;

interface BackendAssetTarget {
  id?: string | null;
  accountId: string;
  asset: string;
  targetPct: WireNum;
  minBandPp: WireNum;
  updatedTime?: string | null;
}

interface BackendAssetPolicy {
  id?: string | null;
  accountId: string;
  calendarMinDays: WireNum;
  slippageBpsAssumed: WireNum;
  feeBpsAssumed: WireNum;
  usdtReserveFloorPct: WireNum;
  maxPerExecuteUsdt: WireNum;
  requireManualApproval?: boolean;
  enabled?: boolean;
  persisted?: boolean;
  updatedTime?: string | null;
}

interface BackendDriftItem {
  asset: string;
  currentUsdtValue: WireNum;
  currentPct: WireNum;
  targetPct: WireNum;
  minBandPp: WireNum;
  driftPp: WireNum;
  withinBand?: boolean;
}

interface BackendTradeLeg {
  action: 'BUY' | 'SELL';
  asset: string;
  quoteAsset: string;
  estQuoteQtyUsdt: WireNum;
  estBaseQty: WireNum;
  referencePrice: WireNum;
  reason: string;
}

interface BackendRebalancePlan {
  rebalanceId?: string | null;
  accountId: string;
  method: string;
  status: AssetRebalancePlanStatus;
  portfolioValueUsdt: WireNum;
  estimatedCostUsdt: WireNum;
  estimatedBenefitUsdt: WireNum;
  skipReason?: string | null;
  driftItems?: BackendDriftItem[] | null;
  tradePlan?: BackendTradeLeg[] | null;
  generatedAt: string;
  lastRebalanceAt?: string | null;
}

interface BackendRebalanceHistoryView {
  id: string;
  accountId: string;
  method: string;
  status: AssetRebalancePlanStatus;
  triggeredBy: string;
  estimatedCostUsdt: WireNum;
  estimatedBenefitUsdt: WireNum;
  proposedAt: string;
  executedAt?: string | null;
  completedAt?: string | null;
  failedReason?: string | null;
  driftSnapshot?: AssetRebalanceHistoryView['driftSnapshot'] | null;
  tradePlan?: AssetRebalanceHistoryView['tradePlan'] | null;
  executionSummary?: AssetRebalanceHistoryView['executionSummary'] | null;
}

function mapTarget(raw: BackendAssetTarget): AssetAllocationTarget {
  return {
    id: raw.id ?? null,
    accountId: raw.accountId,
    asset: raw.asset,
    targetPct: toNum(raw.targetPct, 0),
    minBandPp: toNum(raw.minBandPp, 5),
    updatedTime: raw.updatedTime ?? null,
  };
}

function mapPolicy(raw: BackendAssetPolicy): AssetRebalancePolicy {
  return {
    id: raw.id ?? null,
    accountId: raw.accountId,
    calendarMinDays: toNum(raw.calendarMinDays, 7),
    slippageBpsAssumed: toNum(raw.slippageBpsAssumed, 10),
    feeBpsAssumed: toNum(raw.feeBpsAssumed, 4),
    usdtReserveFloorPct: toNum(raw.usdtReserveFloorPct, 20),
    maxPerExecuteUsdt: toNum(raw.maxPerExecuteUsdt, 50),
    requireManualApproval: Boolean(raw.requireManualApproval),
    enabled: Boolean(raw.enabled),
    persisted: Boolean(raw.persisted),
    updatedTime: raw.updatedTime ?? null,
  };
}

function mapHistoryView(raw: BackendRebalanceHistoryView): AssetRebalanceHistoryView {
  return {
    id: raw.id,
    accountId: raw.accountId,
    method: raw.method,
    status: raw.status,
    triggeredBy: raw.triggeredBy,
    estimatedCostUsdt: toNumOrNull(raw.estimatedCostUsdt),
    estimatedBenefitUsdt: toNumOrNull(raw.estimatedBenefitUsdt),
    proposedAt: raw.proposedAt,
    executedAt: raw.executedAt ?? null,
    completedAt: raw.completedAt ?? null,
    failedReason: raw.failedReason ?? null,
    driftSnapshot: raw.driftSnapshot ?? [],
    tradePlan: raw.tradePlan ?? [],
    executionSummary: raw.executionSummary ?? null,
  };
}

function mapPlan(raw: BackendRebalancePlan): AssetRebalancePlan {
  return {
    rebalanceId: raw.rebalanceId ?? null,
    accountId: raw.accountId,
    method: raw.method,
    status: raw.status,
    portfolioValueUsdt: toNumOrNull(raw.portfolioValueUsdt),
    estimatedCostUsdt: toNumOrNull(raw.estimatedCostUsdt),
    estimatedBenefitUsdt: toNumOrNull(raw.estimatedBenefitUsdt),
    skipReason: raw.skipReason ?? null,
    driftItems: (raw.driftItems ?? []).map((d) => ({
      asset: d.asset,
      currentUsdtValue: toNum(d.currentUsdtValue, 0),
      currentPct: toNum(d.currentPct, 0),
      targetPct: toNum(d.targetPct, 0),
      minBandPp: toNum(d.minBandPp, 0),
      driftPp: toNum(d.driftPp, 0),
      withinBand: Boolean(d.withinBand),
    })),
    tradePlan: (raw.tradePlan ?? []).map((l) => ({
      action: l.action,
      asset: l.asset,
      quoteAsset: l.quoteAsset,
      estQuoteQtyUsdt: toNum(l.estQuoteQtyUsdt, 0),
      estBaseQty: toNumOrNull(l.estBaseQty),
      referencePrice: toNumOrNull(l.referencePrice),
      reason: l.reason,
    })),
    generatedAt: raw.generatedAt,
    lastRebalanceAt: raw.lastRebalanceAt ?? null,
  };
}

export async function fetchAssetTargets(accountId: string): Promise<AssetAllocationTarget[]> {
  const { data } = await apiClient.get<BackendAssetTarget[]>(`/api/v1/portfolio/assets/targets`, {
    params: { accountId },
  });
  return (data ?? []).map(mapTarget);
}

export async function upsertAssetTargets(
  payload: UpsertAssetTargetsRequest,
): Promise<AssetAllocationTarget[]> {
  const { data } = await apiClient.put<BackendAssetTarget[]>(
    `/api/v1/portfolio/assets/targets`,
    payload,
  );
  return (data ?? []).map(mapTarget);
}

export async function fetchAssetPolicy(accountId: string): Promise<AssetRebalancePolicy> {
  const { data } = await apiClient.get<BackendAssetPolicy>(`/api/v1/portfolio/assets/policy`, {
    params: { accountId },
  });
  return mapPolicy(data);
}

export async function updateAssetPolicy(
  payload: UpdateAssetPolicyRequest,
): Promise<AssetRebalancePolicy> {
  const { data } = await apiClient.patch<BackendAssetPolicy>(
    `/api/v1/portfolio/assets/policy`,
    payload,
  );
  return mapPolicy(data);
}

export async function computeAssetRebalancePlan(
  accountId: string,
  persist: boolean,
): Promise<AssetRebalancePlan> {
  const { data } = await apiClient.post<BackendRebalancePlan>(
    `/api/v1/portfolio/assets/rebalance/plan`,
    null,
    { params: { accountId, persist } },
  );
  return mapPlan(data);
}

export async function fetchRebalanceById(rebalanceId: string): Promise<AssetRebalanceHistoryView> {
  const { data } = await apiClient.get<BackendRebalanceHistoryView>(
    `/api/v1/portfolio/assets/rebalance/${rebalanceId}`,
  );
  return mapHistoryView(data);
}

export async function executeRebalance(rebalanceId: string): Promise<AssetRebalanceHistoryView> {
  const { data } = await apiClient.post<BackendRebalanceHistoryView>(
    `/api/v1/portfolio/assets/rebalance/${rebalanceId}/execute`,
  );
  return mapHistoryView(data);
}
