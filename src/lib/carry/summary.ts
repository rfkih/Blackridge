import type { CarryPair } from '@/types/trading';

/** Pair lifecycle states that count as a live (still-accruing) position. */
const LIVE_STATES = new Set(['PENDING', 'OPENING', 'OPEN', 'REBALANCING', 'CLOSING', 'UNKNOWN']);

export const isLiveCarry = (p: CarryPair) => LIVE_STATES.has(p.status);

export interface CarryBookSummary {
  /** Σ funding accrued across the given pairs — the carry edge. */
  funding: number;
  /** Σ total P&L (funding + basis MTM, or realized for terminal pairs). */
  total: number;
  /** Σ |perp notional| across OPEN pairs (USD). */
  notional: number;
  /** Σ net base-unit delta × mark across OPEN pairs (USD) — hedge residual. */
  netDeltaUsd: number;
  /** Count of OPEN (live-state) pairs. */
  openCount: number;
  /** Of the open pairs, how many are real vs paper. */
  liveCount: number;
  paperCount: number;
}

/**
 * Aggregate carry-book metrics over the given pairs (the caller pre-filters by mode/account).
 * Shared by the Carry Book tab KPI strip and the dashboard summary card so both read identically.
 */
export function summarizeCarryBook(pairs: CarryPair[]): CarryBookSummary {
  const open = pairs.filter(isLiveCarry);
  const funding = pairs.reduce((s, p) => s + (p.fundingPnl ?? 0), 0);
  const total = pairs.reduce((s, p) => s + (p.totalPnl ?? p.fundingPnl ?? 0), 0);
  const notional = open.reduce(
    (s, p) => s + Math.abs(p.perpQty) * (p.markPrice ?? p.perpEntryPrice ?? 0),
    0,
  );
  const netDeltaUsd = open.reduce(
    (s, p) =>
      s + (p.netDeltaBase ?? p.spotQty - p.perpQty) * (p.markPrice ?? p.perpEntryPrice ?? 0),
    0,
  );
  const liveCount = open.filter((p) => !p.simulated).length;
  return {
    funding,
    total,
    notional,
    netDeltaUsd,
    openCount: open.length,
    liveCount,
    paperCount: open.length - liveCount,
  };
}
