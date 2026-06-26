import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { extractList } from './pageUtils';
import type { PageResponse } from '@/types/api';
import type {
  CarryAllocationMode,
  CarryConfig,
  CarryDeployPlan,
  CarryDeployResult,
  CarryMutationResult,
  CarryOpenable,
  CarryPair,
  CarryStatus,
  OpenCarryPairRequest,
  SaveCarryConfigRequest,
} from '@/types/trading';

/** Wire shape from `GET /api/v1/carry/pairs` (Jackson BigDecimal → number or string). */
interface BackendCarryPair {
  id: string | null;
  accountId: string | null;
  accountStrategyId: string | null;
  symbol: string | null;
  status: string | null;
  simulated: boolean | null;
  spotSide: string | null;
  spotQty: number | string | null;
  spotEntryPrice: number | string | null;
  perpSide: string | null;
  perpQty: number | string | null;
  perpEntryPrice: number | string | null;
  perpLeverage: number | string | null;
  rebalanceBandPct: number | string | null;
  fundingPnl: number | string | null;
  markPrice: number | string | null;
  unrealizedPnl: number | string | null;
  totalPnl: number | string | null;
  netDeltaBase: number | string | null;
  lastRebalanceAt: string | null;
  createdAt: string | null;
}

const CARRY_STATUSES: CarryStatus[] = [
  'PENDING',
  'OPENING',
  'OPEN',
  'REBALANCING',
  'CLOSING',
  'CLOSED',
  'FAILED',
];

function narrowStatus(v: string | null | undefined): CarryStatus {
  const up = (v ?? '').toUpperCase();
  // Fail OPEN: an unrecognized/renamed backend status becomes UNKNOWN (treated as
  // live/needs-attention), never silently CLOSED — so a live pair can't vanish from the book.
  return (CARRY_STATUSES as string[]).includes(up) ? (up as CarryStatus) : 'UNKNOWN';
}

function mapCarryPair(c: BackendCarryPair): CarryPair {
  return {
    id: c.id ?? '',
    accountId: c.accountId ?? '',
    accountStrategyId: c.accountStrategyId ?? '',
    symbol: c.symbol ?? '',
    status: narrowStatus(c.status),
    simulated: Boolean(c.simulated),
    spotSide: c.spotSide ?? 'LONG',
    spotQty: toNum(c.spotQty),
    spotEntryPrice: toNum(c.spotEntryPrice),
    perpSide: c.perpSide ?? 'SHORT',
    perpQty: toNum(c.perpQty),
    perpEntryPrice: toNum(c.perpEntryPrice),
    perpLeverage: toNumOrNull(c.perpLeverage),
    rebalanceBandPct: toNumOrNull(c.rebalanceBandPct),
    fundingPnl: toNum(c.fundingPnl),
    markPrice: toNumOrNull(c.markPrice),
    unrealizedPnl: toNumOrNull(c.unrealizedPnl),
    totalPnl: toNumOrNull(c.totalPnl),
    netDeltaBase: toNumOrNull(c.netDeltaBase),
    lastRebalanceAt: c.lastRebalanceAt,
    createdAt: c.createdAt,
  };
}

/** The authenticated user's carry book (delta-neutral pairs), newest first. */
export async function getCarryPairs(): Promise<CarryPair[]> {
  const { data } = await apiClient.get<BackendCarryPair[] | PageResponse<BackendCarryPair>>(
    '/api/v1/carry/pairs',
  );
  return extractList(data).map(mapCarryPair);
}

interface BackendOpenableStrategy {
  accountStrategyId: string | null;
  symbol: string | null;
  hasOpenPair: boolean | null;
}

interface BackendCarryOpenable {
  maxLeverage: number | string | null;
  strategies: BackendOpenableStrategy[] | null;
}

/** FCARRY strategies the user can open a pair against + the server leverage cap (for risk tiers). */
export async function getOpenableCarry(): Promise<CarryOpenable> {
  const { data } = await apiClient.get<BackendCarryOpenable>('/api/v1/carry/openable');
  return {
    maxLeverage: Math.max(1, Math.trunc(toNum(data?.maxLeverage, 3))),
    // Drop any symbol-less row defensively: an empty `value` would crash a Radix <SelectItem>.
    strategies: (data?.strategies ?? [])
      .filter((s) => Boolean(s.symbol))
      .map((s) => ({
        accountStrategyId: s.accountStrategyId ?? '',
        symbol: s.symbol ?? '',
        hasOpenPair: Boolean(s.hasOpenPair),
      })),
  };
}

/**
 * Raw `CarryPair` ENTITY shape returned by open/close — distinct from the `/pairs`
 * `CarryPairResponse` shape (no `id`/`createdAt`/`markPrice`). We only read the few fields
 * needed to react; the book refetches via `/pairs` for the full decorated row.
 */
interface BackendCarryEntity {
  carryPairId: string | null;
  status: string | null;
  symbol: string | null;
  simulated: boolean | null;
}

function mapMutationResult(data: BackendCarryEntity, fallbackSymbol = ''): CarryMutationResult {
  return {
    carryPairId: data?.carryPairId ?? '',
    status: narrowStatus(data?.status),
    symbol: data?.symbol ?? fallbackSymbol,
    simulated: Boolean(data?.simulated),
  };
}

