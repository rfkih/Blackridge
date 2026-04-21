import type { UUID } from './api';

export interface PortfolioAsset {
  /** Ticker, e.g. "USDT", "BTC". */
  asset: string;
  free: number;
  locked: number;
  /** Value of (free + locked) in USDT at the most recent available mark. */
  usdtValue: number;
}

export interface PortfolioBalance {
  accountId: UUID | '';
  totalUsdt: number;
  availableUsdt: number;
  lockedUsdt: number;
  assets: PortfolioAsset[];
}
