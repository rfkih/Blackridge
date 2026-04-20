// Circular type-only import — erased at runtime (strategy.ts re-imports Interval/StrategyCode).
// eslint-disable-next-line import/no-cycle
import type { LsrParams, VcbParams } from '@/types/strategy';

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || 'ws://localhost:8080/ws';

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
    description: 'R-multiple at which the stop is moved to break-even for long-continuation trades.',
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
  // Compression Detection
  compressionLookback: {
    label: 'Compression Lookback',
    description: 'Number of bars used to detect a volatility compression (squeeze).',
    kind: 'integer',
    min: 5,
    max: 500,
    step: 1,
  },
  compressionBbWidth: {
    label: 'BB Width Threshold',
    description: 'Bollinger Band width must drop below this ratio to mark compression.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  compressionKcWidth: {
    label: 'KC Width Threshold',
    description: 'Keltner Channel width must drop below this ratio to mark compression.',
    kind: 'decimal',
    min: 0,
    max: 1,
    step: 0.01,
  },
  useKcFilter: {
    label: 'Use Keltner Channel Filter',
    description: 'Require a BB-inside-KC squeeze, not just a BB compression.',
    kind: 'toggle',
  },
  // Breakout Filters
  minBreakoutAtr: {
    label: 'Min Breakout (ATR)',
    description: 'Minimum breakout distance from the range edge in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 5,
    step: 0.1,
  },
  maxBreakoutAtr: {
    label: 'Max Breakout (ATR)',
    description: 'Reject breakouts extending beyond this ATR distance (chase guard).',
    kind: 'decimal',
    unit: '× ATR',
    min: 0,
    max: 10,
    step: 0.1,
  },
  volumeMultiplier: {
    label: 'Volume Multiplier',
    description: 'Breakout bar volume must exceed this multiple of the rolling average.',
    kind: 'decimal',
    unit: '×',
    min: 0,
    max: 10,
    step: 0.1,
  },
  useVolumeFilter: {
    label: 'Use Volume Filter',
    description: 'Enable the breakout volume confirmation filter.',
    kind: 'toggle',
  },
  // Exit & Risk
  stopLossAtr: {
    label: 'Stop Loss (ATR)',
    description: 'Initial stop distance in ATR units.',
    kind: 'decimal',
    unit: '× ATR',
    min: 0.5,
    max: 5,
    step: 0.25,
  },
  atrPeriod: {
    label: 'ATR Period',
    description: 'Lookback length for ATR used in stops and sizing.',
    kind: 'integer',
    min: 2,
    max: 200,
    step: 1,
  },
  tp1RMultiple: {
    label: 'TP1 R-Multiple',
    description: 'First take-profit target as a multiple of initial risk (R).',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.25,
  },
  tp2RMultiple: {
    label: 'TP2 R-Multiple',
    description: 'Second take-profit target as a multiple of initial risk (R).',
    kind: 'rmultiple',
    unit: '×',
    min: 0.5,
    max: 5,
    step: 0.25,
  },
  useRunner: {
    label: 'Use Runner',
    description: 'Enable a trailing runner leg after TP1/TP2 are hit.',
    kind: 'toggle',
  },
  // Position Sizing
  riskPercentage: {
    label: 'Risk per Trade',
    description: 'Fraction of capital risked per trade between entry and stop.',
    kind: 'percent',
    unit: '%',
    min: 0,
    max: 10,
    step: 0.5,
  },
  maxPositionSizeUsdt: {
    label: 'Max Position Size',
    description: 'Hard cap on notional position size in USDT.',
    kind: 'integer',
    unit: 'USDT',
    min: 0,
    max: 10_000_000,
    step: 100,
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
    title: 'Compression Detection',
    keys: ['compressionLookback', 'compressionBbWidth', 'compressionKcWidth', 'useKcFilter'],
  },
  {
    title: 'Breakout Filters',
    keys: ['minBreakoutAtr', 'maxBreakoutAtr', 'volumeMultiplier', 'useVolumeFilter'],
  },
  {
    title: 'Exit & Risk',
    keys: ['stopLossAtr', 'atrPeriod', 'tp1RMultiple', 'tp2RMultiple', 'useRunner'],
  },
  {
    title: 'Position Sizing',
    keys: ['riskPercentage', 'maxPositionSizeUsdt'],
  },
];
