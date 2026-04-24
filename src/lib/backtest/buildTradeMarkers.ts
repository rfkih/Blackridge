import type { SeriesMarker, Time } from 'lightweight-charts';
import type { BacktestTrade, BacktestTradePosition } from '@/types/backtest';
import type { PositionExitReason, PositionType } from '@/types/trading';

interface LegMarkerCfg {
  color: string;
  label: string;
}

// Color + label per (leg type, exit reason) combination.
const LEG_MARKER_CONFIG: Record<PositionType, Partial<Record<PositionExitReason, LegMarkerCfg>>> = {
  SINGLE: {
    TP_HIT: { color: '#00C896', label: 'TP' },
    SL_HIT: { color: '#FF4D6A', label: 'SL' },
    RUNNER_CLOSE: { color: '#4E9EFF', label: 'R' },
    MANUAL_CLOSE: { color: '#F5A623', label: 'M' },
    BACKTEST_END: { color: '#8892A4', label: 'E' },
  },
  TP1: {
    TP_HIT: { color: '#00C896', label: 'T1' },
    SL_HIT: { color: '#FF4D6A', label: 'SL' },
    BACKTEST_END: { color: '#8892A4', label: 'E' },
  },
  TP2: {
    TP_HIT: { color: '#00E5B0', label: 'T2' },
    SL_HIT: { color: '#FF4D6A', label: 'SL' },
    BACKTEST_END: { color: '#8892A4', label: 'E' },
  },
  RUNNER: {
    RUNNER_CLOSE: { color: '#4E9EFF', label: 'R' },
    SL_HIT: { color: '#FF4D6A', label: 'SL' },
    BACKTEST_END: { color: '#8892A4', label: 'E' },
  },
};

function exitPosition(isLong: boolean): 'aboveBar' | 'belowBar' {
  // Profit legs plot opposite to the entry arrow so they don't overlap.
  return isLong ? 'aboveBar' : 'belowBar';
}

function oppositeOfEntry(isLong: boolean): 'aboveBar' | 'belowBar' {
  return isLong ? 'belowBar' : 'aboveBar';
}

/**
 * Per-marker metadata that TV's SeriesMarker can't carry. Lets the chart
 * resolve a click against multiple legs on the same candle by picking the one
 * closest to the clicked y-coordinate (price).
 */
export interface MarkerMeta {
  /** Same epoch-seconds value as the SeriesMarker.time it parallels. */
  time: number;
  tradeId: string;
  /** Leg price (entry, SL, TP1/TP2, runner exit) used for click disambiguation. */
  price: number;
  kind: 'entry' | 'tp1' | 'tp2' | 'runner' | 'stop' | 'manual' | 'end';
}

export interface TradeMarkerSet {
  markers: SeriesMarker<Time>[];
  /** Parallel array — same length & order as `markers`. */
  meta: MarkerMeta[];
}

/**
 * Convert BacktestTrade[] → SeriesMarker[] for TV Lightweight Charts.
 *
 * - Entry marker: arrow in the trade direction.
 * - Per-leg exit marker: circle colored by exit reason.
 * - Each marker carries `id = trade.id` for chart-click → table-row resolution.
 * - Output is sorted ascending by time (TV requires this).
 *
 * Returns markers + a parallel meta array; meta lets callers disambiguate
 * overlapping markers on the same candle by price.
 */
export function buildTradeMarkers(trades: BacktestTrade[]): TradeMarkerSet {
  const out: Array<{ marker: SeriesMarker<Time>; meta: MarkerMeta }> = [];

  for (const trade of trades) {
    const isLong = trade.direction === 'LONG';
    const entrySec = Math.floor(trade.entryTime / 1000);
    out.push({
      marker: {
        time: entrySec as Time,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: isLong ? '#00C896' : '#FF4D6A',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: isLong ? 'L' : 'S',
        id: trade.id,
      },
      meta: { time: entrySec, tradeId: trade.id, price: trade.entryPrice, kind: 'entry' },
    });

    for (const pos of trade.positions) {
      if (pos.exitTime == null || pos.exitReason == null) continue; // leg still open
      const cfg = LEG_MARKER_CONFIG[pos.type]?.[pos.exitReason];
      if (!cfg) continue;
      const exitSec = Math.floor(pos.exitTime / 1000);
      const position = pos.exitReason === 'SL_HIT' ? oppositeOfEntry(isLong) : exitPosition(isLong);
      const price = legExitPrice(trade, pos);
      out.push({
        marker: {
          time: exitSec as Time,
          position,
          color: cfg.color,
          shape: 'circle',
          text: cfg.label,
          id: trade.id,
        },
        meta: {
          time: exitSec,
          tradeId: trade.id,
          price,
          kind: legExitKind(pos),
        },
      });
    }
  }

  out.sort((a, b) => (a.marker.time as number) - (b.marker.time as number));
  return {
    markers: out.map((o) => o.marker),
    meta: out.map((o) => o.meta),
  };
}

/**
 * Best-effort price for a leg's exit marker. Falls back to entry price so the
 * disambiguation never crashes on missing data — the chart still selects
 * *some* trade on click even if the meta is approximate.
 */
function legExitPrice(trade: BacktestTrade, pos: BacktestTradePosition): number {
  if (pos.exitPrice != null && Number.isFinite(pos.exitPrice)) return pos.exitPrice;
  if (pos.exitReason === 'SL_HIT') return trade.stopLossPrice;
  if (pos.exitReason === 'TP_HIT') {
    if (pos.type === 'TP2' && trade.tp2Price != null) return trade.tp2Price;
    if (trade.tp1Price != null) return trade.tp1Price;
  }
  return trade.entryPrice;
}