/**
 * Open ONE delta-neutral carry pair. SIM-FIRST: pass `simulated: true` for paper.
 * NOTE: the backend returns HTTP 200 with `status: 'FAILED'` (not an HTTP error) when a real
 * open can't proceed (non-positive funding, leg/margin failure) — callers MUST check `status`.
 */
export async function openCarryPair(req: OpenCarryPairRequest): Promise<CarryMutationResult> {
  const { data } = await apiClient.post<BackendCarryEntity>('/api/v1/carry/open-pair', {
    accountStrategyId: req.accountStrategyId,
    symbol: req.symbol,
    targetBaseQty: req.targetBaseQty,
    leverage: req.leverage,
    simulated: req.simulated,
  });
  return mapMutationResult(data, req.symbol);
}

/** Close (unwind) an open carry pair by id — the manual kill-switch. */
export async function closeCarryPair(carryPairId: string): Promise<CarryMutationResult> {
  const { data } = await apiClient.post<BackendCarryEntity>('/api/v1/carry/close-pair', {
    carryPairId,
  });
  return mapMutationResult(data);
}

// ----------------------------------------------------- carry activation (config + auto-deploy)

interface BackendCarryConfig {
  accountId: string | null;
  enabled: boolean | null;
  allocationMode: string | null;
  allocationPct: number | string | null;
  allocationUsd: number | string | null;
  defaultLeverage: number | string | null;
  maxPairs: number | null;
  simulated: boolean | null;
}

function narrowMode(v: string | null | undefined): CarryAllocationMode {
  return v === 'USD' ? 'USD' : 'PCT';
}

function mapCarryConfig(c: BackendCarryConfig): CarryConfig {
  return {
    accountId: c.accountId ?? '',
    enabled: Boolean(c.enabled),
    allocationMode: narrowMode(c.allocationMode),
    allocationPct: toNumOrNull(c.allocationPct),
    allocationUsd: toNumOrNull(c.allocationUsd),
    defaultLeverage: toNum(c.defaultLeverage, 1),
    maxPairs: c.maxPairs ?? 5,
    // Fail safe to sim-first if the flag is missing on the wire.
    simulated: c.simulated == null ? true : Boolean(c.simulated),
  };
}

/** The account's carry activation config (a disabled, sim-first default when unset). */
export async function getCarryConfig(accountId: string): Promise<CarryConfig> {
  const { data } = await apiClient.get<BackendCarryConfig>(`/api/v1/carry/config/${accountId}`);
  return mapCarryConfig(data);
}

/** Create/update the account's carry activation config. */
export async function saveCarryConfig(
  accountId: string,
  req: SaveCarryConfigRequest,
): Promise<CarryConfig> {
  const { data } = await apiClient.put<BackendCarryConfig>(
    `/api/v1/carry/config/${accountId}`,
    req,
  );
  return mapCarryConfig(data);
}

interface BackendDeployPlanItem {
  accountStrategyId: string | null;
  symbol: string | null;
  targetBaseQty: number | string | null;
  leverage: number | string | null;
  markPrice: number | string | null;
  estNotionalUsd: number | string | null;
}

interface BackendDeployPlan {
  enabled: boolean | null;
  simulated: boolean | null;
  allocationMode: string | null;
  budgetUsd: number | string | null;
  perPairUsd: number | string | null;
  maxPairs: number | null;
  items: BackendDeployPlanItem[] | null;
  notes: string[] | null;
}

function mapDeployPlan(d: BackendDeployPlan): CarryDeployPlan {
  return {
    enabled: Boolean(d?.enabled),
    simulated: Boolean(d?.simulated),
    allocationMode: narrowMode(d?.allocationMode),
    budgetUsd: toNum(d?.budgetUsd),
    perPairUsd: toNum(d?.perPairUsd),
    maxPairs: d?.maxPairs ?? 0,
    items: (d?.items ?? []).map((i) => ({
      accountStrategyId: i.accountStrategyId ?? '',
      symbol: i.symbol ?? '',
      targetBaseQty: toNum(i.targetBaseQty),
      leverage: toNum(i.leverage),
      markPrice: toNum(i.markPrice),
      estNotionalUsd: toNum(i.estNotionalUsd),
    })),
    notes: d?.notes ?? [],
  };
}

/** Dry-run the carry deploy — what filling the allocation would open. Places NO orders. */
export async function planCarryDeploy(accountId: string): Promise<CarryDeployPlan> {
  const { data } = await apiClient.post<BackendDeployPlan>(
    `/api/v1/carry/deploy/plan/${accountId}`,
  );
  return mapDeployPlan(data);
}

interface BackendDeployResult {
  simulated: boolean | null;
  requested: number | null;
  opened: number | null;
  failed: number | null;
  items: { symbol: string | null; status: string | null }[] | null;
  notes: string[] | null;
}

/** Execute the carry deploy — opens pairs to the allocation (sim-first per config). */
export async function executeCarryDeploy(accountId: string): Promise<CarryDeployResult> {
  const { data } = await apiClient.post<BackendDeployResult>(
    `/api/v1/carry/deploy/execute/${accountId}`,
  );
  return {
    simulated: Boolean(data?.simulated),
    requested: data?.requested ?? 0,
    opened: data?.opened ?? 0,
    failed: data?.failed ?? 0,
    items: (data?.items ?? []).map((i) => ({ symbol: i.symbol ?? '', status: i.status ?? '' })),
    notes: data?.notes ?? [],
  };
}
