// Circular type-only import — erased at runtime (strategy.ts re-imports Interval/StrategyCode).
// eslint-disable-next-line import/no-cycle
import type { LsrParams, VboParams, VcbParams } from '@/types/strategy';
import { env } from './env';

/** @deprecated prefer `import { env } from '@/lib/env'`. Re-exported so existing call sites keep working. */
export const API_URL = env.apiUrl;
/** @deprecated prefer `import { env } from '@/lib/env'`. */
export const WS_URL = env.wsUrl;

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Interval = (typeof INTERVALS)[number];

export const STRATEGY_CODES = [
  'LSR',
  'LSR_V2',
  'VCB',
  'TREND_PULLBACK_SINGLE_EXIT',
  'RAHT_V1',
  'TSMOM_V1',
] as const;
export type StrategyCode = (typeof STRATEGY_CODES)[number];

export const QUERY_STALE_TIMES = {
  openPositions: 0,
  closedTrades: 30_000,
  backtestResults: Number.POSITIVE_INFINITY,
  strategyParams: 60_000,
  pnlSummary: 30_000,
  portfolio: 60_000,
  marketCandles: 60_000,
} as const;

export type ParamInputKind = 'integer' | 'decimal' | 'percent' | 'rmultiple' | 'toggle';

export interface ParamMeta {
  label: string;
  description: string;
  kind: ParamInputKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
}