function legExitKind(pos: BacktestTradePosition): MarkerMeta['kind'] {
  if (pos.exitReason === 'SL_HIT') return 'stop';
  if (pos.exitReason === 'RUNNER_CLOSE') return 'runner';
  if (pos.exitReason === 'MANUAL_CLOSE') return 'manual';
  if (pos.exitReason === 'BACKTEST_END') return 'end';
  if (pos.type === 'TP2') return 'tp2';
  return 'tp1';
}

/** Returns which leg types hit a given exit reason — drives the "legs hit" dots in the table. */
export function legHitMap(positions: BacktestTradePosition[]) {
  const map: Partial<Record<PositionType, PositionExitReason | null>> = {};
  for (const p of positions) map[p.type] = p.exitReason;
  return map;
}

/** Which price line the trade actually hit when it closed. Used to highlight
 *  the corresponding horizontal on the chart so the user can see at a glance
 *  whether a trade took profit, stopped out, or trailed.
 *
 *  Priority mirrors typical outcome reporting: a trade that tagged TP1 and
 *  then had its runner stopped out still counts as "TP hit" for the purpose
 *  of line highlighting (TP1 is the more informative anchor to show). */
export type HitLine = 'SL' | 'TP1' | 'TP2' | 'RUNNER' | null;

/** Tone keys the UI maps to Meridian Edge colors. Keeps the derivation pure
 *  (no React/theme dependency) so it can be used in tooltips, tables, etc. */
export type OutcomeTone = 'profit' | 'loss' | 'warning' | 'info' | 'muted';

export interface TradeOutcome {
  /** Short label rendered in pills: "TP", "SL", "Trail", "TP + Trail"… */
  label: string;
  /** Verbose, one-line description for tooltips / aria-labels. */
  description: string;
  tone: OutcomeTone;
  /** Which on-chart horizontal price line should be emphasised for the
   *  selected trade. `null` when the trade didn't actually touch a line
   *  (BACKTEST_END, manual close, still open). */
  hitLine: HitLine;
}

/**
 * Reduce a trade's per-leg exit reasons down to a single at-a-glance outcome.
 *
 * <p>Rules, in priority order:
 * <ol>
 *   <li>Every leg stopped out → "SL".</li>
 *   <li>Any TP hit, then a subsequent SL on a later leg → "TP → SL" (banana split).</li>
 *   <li>TP hit AND runner trailed → "TP + Trail".</li>
 *   <li>Runner trailed only → "Trail".</li>
 *   <li>Any TP hit → "TP" (TP1, TP2, or both).</li>
 *   <li>Manual close → "Manual".</li>
 *   <li>Backtest ended with legs still open → "End".</li>
 *   <li>No exit reasons at all → "Open".</li>
 * </ol>
 */
export function deriveTradeOutcome(positions: BacktestTradePosition[]): TradeOutcome {
  const hits = legHitMap(positions);
  const reasons = Object.values(hits).filter((r): r is PositionExitReason => r != null);

  if (reasons.length === 0) {
    return { label: 'Open', description: 'No legs closed yet', tone: 'muted', hitLine: null };
  }

  const hasTp = reasons.includes('TP_HIT');
  const hasSl = reasons.includes('SL_HIT');
  const hasRunner = reasons.includes('RUNNER_CLOSE');
  const hasManual = reasons.includes('MANUAL_CLOSE');
  const hasEnd = reasons.includes('BACKTEST_END');

  const tp1 = hits.TP1 ?? hits.SINGLE;
  const tp2 = hits.TP2;
  const runner = hits.RUNNER;

  // Pick the most representative price line to highlight. Prefer the
  // earliest-hit profit anchor, fall back to the stop when no profit leg
  // fired.
  const hitLine: HitLine = (() => {
    if (tp1 === 'TP_HIT') return 'TP1';
    if (tp2 === 'TP_HIT') return 'TP2';
    if (runner === 'RUNNER_CLOSE') return 'RUNNER';
    if (hasSl) return 'SL';
    return null;
  })();

  if (hasTp && hasSl) {
    return {
      label: 'TP → SL',
      description: 'Took profit on one leg, stopped out on another',
      tone: 'warning',
      hitLine,
    };
  }
  if (hasTp && hasRunner) {
    return {
      label: 'TP + Trail',
      description: 'Took profit and closed runner on trailing stop',
      tone: 'profit',
      hitLine,
    };
  }
  if (hasRunner) {
    return {
      label: 'Trail',
      description: 'Closed on trailing stop (runner)',
      tone: 'info',
      hitLine,
    };
  }
  if (hasTp) {
    const multi = tp1 === 'TP_HIT' && tp2 === 'TP_HIT';
    return {
      label: multi ? 'TP1 + TP2' : tp2 === 'TP_HIT' ? 'TP2' : 'TP',
      description: multi ? 'Both take-profit targets hit' : 'Take-profit target hit',
      tone: 'profit',
      hitLine,
    };
  }
  if (hasSl) {
    return {
      label: 'SL',
      description: 'Stopped out before any profit target',
      tone: 'loss',
      hitLine,
    };
  }
  if (hasManual) {
    return {
      label: 'Manual',
      description: 'Closed manually',
      tone: 'warning',
      hitLine: null,
    };
  }
  if (hasEnd) {
    return {
      label: 'End',
      description: 'Backtest ended with leg still open',
      tone: 'muted',
      hitLine: null,
    };
  }
  return { label: '—', description: 'Unknown outcome', tone: 'muted', hitLine: null };
}
