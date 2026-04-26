import type { Interval, StrategyCode } from '@/lib/constants';
import type { ISO8601, UUID } from './api';

export type AccountStrategyStatus = 'LIVE' | 'PAUSED' | 'STOPPED';

export interface AccountStrategy {
  id: UUID;
  accountId: UUID;
  strategyCode: StrategyCode | string;
  /** User-facing preset label. Several presets can share the same (strategy, symbol, interval);
   *  only one can be LIVE at a time. */
  presetName: string;
  symbol: string;
  interval: Interval | string;
  status: AccountStrategyStatus;
  /** Fraction of the owning account's equity allocated to this strategy (0–100). */
  capitalAllocationPct: number;
  maxOpenPositions: number;
  allowLong: boolean;
  allowShort: boolean;
  priorityOrder: number;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  /** Drawdown kill-switch — see Phase 2a. When tripped, RiskGuardService
   *  blocks new entries until manually re-armed via POST /:id/rearm. */
  ddKillThresholdPct: number;
  isKillSwitchTripped: boolean;
  killSwitchTrippedAt: ISO8601 | null;
  killSwitchReason: string | null;
}

export interface LsrParams {
  // Regime / volatility thresholds
  adxTrendingMin: number;
  adxCompressionMax: number;
  adxEntryMin: number;
  adxEntryMax: number;
  atrRatioExhaustion: number;
  atrRatioChaotic: number;
  atrRatioCompress: number;

  // Risk / exits
  stopAtrBuffer: number;
  maxRiskPct: number;
  tp1RLongSweep: number;
  tp1RLongContinuation: number;
  tp1RShort: number;
  beTriggerRLongSweep: number;
  beTriggerRLongContinuation: number;
  beTriggerRShort: number;
  beFeeBufferR: number;
  shortNotionalMultiplier: number;
  longContinuationNotionalMultiplier: number;

  // Time-stop bars (integers)
  timeStopBarsLongSweep: number;
  timeStopBarsLongContinuation: number;
  timeStopBarsShort: number;

  // Time-stop minimum R
  timeStopMinRLongSweep: number;
  timeStopMinRLongContinuation: number;
  timeStopMinRShort: number;

  // Long sweep reclaim
  longSweepMinAtr: number;
  longSweepMaxAtr: number;
  longSweepRsiMin: number;
  longSweepRsiMax: number;
  longSweepRvolMin: number;
  longSweepBodyMin: number;
  longSweepClvMin: number;
  minSignalScoreLongSweep: number;
  minConfidenceScoreLongSweep: number;

  // Long continuation reclaim
  longContRsiMin: number;
  longContRsiMax: number;
  longContRvolMin: number;
  longContBodyMin: number;
  longContClvMin: number;
  longContDonchianBufferAtr: number;
  minSignalScoreLongCont: number;
  minConfidenceScoreLongCont: number;

  // Short exhaustion
  shortSweepMinAtr: number;
  shortSweepMaxAtr: number;
  shortRsiMin: number;
  shortRvolMin: number;
  shortBodyMin: number;
  shortClvMax: number;
  minSignalScoreShort: number;
}

/**
 * VCB strategy parameters — field names mirror {@code dto/vcb/VcbParams.java}
 * exactly. All values are numeric (the backend serializes every field as
 * {@code BigDecimal}); an earlier version of this interface invented a
 * completely different schema (compressionLookback, useKcFilter, …) that did
 * not exist on the wire, so every value rendered as {@code undefined}.
 *
 * Whenever the Java DTO gains or renames a field, update this interface,
 * VCB_PARAM_META, and VCB_SECTIONS together.
 */
export interface VcbParams {
  // ── Compression thresholds ──
  squeezeKcTolerance: number;
  atrRatioCompressMax: number;
  erCompressMax: number;

  // ── Breakout thresholds ──
  relVolBreakoutMin: number;
  relVolBreakoutMax: number;
  bodyRatioBreakoutMin: number;

  // ── 4H bias threshold ──
  biasErMin: number;

  // ── Entry filters ──
  adxEntryMax: number;
  longRsiMin: number;
  shortRsiMax: number;
  longDiSpreadMin: number;
  shortDiSpreadMin: number;

  // ── Risk / exits ──
  stopAtrBuffer: number;
  tp1R: number;
  maxEntryRiskPct: number;

  // ── Runner trail phases ──
  runnerHalfR: number;
  runnerBreakEvenR: number;
  runnerPhase2R: number;
  runnerPhase3R: number;
  runnerAtrPhase2: number;
  runnerAtrPhase3: number;
  runnerLockPhase2R: number;
  runnerLockPhase3R: number;

  // ── Signal score threshold ──
  minSignalScore: number;
}

/**
 * VBO (Volatility Breakout) strategy parameters — field names mirror
 * {@code dto/vbo/VboParams.java} exactly. Most values are numeric (BigDecimal
 * on the wire); three gate flags arrive as booleans.
 *
 * Whenever the Java DTO gains or renames a field, update this interface,
 * VBO_PARAM_META, and VBO_SECTIONS together.
 */
export interface VboParams {
  // ── Compression detection (previous bar) ──
  compressionBbWidthPctMax: number;
  compressionAdxMax: number;
  requireKcSqueeze: boolean;

  // ── Entry-bar ADX band ──
  adxEntryMin: number;
  adxEntryMax: number;

  // ── Breakout confirmation ──
  requireDonchianBreak: boolean;
  requireTrendAlignment: boolean;
  ema50SlopeMin: number;
  atrExpansionMin: number;
  rvolMin: number;

  // ── Breakout candle quality ──
  bodyRatioMin: number;
  clvMin: number;
  clvMax: number;

  // ── RSI sanity ──
  longRsiMax: number;
  shortRsiMin: number;

  // ── Risk / exits ──
  stopAtrBuffer: number;
  maxEntryRiskPct: number;
  tp1R: number;

  // ── Position management ──
  breakEvenR: number;
  runnerBreakEvenR: number;
  runnerPhase2R: number;
  runnerPhase3R: number;
  runnerAtrPhase2: number;
  runnerAtrPhase3: number;
  runnerLockPhase2R: number;
  runnerLockPhase3R: number;

  // ── Signal score ──
  minSignalScore: number;
}

export type StrategyParams = LsrParams | VcbParams | VboParams;
