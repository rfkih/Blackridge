
import type { ISO8601, UUID } from './api';

export type StatisticalVerdict =
  | 'SIGNIFICANT_EDGE'
  | 'MARGINAL'
  | 'NO_EDGE'
  | 'INSUFFICIENT_SAMPLE'
  | 'FAILED';

export type IterationVerdict = 'PASS' | 'ITERATE' | 'DISCARD' | 'FAILED';

export type QueueStatus = 'PENDING' | 'RUNNING' | 'PARKED' | 'COMPLETED' | 'FAILED';

export type Numeric = number | string;

export interface LeaderboardRow {
  iteration_id: UUID;
  iteration_number: number;
  strategy_code: string;
  verdict: IterationVerdict | null;
  statistical_verdict: StatisticalVerdict | null;
  pf: Numeric | null;
  pf_lo: Numeric | null;
  pf_hi: Numeric | null;
  return_pct: Numeric | null;
  sharpe: Numeric | null;
  trade_count: number | null;
  sample_size_adequate: boolean | null;
  git_commit_hash: string | null;
  created_time: ISO8601;
}

export interface LeaderboardResponse {
  items: LeaderboardRow[];
  next_actions: Array<{ kind: string; method?: string; path?: string }>;
}

export interface IterationRow {
  iteration_id: UUID;
  iteration_number: number;
  strategy_code: string;
  backtest_run_id: UUID | null;
  params_snapshot: Record<string, unknown> | null;
  metrics_snapshot: Record<string, unknown> | null;
  verdict: IterationVerdict | null;
  statistical_verdict: StatisticalVerdict | null;
  confidence_intervals: Record<string, unknown> | null;
  sample_size_adequate: boolean | null;
  git_commit_hash: string | null;
  hypothesis_predicted: string | null;
  hypothesis_outcome: string | null;
  hypothesis_match: boolean | null;
  code_change_summary: string | null;
  change_reasoning: string | null;
  next_action: string | null;
  diagnostics: Record<string, unknown> | null;
  quant_audit_notes: string | null;
  created_time: ISO8601;
  created_by: string | null;
}

export interface IterationsPage {
  items: IterationRow[];
  next_cursor: string | null;
  next_actions: Array<{ kind: string; method?: string; path?: string }>;
}

export interface QueueRow {
  queue_id: UUID;
  priority: number;
  strategy_code: string;
  interval_name: string;
  instrument: string;
  sweep_config: Record<string, unknown> | null;
  hypothesis: string | null;
  status: QueueStatus;
  iteration_number: number | null;
  iter_budget: number | null;
  early_stop_on_no_edge: boolean | null;
  require_walk_forward: boolean | null;
  last_iteration_id: UUID | null;
  last_run_id: UUID | null;
  final_verdict: StatisticalVerdict | string | null;
  walk_forward_id: UUID | null;
  created_time: ISO8601;
  created_by: string | null;
  started_at: ISO8601 | null;
  completed_at: ISO8601 | null;
  notes: string | null;
}

export interface QueuePage {
  items: QueueRow[];
  next_cursor: string | null;
  next_actions: Array<{ kind: string; method?: string; path?: string }>;
}

export type JournalEntryType =
  | 'STRATEGY_OUTCOME'
  | 'CROSS_STRATEGY_FINDING'
  | 'HYPOTHESIS'
  | 'IDEA_BACKLOG'
  | 'ANTI_PATTERN'
  | 'RUN_SUMMARY';

export type JournalStatus = 'ACTIVE' | 'STALE' | 'FALSIFIED' | 'PARKED';

export interface JournalRow {
  journal_id: UUID;
  entry_type: JournalEntryType | string;
  strategy_code: string | null;
  interval_name: string | null;
  instrument: string | null;
  title: string;
  content: string;
  structured_data: Record<string, unknown> | null;
  status: JournalStatus | string;
  iteration_id_refs: UUID[] | null;
  related_journal_ids: UUID[] | null;
  created_time: ISO8601;
  created_by: string | null;
  updated_time: ISO8601;
  updated_by: string | null;
}

export interface JournalPage {
  items: JournalRow[];
  next_cursor: string | null;
  next_actions: Array<{ kind: string; method?: string; path?: string }>;
}

export interface EnqueueSweepRequest {
  strategy_code: string;
  interval_name: '5m' | '15m' | '1h' | '4h';
  instrument: string;
  sweep_config: {
    strategy: 'grid';
    params: Array<{ name: string; values: Array<number | string | boolean> }>;
  };
  hypothesis?: string | null;
  priority?: number;
  iter_budget?: number;
  early_stop_on_no_edge?: boolean;
  require_walk_forward?: boolean;
}
