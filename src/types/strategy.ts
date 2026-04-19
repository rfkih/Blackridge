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
  // Entry Conditions
  adxThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  adxPeriod: number;
  rsiPeriod: number;

  // Volatility Filters
  useErFilter: boolean;
  erThreshold: number;
  erPeriod: number;
  useRelVolFilter: boolean;
  relVolThreshold: number;

  // Exit & Risk
  stopLossAtr: number;
  atrPeriod: number;
  tp1RMultiple: number;
  tp2RMultiple: number;
  useRunner: boolean;
  runnerActivationR: number;

  // Position Sizing
  riskPercentage: number;
  maxPositionSizeUsdt: number;

  // Direction (read-only inherited from AccountStrategy)
  allowLong: boolean;
  allowShort: boolean;
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
