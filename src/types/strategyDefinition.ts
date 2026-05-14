import type { ISO8601, UUID } from './api';

export type StrategyDefinitionStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

export interface StrategyDefinition {
  id: UUID;
  strategyCode: string;
  strategyName: string;
  strategyType: string;
  description: string | null;
  status: StrategyDefinitionStatus | string;
  /** `LEGACY_JAVA` for hand-coded strategies (LSR/VCB/VBO); archetype name
   *  (e.g. `momentum_mean_reversion`) for spec-driven strategies (M1+). */
  archetype: string | null;
  archetypeVersion: number | null;
  /** Full spec for spec-driven strategies. `specJsonb.params` is the flat
   *  {paramKey: defaultValue} map the backtest tuner reads. Null/absent for
   *  `LEGACY_JAVA` rows. */
  specJsonb: Record<string, unknown> | null;
  /** V40 — definition-scope kill-switch. When false, the live executor skips
   *  this strategy for ALL accounts regardless of `account_strategy.enabled`. */
  enabled: boolean;
  /** V40 — definition-scope paper flag. When true, OPEN_LONG/OPEN_SHORT route
   *  to `paper_trade_run` for every account (CLOSE_x and UPDATE always real). */
  simulated: boolean;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface CreateStrategyDefinitionPayload {
  strategyCode: string;
  strategyName: string;
  strategyType: string;
  description?: string;
  status?: StrategyDefinitionStatus;
  enabled?: boolean;
  simulated?: boolean;
}

export interface UpdateStrategyDefinitionPayload {
  strategyName?: string;
  strategyType?: string;
  description?: string;
  status?: StrategyDefinitionStatus;
  enabled?: boolean;
  simulated?: boolean;
}
