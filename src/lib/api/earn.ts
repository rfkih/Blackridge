import { apiClient } from './client';
import { toNum } from './coerce';

/** Wire shape of GET /api/v1/earn/position (Jackson BigDecimal as number-or-string). */
interface BackendEarnPosition {
  asset: string | null;
  amountUsdt: number | string | null;
  accruedYieldUsdt: number | string | null;
  productId: string | null;
  enabled: boolean | null;
}

/** USDT currently parked in Binance Flexible Simple Earn for a HEDGING account. */
export interface EarnPosition {
  asset: string;
  /** USDT subscribed to flexible Earn right now (0 when none / earn off). */
  amountUsdt: number;
  /** Unrealized interest accrued on the current open episode — added to the live
   *  equity tip so equity updates continuously, not only at redeem. */
  accruedYieldUsdt: number;
  /** Whether the earn feature is switched on server-side (app.earn.enabled). */
  enabled: boolean;
}

/**
 * Reads the account's flexible Simple Earn USDT position from the trading JVM.
 * Ownership-scoped server-side; returns 0 for non-hedging accounts or when the
 * gateway read fails (best-effort), so the dashboard never breaks on it.
 */
export async function getEarnPosition(accountId?: string): Promise<EarnPosition> {
  const { data } = await apiClient.get<BackendEarnPosition>('/api/v1/earn/position', {
    params: accountId ? { accountId } : undefined,
  });
  return {
    asset: data.asset ?? 'USDT',
    amountUsdt: toNum(data.amountUsdt),
    accruedYieldUsdt: toNum(data.accruedYieldUsdt),
    enabled: Boolean(data.enabled),
  };
}
