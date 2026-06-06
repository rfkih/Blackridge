import type { ISO8601, UUID } from './api';
import type { AccountType } from './accountType';

/** Backend AccountSummaryResponse — Java field names. */
export interface BackendAccountSummary {
  accountId: UUID;
  userId: UUID;
  username: string;
  exchange: string;
  isActive: string;
  createdTime: ISO8601;
  /** Account taxonomy (V153). Absent on legacy rows → mapped to TRADING. */
  accountType?: string;
  /** Phase 2a — concurrency caps. */
  maxConcurrentLongs?: number | null;
  maxConcurrentShorts?: number | null;
  /** Total concurrent-trade cap across all strategies (null = no cap). */
  maxConcurrentTrades?: number | null;
  /** Phase 2b — vol targeting. */
  volTargetingEnabled?: boolean | null;
  bookVolTargetPct?: number | string | null;
  /** V162 — per-account opt-in for idle-cash Simple Earn yield (HEDGING). */
  earnEnabled?: boolean | null;
}

/** Frontend-normalized account summary. */
export interface AccountSummary {
  id: UUID;
  userId: UUID;
  label: string;
  exchange: string;
  active: boolean;
  createdAt: ISO8601;
  /** Account taxonomy (V153). TRADING (directional positions) or HEDGING
   *  (spot allocation/tilt). Immutable post-create; legacy rows → TRADING. */
  accountType: AccountType;
  /** Risk-policy levers — see Phase 2a/2b. */
  maxConcurrentLongs: number;
  maxConcurrentShorts: number;
  /** Total concurrent-trade cap (null = no cap). */
  maxConcurrentTrades: number | null;
  volTargetingEnabled: boolean;
  bookVolTargetPct: number;
  /** Whether this (hedging) account opted into idle-cash Simple Earn yield. */
  earnEnabled: boolean;
}

/**
 * A handle the rest of the app uses to ask "what account am I scoped to?".
 * `'all'` means the user has asked for an aggregate view across every account.
 */
export type ActiveAccountSelection = UUID | 'all';
