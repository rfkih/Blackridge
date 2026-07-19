// Book Authority (trading JVM /api/portfolio-books) — phase-2 contract.
export type BookStatus = 'CANDIDATE' | 'PAPER' | 'LIVE' | 'RETIRED';

export interface PortfolioBook {
  bookCode: string;
  version: number;
  status: BookStatus;
  frozenAt: string | null; // ISO; may be null while CANDIDATE
  createdTime: string;
  // config JSONB is passed through opaquely; we only render sleeve targets, so keep it loose:
  config?: Record<string, unknown>;
}

export type TargetSide = 'LONG' | 'SHORT' | 'FLAT';

export interface SleeveTarget {
  targetId: string;
  bookCode: string;
  bookVersion: number;
  sleeveCode: string;
  symbol: string;
  exchange: string;
  currency: string;
  side: TargetSide;
  targetWeight: number; // fraction 0..1
  targetNotional: number;
  asOfDate: string; // ISO date (yyyy-MM-dd)
}

// Equity service (blackheart-equity /api/equity) — phase-3 contract.
export type EquityProfile = 'PAPER' | 'LIVE';

export interface EquityPosition {
  symbol: string;
  profile: EquityProfile;
  venue: string;
  bookCode: string | null;
  sleeveCode: string | null;
  qty: number;
  avgPrice: number | null;
}

export type EquityOrderSide = 'BUY' | 'SELL';
export type EquityOrderStatus =
  | 'NEW'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED';

export interface EquityOrder {
  symbol: string;
  side: EquityOrderSide;
  qty: number;
  status: EquityOrderStatus;
  brokerOrderId: string | null;
  asOfDate: string;
  profile: EquityProfile;
}
