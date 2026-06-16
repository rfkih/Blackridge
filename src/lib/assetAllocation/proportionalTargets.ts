import type { AssetTargetItemInput } from '@/types/assetAllocation';
import type { PortfolioAsset } from '@/types/portfolio';

const QUOTE = 'USDT';
const DEFAULT_MIN_BAND_PP = 5;

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Build a full asset-target set (summing to exactly 100) for a chosen USDT
 * weight, splitting the non-USDT remainder PROPORTIONAL to current holdings.
 *
 * - USDT is held at exactly `usdtPct` (clamped to [0,100], rounded to 2dp).
 * - The remainder `R = 100 - usdtPct` is split across held non-USDT assets by
 *   value share; each leg is rounded to 2dp and the rounding residual lands on
 *   the largest-weight non-USDT asset, so the set sums to 100 within ±0.01
 *   (matches the page's `sumOk` tolerance and the backend `SUM_TOLERANCE`).
 * - When there is nothing to split into (USDT target is 100, or no non-USDT is
 *   held), the only valid 100-sum set is a single `USDT: 100` row.
 *
 * Pure — no I/O. Used by the "target USDT %" quick action before PUT /targets.
 */
export function buildProportionalTargets(
  usdtPct: number,
  assets: PortfolioAsset[],
): AssetTargetItemInput[] {
  const usdt = round2(Math.min(100, Math.max(0, usdtPct)));
  const remainder = round2(100 - usdt);

  const nonUsdt = assets
    .filter((a) => a.asset.toUpperCase() !== QUOTE && a.usdtValue > 0)
    .map((a) => ({ asset: a.asset.toUpperCase(), value: a.usdtValue }));
  const sum = nonUsdt.reduce((s, a) => s + a.value, 0);

  if (remainder <= 0 || sum <= 0 || nonUsdt.length === 0) {
    return [{ asset: QUOTE, targetPct: 100, minBandPp: DEFAULT_MIN_BAND_PP }];
  }

  const legs = nonUsdt.map((a) => ({ asset: a.asset, pct: round2(remainder * (a.value / sum)) }));
  const allocated = legs.reduce((s, l) => s + l.pct, 0);
  const residual = round2(remainder - allocated);
  if (residual !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < nonUsdt.length; i += 1) {
      if (nonUsdt[i].value > nonUsdt[maxIdx].value) maxIdx = i;
    }
    legs[maxIdx].pct = round2(legs[maxIdx].pct + residual);
  }

  return [
    { asset: QUOTE, targetPct: usdt, minBandPp: DEFAULT_MIN_BAND_PP },
    ...legs.map((l) => ({ asset: l.asset, targetPct: l.pct, minBandPp: DEFAULT_MIN_BAND_PP })),
  ];
}
