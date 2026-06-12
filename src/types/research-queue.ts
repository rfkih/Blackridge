import type { ISO8601, UUID } from './api';

export type ResearchQueueStatus = 'PENDING' | 'RUNNING' | 'PARKED' | 'COMPLETED' | 'FAILED';

/** Mirrors backend `ResearchQueueItemResponse`. `sweepConfig` is JSONB on
 *  the wire — keep as `unknown` so callers explicitly cast/parse instead
 *  of leaning on a fragile shape. */
export interface ResearchQueueItem {
  queueId: UUID;
  priority: number;
  strategyCode: string;
  intervalName: string;
  instrument: string;
  sweepConfig: unknown;
  hypothesis: string | null;
  status: ResearchQueueStatus | string;
  iterationNumber: number;
  iterBudget: number;
  earlyStopOnNoEdge: boolean;
  requireWalkForward: boolean;
  lastIterationId: UUID | null;
  lastRunId: UUID | null;
  finalVerdict: string | null;
  walkForwardId: UUID | null;
  createdTime: ISO8601;
  createdBy: string | null;
  startedAt: ISO8601 | null;
  completedAt: ISO8601 | null;
  notes: string | null;
}

/** Payload for `POST /api/v1/research/queue`. Mirrors
 *  `CreateResearchQueueItemRequest` validation: strategyCode/intervalName
 *  non-blank, sweepConfig required, iterBudget 1..64, priority 1..1000. */
export interface CreateQueueItemRequest {
  strategyCode: string;
  intervalName: string;
  /** Defaults to BTCUSDT server-side when omitted/blank. */
  instrument?: string;
  /** Sweep grid e.g. `{ params: [{ name: 'X', values: [1,2,3] }] }`. */
  sweepConfig: unknown;
  hypothesis?: string;
  iterBudget: number;
  /** Lower number = sooner. Defaults to 100 server-side. */
  priority?: number;
  earlyStopOnNoEdge?: boolean;
  requireWalkForward?: boolean;
}

/** PATCH payload — only priority is mutable post-creation. */
export interface UpdateQueueItemRequest {
  priority: number;
}
