import type { Interval, StrategyCode } from '@/lib/constants';
import type { ISO8601, UUID } from './api';

/**
 * V66 — status union split so the dashboard never labels a paper-mode
 * strategy as `LIVE`:
 *   STOPPED  enabled=false  (orchestrator skips the row)
 *   PAPER    enabled=true, simulated=true  (decisions land in paper_trade_run)
 *   LIVE     enabled=true, simulated=false (real Binance orders)
 *   PAUSED   reserved for future use
 *
 * "Active strategy" surfaces in the dashboard (counts, filters) should
 * include LIVE only — paper rows are *running* but not *trading real money*.
 */
export type AccountStrategyStatus = 'LIVE' | 'PAUSED' | 'STOPPED' | 'PAPER';

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
  /** Paper-trade flag (V15+). Combined with `status` (LIVE/STOPPED), defines
   *  the promotion state used by the /research dashboard:
   *    STOPPED                      → RESEARCH / DEMOTED / REJECTED
   *    LIVE  + simulated=true       → PAPER_TRADE
   *    LIVE  + simulated=false      → PROMOTED. */
  simulated: boolean;
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
  /** Regime gate (V43) — entries blocked unless current bar regime is in the allowed set. */
  regimeGateEnabled: boolean;
  allowedTrendRegimes: string | null;
  allowedVolatilityRegimes: string | null;
  /** Kill-switch gate (V62) — when true, `isKillSwitchTripped` blocks new entries.
   *  When false the trip flag is recorded but does not block trading. */
  killSwitchGateEnabled: boolean;
  /** Correlation / concentration gate (V62) — when true, CorrelationGuardService runs. */
  correlationGateEnabled: boolean;
  /** Account-level concurrent-position cap gate (V62) — when true, account
   *  maxConcurrentLongs/Shorts/Trades apply at entry time. */
  concurrentCapGateEnabled: boolean;
  /** Kelly/bankroll sizing (V45) — PSR-discounted half-Kelly position-size multiplier. */
  kellySizingEnabled: boolean;
  /** Hard cap on the Kelly fraction [0.05, 1.00]. Default 0.25. */
  kellyMaxFraction: number;
  /** Risk-based sizing toggle (V55). When true, LONG entries on legacy
   *  strategies size off `riskPct` with `capitalAllocationPct` acting as the
   *  notional cap. When false, allocation is the direct trade size. */
  useRiskBasedSizing: boolean;
  /** Per-trade risk as a fraction of cash balance, range (0, 0.20]. Used only
   *  when `useRiskBasedSizing` is true. Default 0.05 (5%). */
  riskPct: number;
  /** Tenant visibility (V54). PRIVATE = listed only to the owner.
   *  PUBLIC  = listed to every user for browse-and-clone (the research-agent
   *            account seeds its rows as PUBLIC). Backtest/edit/enable still
   *            require ownership regardless of visibility. */
  visibility: 'PRIVATE' | 'PUBLIC';
  /** True iff the calling user owns this strategy's account. False rows are
   *  read-only PUBLIC clones-of-other-tenants — render "Clone to my account"
   *  in place of edit/delete affordances. */
  ownedByCurrentUser: boolean;
  /** Display label for the owning account. "You" for owned rows, "Research
   *  Agent" for the research-agent's PUBLIC rows, otherwise the foreign
   *  account's username. Avoid leaking userIds to the UI — branch on this. */
  ownerLabel: string;
}

/**
 * Live Kelly status — what Kelly is doing right now, derived from the most
 * recent qualifying backtest runs. Returned by GET /:id/kelly-status.
 */
export interface KellyStatus {
  enabled: boolean;
  /** Effective multiplier in [0.05, 1.0]. 1.0 means no scaling. */
  currentMultiplier: number;
  /** Configured cap; null when strategy not found. */
  maxFraction: number | null;
  /** How many backtest runs contributed to the multiplier. 0 means inactive. */
  qualifyingRuns: number;
  /** Human-readable explanation: "kelly disabled" / "computed from N runs" / etc. */
  reason: string;
}