export const LSR_PARAM_META: Record<keyof LsrParams, ParamMeta> = {
  // ── Regime / volatility thresholds ──
  adxTrendingMin: {
    label: 'ADX Trending Min',
    description: 'ADX must exceed this value for the regime to be considered trending.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  adxCompressionMax: {
    label: 'ADX Compression Max',
    description: 'ADX below this value marks a compression (low-directionality) regime.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  adxEntryMin: {
    label: 'ADX Entry Min',
    description: 'Minimum ADX required to accept a new entry signal.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  adxEntryMax: {
    label: 'ADX Entry Max',
    description: 'Maximum ADX tolerated on entry — filters out over-extended trends.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  atrRatioExhaustion: {
    label: 'ATR Ratio — Exhaustion',
    description: 'Current-ATR / average-ATR ratio above which the market is deemed exhausted.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  atrRatioChaotic: {
    label: 'ATR Ratio — Chaotic',
    description: 'ATR-ratio threshold marking chaotic conditions (between normal and exhaustion).',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  atrRatioCompress: {
    label: 'ATR Ratio — Compression',
    description: 'ATR-ratio below this value marks a volatility compression.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },

  // ── Risk / exits ──
  stopAtrBuffer: {
    label: 'Stop ATR Buffer',
    description: 'Extra ATR buffer added to the computed stop distance to absorb noise.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 2,
    step: 0.05,
  },
  maxRiskPct: {
    label: 'Max Risk %',
    description: 'Max fraction of equity risked per trade (e.g. 0.03 = 3%).',
    kind: 'decimal',
    unit: '%',
    min: 0,
    max: 0.2,
    step: 0.005,
  },
  tp1RLongSweep: {
    label: 'TP1 R — Long Sweep',
    description: 'TP1 target in R-multiples for the long-sweep playbook.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  tp1RLongContinuation: {
    label: 'TP1 R — Long Continuation',
    description: 'TP1 target in R-multiples for the long-continuation playbook.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  tp1RShort: {
    label: 'TP1 R — Short',
    description: 'TP1 target in R-multiples for the short-exhaustion playbook.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  beTriggerRLongSweep: {
    label: 'BE Trigger R — Long Sweep',
    description: 'R-multiple at which the stop is moved to break-even for long-sweep trades.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  beTriggerRLongContinuation: {
    label: 'BE Trigger R — Long Continuation',
    description:
      'R-multiple at which the stop is moved to break-even for long-continuation trades.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  beTriggerRShort: {
    label: 'BE Trigger R — Short',
    description: 'R-multiple at which the stop is moved to break-even for short trades.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  beFeeBufferR: {
    label: 'BE Fee Buffer R',
    description: 'Extra R-buffer beyond break-even to cover fees when trailing stops.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 1,
    step: 0.01,
  },
  shortNotionalMultiplier: {
    label: 'Short Notional Multiplier',
    description: 'Scales short-trade notional relative to the default long sizing.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 2,
    step: 0.05,
  },
  longContinuationNotionalMultiplier: {
    label: 'Long-Continuation Notional Multiplier',
    description: 'Scales long-continuation notional relative to the default long-sweep sizing.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 2,
    step: 0.05,
  },

  // ── Time-stop bars ──
  timeStopBarsLongSweep: {
    label: 'Time Stop Bars — Long Sweep',
    description: 'Max bars a long-sweep trade may stay open before being time-stopped.',
    kind: 'integer',
    min: 1,
    max: 200,
    step: 1,
  },
  timeStopBarsLongContinuation: {
    label: 'Time Stop Bars — Long Continuation',
    description: 'Max bars a long-continuation trade may stay open before being time-stopped.',
    kind: 'integer',
    min: 1,
    max: 200,
    step: 1,
  },
  timeStopBarsShort: {
    label: 'Time Stop Bars — Short',
    description: 'Max bars a short trade may stay open before being time-stopped.',
    kind: 'integer',
    min: 1,
    max: 200,
    step: 1,
  },

  // ── Time-stop minimum R ──
  timeStopMinRLongSweep: {
    label: 'Time Stop Min R — Long Sweep',
    description: 'Minimum unrealized R required to keep a long-sweep trade past the time stop.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 3,
    step: 0.05,
  },
  timeStopMinRLongContinuation: {
    label: 'Time Stop Min R — Long Continuation',
    description:
      'Minimum unrealized R required to keep a long-continuation trade past the time stop.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 3,
    step: 0.05,
  },
  timeStopMinRShort: {
    label: 'Time Stop Min R — Short',
    description: 'Minimum unrealized R required to keep a short trade past the time stop.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 3,
    step: 0.05,
  },

  // ── Long sweep reclaim ──
  longSweepMinAtr: {
    label: 'Long Sweep — Min ATR',
    description: 'Lower bound on the sweep move size in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 5,
    step: 0.05,
  },
  longSweepMaxAtr: {
    label: 'Long Sweep — Max ATR',
    description: 'Upper bound on the sweep move size in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 10,
    step: 0.05,
  },
  longSweepRsiMin: {
    label: 'Long Sweep — RSI Min',
    description: 'Minimum RSI acceptable on the reclaim bar for a long-sweep entry.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longSweepRsiMax: {
    label: 'Long Sweep — RSI Max',
    description: 'Maximum RSI acceptable on the reclaim bar for a long-sweep entry.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longSweepRvolMin: {
    label: 'Long Sweep — Rvol Min',
    description: 'Minimum relative volume on the reclaim bar.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  longSweepBodyMin: {
    label: 'Long Sweep — Body Min',
    description: 'Minimum body fraction (|close-open|/range) on the reclaim bar.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  longSweepClvMin: {
    label: 'Long Sweep — CLV Min',
    description: 'Minimum close-location value on the reclaim bar (1.0 = closes at high).',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  minSignalScoreLongSweep: {
    label: 'Min Signal Score — Long Sweep',
    description: 'Minimum composite signal score required to accept a long-sweep entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  minConfidenceScoreLongSweep: {
    label: 'Min Confidence — Long Sweep',
    description: 'Minimum confidence score required to accept a long-sweep entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── Long continuation reclaim ──
  longContRsiMin: {
    label: 'Long Cont. — RSI Min',
    description: 'Minimum RSI acceptable on the pullback reclaim for a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longContRsiMax: {
    label: 'Long Cont. — RSI Max',
    description: 'Maximum RSI acceptable on the pullback reclaim for a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longContRvolMin: {
    label: 'Long Cont. — Rvol Min',
    description: 'Minimum relative volume on the reclaim bar for a long-continuation entry.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  longContBodyMin: {
    label: 'Long Cont. — Body Min',
    description: 'Minimum body fraction on the reclaim bar for a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  longContClvMin: {
    label: 'Long Cont. — CLV Min',
    description: 'Minimum close-location value on the reclaim bar for a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  longContDonchianBufferAtr: {
    label: 'Long Cont. — Donchian Buffer',
    description: 'ATR buffer below the Donchian high considered "near the range edge".',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 2,
    step: 0.01,
  },
  minSignalScoreLongCont: {
    label: 'Min Signal Score — Long Cont.',
    description: 'Minimum composite signal score required to accept a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  minConfidenceScoreLongCont: {
    label: 'Min Confidence — Long Cont.',
    description: 'Minimum confidence score required to accept a long-continuation entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── Short exhaustion ──
  shortSweepMinAtr: {
    label: 'Short Sweep — Min ATR',
    description: 'Lower bound on the short-side sweep move size in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 5,
    step: 0.05,
  },
  shortSweepMaxAtr: {
    label: 'Short Sweep — Max ATR',
    description: 'Upper bound on the short-side sweep move size in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 10,
    step: 0.05,
  },
  shortRsiMin: {
    label: 'Short — RSI Min',
    description: 'Minimum RSI on the reclaim bar for a short entry (exhaustion zone).',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  shortRvolMin: {
    label: 'Short — Rvol Min',
    description: 'Minimum relative volume on the reclaim bar for a short entry.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  shortBodyMin: {
    label: 'Short — Body Min',
    description: 'Minimum body fraction on the reclaim bar for a short entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  shortClvMax: {
    label: 'Short — CLV Max',
    description: 'Maximum close-location value on the reclaim bar for a short entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  minSignalScoreShort: {
    label: 'Min Signal Score — Short',
    description: 'Minimum composite signal score required to accept a short entry.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
};

export const VCB_PARAM_META: Record<keyof VcbParams, ParamMeta> = {
  // ── Compression ──────────────────────────────────────────────────────────
  squeezeKcTolerance: {
    label: 'Squeeze KC Tolerance',
    description:
      'Bollinger Band must sit inside this fraction of the Keltner Channel to qualify as a squeeze.',
    kind: 'decimal',
    unit: '×',
    min: 0.5,
    max: 1.5,
    step: 0.01,
  },
  atrRatioCompressMax: {
    label: 'ATR Ratio Compress Max',
    description:
      'Max current-ATR / average-ATR ratio allowed for the bar to count as compression.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  erCompressMax: {
    label: 'Efficiency Ratio Compress Max',
    description: 'Upper bound on Kaufman efficiency ratio (ER) during compression — lower is tighter.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── Breakout ─────────────────────────────────────────────────────────────
  relVolBreakoutMin: {
    label: 'Relative Volume — Min',
    description:
      'Breakout bar volume must be at least this multiple of the rolling average to trigger an entry.',
    kind: 'decimal',
    unit: '×',
    min: 0.5,
    max: 10,
    step: 0.05,
  },
  relVolBreakoutMax: {
    label: 'Relative Volume — Max',
    description:
      'Reject breakouts above this volume multiple — excludes climactic / late-fomo bars.',
    kind: 'decimal',
    unit: '×',
    min: 1,
    max: 10,
    step: 0.05,
  },
  bodyRatioBreakoutMin: {
    label: 'Body Ratio Breakout Min',
    description:
      'Breakout candle body / range must exceed this fraction (filters doji-style breakouts).',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── 4H bias ──────────────────────────────────────────────────────────────
  biasErMin: {
    label: '4H Bias — ER Min',
    description: 'Minimum 4H efficiency ratio required to confirm directional bias.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── Entry filters ────────────────────────────────────────────────────────
  adxEntryMax: {
    label: 'ADX Entry Max',
    description: 'Reject entries when ADX is above this — filters over-extended trends.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longRsiMin: {
    label: 'Long RSI Min',
    description: 'Minimum RSI on the entry bar for a long signal.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  shortRsiMax: {
    label: 'Short RSI Max',
    description: 'Maximum RSI on the entry bar for a short signal.',
    kind: 'decimal',
    min: 0,
    max: 100,
    step: 0.5,
  },
  longDiSpreadMin: {
    label: 'Long DI Spread Min',
    description: '+DI minus –DI must exceed this value to confirm a long entry.',
    kind: 'decimal',
    min: 0,
    max: 50,
    step: 0.1,
  },
  shortDiSpreadMin: {
    label: 'Short DI Spread Min',
    description: '–DI minus +DI must exceed this value to confirm a short entry.',
    kind: 'decimal',
    min: 0,
    max: 50,
    step: 0.1,
  },

  // ── Risk / exits ─────────────────────────────────────────────────────────
  stopAtrBuffer: {
    label: 'Stop ATR Buffer',
    description: 'Additional ATR distance placed beyond the structural stop.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 5,
    step: 0.05,
  },
  tp1R: {
    label: 'TP1 R-Multiple',
    description: 'First take-profit target as a multiple of initial risk (R).',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 10,
    step: 0.1,
  },
  maxEntryRiskPct: {
    label: 'Max Entry Risk',
    description: 'Upper bound on entry risk as a fraction of capital.',
    kind: 'percent',
    unit: '%',
    min: 0,
    max: 0.5,
    step: 0.005,
  },

  // ── Runner trail phases ──────────────────────────────────────────────────
  runnerHalfR: {
    label: 'Runner Half-R',
    description: 'R-multiple at which the runner starts honoring a tightened partial stop.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  runnerBreakEvenR: {
    label: 'Runner Break-Even R',
    description: 'R-multiple at which the runner stop is moved to break-even.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  runnerPhase2R: {
    label: 'Runner Phase-2 R',
    description: 'R-multiple at which the runner enters trail phase 2 (tighter ATR).',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 20,
    step: 0.1,
  },
  runnerPhase3R: {
    label: 'Runner Phase-3 R',
    description: 'R-multiple at which the runner enters trail phase 3 (tightest ATR).',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 30,
    step: 0.1,
  },
  runnerAtrPhase2: {
    label: 'Runner ATR — Phase 2',
    description: 'Trailing distance in ATR units while the runner is in phase 2.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0.1,
    max: 10,
    step: 0.05,
  },
  runnerAtrPhase3: {
    label: 'Runner ATR — Phase 3',
    description: 'Trailing distance in ATR units while the runner is in phase 3.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0.1,
    max: 10,
    step: 0.05,
  },
  runnerLockPhase2R: {
    label: 'Runner Lock — Phase 2',
    description: 'Minimum R that is locked in when the runner enters phase 2.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  runnerLockPhase3R: {
    label: 'Runner Lock — Phase 3',
    description: 'Minimum R that is locked in when the runner enters phase 3.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 20,
    step: 0.05,
  },

  // ── Signal ───────────────────────────────────────────────────────────────
  minSignalScore: {
    label: 'Min Signal Score',
    description: 'Minimum composite signal score required to open a trade.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
};

export const LSR_SECTIONS: Array<{ title: string; keys: Array<keyof LsrParams> }> = [
  {
    title: 'Regime & Volatility',
    keys: [
      'adxTrendingMin',
      'adxCompressionMax',
      'adxEntryMin',
      'adxEntryMax',
      'atrRatioExhaustion',
      'atrRatioChaotic',
      'atrRatioCompress',
    ],
  },
  {
    title: 'Risk & Exits',
    keys: [
      'stopAtrBuffer',
      'maxRiskPct',
      'tp1RLongSweep',
      'tp1RLongContinuation',
      'tp1RShort',
      'beTriggerRLongSweep',
      'beTriggerRLongContinuation',
      'beTriggerRShort',
      'beFeeBufferR',
      'shortNotionalMultiplier',
      'longContinuationNotionalMultiplier',
    ],
  },
  {
    title: 'Time Stops',
    keys: [
      'timeStopBarsLongSweep',
      'timeStopBarsLongContinuation',
      'timeStopBarsShort',
      'timeStopMinRLongSweep',
      'timeStopMinRLongContinuation',
      'timeStopMinRShort',
    ],
  },
  {
    title: 'Long Sweep Reclaim',
    keys: [
      'longSweepMinAtr',
      'longSweepMaxAtr',
      'longSweepRsiMin',
      'longSweepRsiMax',
      'longSweepRvolMin',
      'longSweepBodyMin',
      'longSweepClvMin',
      'minSignalScoreLongSweep',
      'minConfidenceScoreLongSweep',
    ],
  },
  {
    title: 'Long Continuation',
    keys: [
      'longContRsiMin',
      'longContRsiMax',
      'longContRvolMin',
      'longContBodyMin',
      'longContClvMin',
      'longContDonchianBufferAtr',
      'minSignalScoreLongCont',
      'minConfidenceScoreLongCont',
    ],
  },
  {
    title: 'Short Exhaustion',
    keys: [
      'shortSweepMinAtr',
      'shortSweepMaxAtr',
      'shortRsiMin',
      'shortRvolMin',
      'shortBodyMin',
      'shortClvMax',
      'minSignalScoreShort',
    ],
  },
];

export const VCB_SECTIONS: Array<{ title: string; keys: Array<keyof VcbParams> }> = [
  {
    title: 'Compression',
    keys: ['squeezeKcTolerance', 'atrRatioCompressMax', 'erCompressMax'],
  },
  {
    title: 'Breakout',
    keys: ['relVolBreakoutMin', 'relVolBreakoutMax', 'bodyRatioBreakoutMin'],
  },
  {
    title: '4H Bias',
    keys: ['biasErMin'],
  },
  {
    title: 'Entry Filters',
    keys: [
      'adxEntryMax',
      'longRsiMin',
      'shortRsiMax',
      'longDiSpreadMin',
      'shortDiSpreadMin',
    ],
  },
  {
    title: 'Risk & Exits',
    keys: ['stopAtrBuffer', 'tp1R', 'maxEntryRiskPct'],
  },
  {
    title: 'Runner Trail',
    keys: [
      'runnerHalfR',
      'runnerBreakEvenR',
      'runnerPhase2R',
      'runnerPhase3R',
      'runnerAtrPhase2',
      'runnerAtrPhase3',
      'runnerLockPhase2R',
      'runnerLockPhase3R',
    ],
  },
  {
    title: 'Signal',
    keys: ['minSignalScore'],
  },
];

export const VBO_PARAM_META: Record<keyof VboParams, ParamMeta> = {
  // ── Compression detection (previous bar) ────────────────────────────────
  compressionBbWidthPctMax: {
    label: 'Compression — BB Width % Max',
    description:
      'Max prev-bar Bollinger Band width as a fraction of price; below this counts as compressed.',
    kind: 'decimal',
    min: 0.001,
    max: 0.5,
    step: 0.001,
  },
  compressionAdxMax: {
    label: 'Compression — ADX Max',
    description: 'Max prev-bar ADX. Above this the trend was already active — not a real compression.',
    kind: 'decimal',
    min: 5,
    max: 60,
    step: 0.5,
  },
  requireKcSqueeze: {
    label: 'Require KC Squeeze',
    description: 'Require Bollinger inside Keltner on the prev bar (squeeze confirmation).',
    kind: 'toggle',
  },

  // ── Entry-bar ADX band ──────────────────────────────────────────────────
  adxEntryMin: {
    label: 'Entry ADX — Min',
    description: 'Lower bound on entry-bar ADX. Below this the breakout candle has no directional thrust.',
    kind: 'decimal',
    min: 0,
    max: 80,
    step: 0.5,
  },
  adxEntryMax: {
    label: 'Entry ADX — Max',
    description: 'Upper bound on entry-bar ADX. Above this the trend was already established.',
    kind: 'decimal',
    min: 0,
    max: 80,
    step: 0.5,
  },

  // ── Breakout confirmation ───────────────────────────────────────────────
  requireDonchianBreak: {
    label: 'Require Donchian Break',
    description: 'Require close beyond the Donchian-20 channel in addition to the Bollinger break.',
    kind: 'toggle',
  },
  requireTrendAlignment: {
    label: 'Require Trend Alignment',
    description: 'Require basic same-TF EMA50 alignment (close above for long, below for short).',
    kind: 'toggle',
  },
  ema50SlopeMin: {
    label: 'EMA50 Slope Min',
    description: 'Magnitude floor on EMA50 slope used for the trend-alignment veto.',
    kind: 'decimal',
    min: 0,
    max: 5,
    step: 0.01,
  },
  atrExpansionMin: {
    label: 'ATR Expansion Min',
    description:
      'Current bar range / prior ATR floor — i.e. how many ATRs of expansion the breakout candle covers.',
    kind: 'decimal',
    unit: '×',
    min: 1,
    max: 5,
    step: 0.05,
  },
  rvolMin: {
    label: 'Relative Volume Min',
    description: 'Relative-volume floor vs. the 20-bar average.',
    kind: 'decimal',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.05,
  },

  // ── Breakout candle quality ─────────────────────────────────────────────
  bodyRatioMin: {
    label: 'Body Ratio Min',
    description: 'Body / total-range floor on the breakout candle (filters doji-style breakouts).',
    kind: 'decimal',
    min: 0.1,
    max: 1,
    step: 0.01,
  },
  clvMin: {
    label: 'CLV Min',
    description: 'Close-location-value floor (long) / mirrored ceiling (short).',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  clvMax: {
    label: 'CLV Max',
    description: 'CLV ceiling — rejects candles closing pinned to the high (exhaustion).',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },

  // ── RSI sanity ──────────────────────────────────────────────────────────
  longRsiMax: {
    label: 'Long RSI Max',
    description: 'Skip long entries above this RSI — avoids chasing already-extended runs.',
    kind: 'decimal',
    min: 1,
    max: 100,
    step: 0.5,
  },
  shortRsiMin: {
    label: 'Short RSI Min',
    description: 'Skip short entries below this RSI.',
    kind: 'decimal',
    min: 1,
    max: 100,
    step: 0.5,
  },

  // ── Risk / exits ────────────────────────────────────────────────────────
  stopAtrBuffer: {
    label: 'Stop ATR Buffer',
    description: 'ATRs of padding beyond the breakout candle low (long) / high (short).',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 3,
    step: 0.05,
  },
  maxEntryRiskPct: {
    label: 'Max Entry Risk',
    description: 'Hard cap on per-trade risk as fraction of entry price.',
    kind: 'percent',
    unit: '%',
    min: 0.001,
    max: 0.2,
    step: 0.001,
  },
  tp1R: {
    label: 'TP1 R-Multiple',
    description: 'First take-profit target as a multiple of initial risk.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 10,
    step: 0.05,
  },

  // ── Position management ─────────────────────────────────────────────────
  breakEvenR: {
    label: 'Break-Even R',
    description: 'R-multiple at which the TP1 leg moves to break-even.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  runnerBreakEvenR: {
    label: 'Runner Break-Even R',
    description: 'R-multiple at which the runner stop is moved to break-even.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 5,
    step: 0.05,
  },
  runnerPhase2R: {
    label: 'Runner Phase-2 R',
    description: 'R-multiple at which the runner enters trail phase 2.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 10,
    step: 0.05,
  },
  runnerPhase3R: {
    label: 'Runner Phase-3 R',
    description: 'R-multiple at which the runner enters trail phase 3.',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 10,
    step: 0.05,
  },
  runnerAtrPhase2: {
    label: 'Runner ATR — Phase 2',
    description: 'Trailing distance in ATR units while the runner is in phase 2.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0.1,
    max: 5,
    step: 0.05,
  },
  runnerAtrPhase3: {
    label: 'Runner ATR — Phase 3',
    description: 'Trailing distance in ATR units while the runner is in phase 3.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0.1,
    max: 5,
    step: 0.05,
  },
  runnerLockPhase2R: {
    label: 'Runner Lock — Phase 2',
    description: 'Minimum R locked in when the runner enters phase 2.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },
  runnerLockPhase3R: {
    label: 'Runner Lock — Phase 3',
    description: 'Minimum R locked in when the runner enters phase 3.',
    kind: 'rmultiple',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.05,
  },

  // ── Signal ──────────────────────────────────────────────────────────────
  minSignalScore: {
    label: 'Min Signal Score',
    description: 'Minimum composite signal score required to open a trade.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
};

export const VBO_SECTIONS: Array<{ title: string; keys: Array<keyof VboParams> }> = [
  {
    title: 'Compression',
    keys: ['compressionBbWidthPctMax', 'compressionAdxMax', 'requireKcSqueeze'],
  },
  {
    title: 'Entry ADX Band',
    keys: ['adxEntryMin', 'adxEntryMax'],
  },
  {
    title: 'Breakout Confirmation',
    keys: [
      'requireDonchianBreak',
      'requireTrendAlignment',
      'ema50SlopeMin',
      'atrExpansionMin',
      'rvolMin',
    ],
  },
  {
    title: 'Candle Quality',
    keys: ['bodyRatioMin', 'clvMin', 'clvMax'],
  },
  {
    title: 'RSI Sanity',
    keys: ['longRsiMax', 'shortRsiMin'],
  },
  {
    title: 'Risk & Exits',
    keys: ['stopAtrBuffer', 'maxEntryRiskPct', 'tp1R'],
  },
  {
    title: 'Position Management',
    keys: [
      'breakEvenR',
      'runnerBreakEvenR',
      'runnerPhase2R',
      'runnerPhase3R',
      'runnerAtrPhase2',
      'runnerAtrPhase3',
      'runnerLockPhase2R',
      'runnerLockPhase3R',
    ],
  },
  {
    title: 'Signal',
    keys: ['minSignalScore'],
  },
];
