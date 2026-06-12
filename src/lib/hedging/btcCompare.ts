/**
 * Pure transforms backing the hedging dashboard's "strategy vs holding BTC"
 * panels. Builds on the reusable buy-hold math in `@/lib/buyHold` — this module
 * only adds the hedging-specific shapes (a drawdown series and a BTC-stack
 * multiple) and the day-alignment that joins the equity read to BTC closes.
 *
 * Everything here is React/charting-free and unit-tested.
 */

import type { ClosePoint } from '@/lib/buyHold';

/** One account-equity sample (time in ms, equity in USDT). */
export interface EquitySample {
  time: number;
  equity: number;
}

/** A drawdown sample for the overlay panel — negative-or-zero percent. */
export interface DrawdownPoint {
  time: number;
  drawdownPct: number;
}

/** One BTC-stack scoreboard point — strategy stack as a multiple of buy-hold. */
export interface BtcStackPoint {
  time: number;
  stackMultiple: number;
}

const DAY_MS = 86_400_000;

/** Floor a ms timestamp to its UTC day so daily candles join to equity samples. */
function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/**
 * Running peak-to-current drawdown of an equity series, as a non-positive
 * percent at each point (0 at every new high). Empty-safe.
 */
export function drawdownSeries(series: { time: number; value: number }[]): DrawdownPoint[] {
  if (series.length === 0) return [];
  let peak = series[0].value;
  return series.map((p) => {
    if (p.value > peak) peak = p.value;
    const dd = peak > 0 ? (p.value / peak - 1) * 100 : 0;
    return { time: p.time, drawdownPct: dd > 0 ? 0 : dd };
  });
}

/**
 * Join BTC closes onto the equity samples by UTC day: for each equity sample,
 * pick the close from the same day (last one wins) and re-stamp it on the
 * equity sample's timestamp so the two series share an x-axis. Equity samples
 * with no same-day close are dropped (we never invent a price).
 */
export function alignClosesToEquity(equity: EquitySample[], closes: ClosePoint[]): ClosePoint[] {
  if (equity.length === 0 || closes.length === 0) return [];
  const byDay = new Map<number, number>();
  for (const c of closes) {
    if (Number.isFinite(c.close)) byDay.set(dayKey(c.ts), c.close);
  }
  const out: ClosePoint[] = [];
  for (const e of equity) {
    const close = byDay.get(dayKey(e.time));
    if (close != null) out.push({ ts: e.time, close });
  }
  return out;
}

/**
 * BTC-stack scoreboard: how the strategy's BTC-denominated stack grew vs a
 * buy-and-holder, normalized to 1.00 at the first aligned bar. `> 1` means the
 * strategy accumulated more BTC than holding would have; `< 1` means less.
 *
 * stackₜ (BTC) = equityₜ / priceₜ; the scoreboard plots stackₜ / stack₀.
 * The closes are day-aligned to the equity samples first, so a mismatched
 * cadence can't smear the two series.
 */
export function btcStackSeries(equity: EquitySample[], closes: ClosePoint[]): BtcStackPoint[] {
  const aligned = alignClosesToEquity(equity, closes);
  if (aligned.length === 0) return [];
  const equityByTime = new Map(equity.map((e) => [e.time, e.equity]));

  const stacks: { time: number; stack: number }[] = [];
  for (const c of aligned) {
    const eq = equityByTime.get(c.ts);
    if (eq == null || !Number.isFinite(c.close) || c.close <= 0) continue;
    stacks.push({ time: c.ts, stack: eq / c.close });
  }
  if (stacks.length === 0) return [];
  const base = stacks[0].stack;
  if (!Number.isFinite(base) || base <= 0) return [];
  return stacks.map((s) => ({ time: s.time, stackMultiple: s.stack / base }));
}
