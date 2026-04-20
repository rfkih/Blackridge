import type { Interval, StrategyCode } from '@/lib/constants';
import type { ISO8601, UUID } from './api';

export type AccountStrategyStatus = 'LIVE' | 'PAUSED' | 'STOPPED';

export interface AccountStrategy {
  id: UUID;
  accountId: UUID;
  strategyCode: StrategyCode | string;
  symbol: string;
  interval: Interval | string;
  status: AccountStrategyStatus;
  capitalAllocatedUsdt: number;
  allowLong: boolean;
  allowShort: boolean;
  priorityOrder: number;
  createdAt: ISO8601;
  updatedAt: ISO8601;
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

export interface VcbParams {
  // Compression Detection
  compressionLookback: number;
  compressionBbWidth: number;
  compressionKcWidth: number;
  useKcFilter: boolean;

  // Breakout Filters
  minBreakoutAtr: number;
  maxBreakoutAtr: number;
  volumeMultiplier: number;
  useVolumeFilter: boolean;

  // Exit & Risk
  stopLossAtr: number;
  atrPeriod: number;
  tp1RMultiple: number;
  tp2RMultiple: number;
  useRunner: boolean;

  // Position Sizing
  riskPercentage: number;
  maxPositionSizeUsdt: number;
}

export type StrategyParams = LsrParams | VcbParams;