export interface LsrParams {
  adxTrendingMin: number;
  adxCompressionMax: number;
  adxEntryMin: number;
  adxEntryMax: number;
  atrRatioExhaustion: number;
  atrRatioChaotic: number;
  atrRatioCompress: number;

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

  timeStopBarsLongSweep: number;
  timeStopBarsLongContinuation: number;
  timeStopBarsShort: number;

  timeStopMinRLongSweep: number;
  timeStopMinRLongContinuation: number;
  timeStopMinRShort: number;

  longSweepMinAtr: number;
  longSweepMaxAtr: number;
  longSweepRsiMin: number;
  longSweepRsiMax: number;
  longSweepRvolMin: number;
  longSweepBodyMin: number;
  longSweepClvMin: number;
  minSignalScoreLongSweep: number;
  minConfidenceScoreLongSweep: number;

  longContRsiMin: number;
  longContRsiMax: number;
  longContRvolMin: number;
  longContBodyMin: number;
  longContClvMin: number;
  longContDonchianBufferAtr: number;
  minSignalScoreLongCont: number;
  minConfidenceScoreLongCont: number;

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
  squeezeKcTolerance: number;
  atrRatioCompressMax: number;
  erCompressMax: number;

  relVolBreakoutMin: number;
  relVolBreakoutMax: number;
  bodyRatioBreakoutMin: number;

  biasErMin: number;

  adxEntryMax: number;
  longRsiMin: number;
  shortRsiMax: number;
  longDiSpreadMin: number;
  shortDiSpreadMin: number;

  stopAtrBuffer: number;
  tp1R: number;
  maxEntryRiskPct: number;

  runnerHalfR: number;
  runnerBreakEvenR: number;
  runnerPhase2R: number;
  runnerPhase3R: number;
  runnerAtrPhase2: number;
  runnerAtrPhase3: number;
  runnerLockPhase2R: number;
  runnerLockPhase3R: number;

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
  compressionBbWidthPctMax: number;
  compressionAdxMax: number;
  requireKcSqueeze: boolean;

  adxEntryMin: number;
  adxEntryMax: number;

  requireDonchianBreak: boolean;
  requireTrendAlignment: boolean;
  ema50SlopeMin: number;
  atrExpansionMin: number;
  rvolMin: number;

  bodyRatioMin: number;
  clvMin: number;
  clvMax: number;

  longRsiMax: number;
  shortRsiMin: number;

  stopAtrBuffer: number;
  maxEntryRiskPct: number;
  tp1R: number;

  breakEvenR: number;
  runnerBreakEvenR: number;
  runnerPhase2R: number;
  runnerPhase3R: number;
  runnerAtrPhase2: number;
  runnerAtrPhase3: number;
  runnerLockPhase2R: number;
  runnerLockPhase3R: number;

  minSignalScore: number;
}

/**
 * Unified saved-preset row from `/api/v1/strategy-params` (V29+ backend).
 *
 * Each preset is a named override map for one `account_strategy`. At most one
 * preset per account_strategy is `active` at a time; the live executor reads
 * the active preset, backtests can pin any preset by `paramId` (including
 * soft-deleted ones, which the list endpoint hides).
 */
export interface StrategyParamPreset {
  paramId: string;
  accountStrategyId: string;
  name: string;
  overrides: Record<string, unknown>;
  active: boolean;
  deleted: boolean;
  deletedAt: string | null;
  /** Originating backtest run id when the preset was saved from a run's
   *  Re-run-with-params flow. Null otherwise — wizard "Save current" and
   *  legacy {lsr,vcb,vbo}-params shims do not set this. */
  sourceBacktestRunId: string | null;
  version: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface StrategyParamCreateRequest {
  accountStrategyId: string;
  name: string;
  overrides: Record<string, unknown>;
  activate?: boolean;
  /** Originating backtest run id — sent by the Re-run-with-params "Save to
   *  library" button. Omit elsewhere. */
  sourceBacktestRunId?: string;
}
