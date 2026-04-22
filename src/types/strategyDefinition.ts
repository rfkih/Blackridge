import type { ISO8601, UUID } from './api';

export type StrategyDefinitionStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

export interface StrategyDefinition {
  id: UUID;
  strategyCode: string;
  strategyName: string;
  strategyType: string;
  description: string | null;
  status: StrategyDefinitionStatus | string;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface CreateStrategyDefinitionPayload {
  strategyCode: string;
  strategyName: string;
  strategyType: string;
  description?: string;
  status?: StrategyDefinitionStatus;
}

export interface UpdateStrategyDefinitionPayload {
  strategyName?: string;
  strategyType?: string;
  description?: string;
  status?: StrategyDefinitionStatus;
}
