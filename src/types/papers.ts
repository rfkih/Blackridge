import type { ISO8601, UUID } from './api';

export type PaperStatus = 'WORKING_PAPER' | 'FINALIZED';

// ---------------------------------------------------------------------------
// List view (GET /papers)
// ---------------------------------------------------------------------------

export interface PaperRow {
  paper_id: string;
  queue_id: UUID;
  title: string;
  abstract: string | null;
  paper_status: PaperStatus;
  version: number;
  strategy_code: string;
  instrument: string;
  interval_name: string;
  final_verdict: string | null;
  total_iterations: number | null;
  created_time: ISO8601;
  updated_time: ISO8601;
}

export interface PaperPage {
  items: PaperRow[];
  next_cursor: string | null;
  next_actions: Array<{ kind: string; method?: string; path?: string }>;
}

// ---------------------------------------------------------------------------
// Full paper (GET /papers/{id})
// ---------------------------------------------------------------------------

export interface PaperMetadata {
  strategy_code: string;
  instrument: string;
  interval_name: string;
  hypothesis: string | null;
  sweep_type: string;
  final_verdict: string | null;
  queue_status: string | null;
  n_iterations: number;
  backtest_period: { start: string | null; end: string | null };
  initial_capital: number | null;
}

export interface BestIterationMetrics {
  trade_count: number | null;
  profit_factor: number | null;
  cagr: number | null;
  return_pct: number | null;
  max_drawdown_pct: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  dsr: number | null;
  pf_ci_low: number | null;
  pf_ci_high: number | null;
}

export interface BestIteration {
  iteration_id: UUID;
  iteration_number: number | null;
  backtest_run_id: UUID | null;
  params: Record<string, unknown>;
  metrics: BestIterationMetrics;
  slippage_sensitivity: Record<string, unknown>;
  regime_breakdown: Record<string, unknown>;
  statistical_verdict: string | null;
  verdict: string | null;
  quant_audit_notes: string | null;
}

export interface TopIteration {
  iteration_number: number | null;
  params: Record<string, unknown>;
  trade_count: number | null;
  profit_factor: number | null;
  pf_ci_low: number | null;
  pf_ci_high: number | null;
  cagr: number | null;
  max_drawdown_pct: number | null;
  dsr: number | null;
  statistical_verdict: string | null;
  verdict: string | null;
}

export interface VerdictGate {
  n_trades_ok: boolean;
  n_trades_value: number;
  n_trades_threshold: number;
  pf_ci_ok: boolean;
  pf_ci_low: number | null;
  dsr_ok: boolean;
  dsr_value: number | null;
  dsr_threshold: number;
  stat_verdict_ok: boolean;
  stat_verdict: string | null;
  cagr_ok: boolean;
  cagr_value: number | null;
  cagr_threshold: number;
  all_gates_passed: boolean;
}

export interface PaperJournalEntry {
  journal_id: UUID;
  entry_type: string;
  title: string;
  content: string;
  status: string;
  structured_data: Record<string, unknown> | null;
  created_time: ISO8601;
  created_by: string | null;
}

export interface PaperCitation {
  key: string;
  text: string;
}

export interface PaperSection {
  chapter: number;
  title: string;
  body: string;
}

export interface PaperDetail {
  paper_id: string;
  queue_id: UUID;
  title: string;
  abstract: string | null;
  paper_status: PaperStatus;
  version: number;
  created_time: ISO8601;
  created_by: string | null;
  updated_time: ISO8601;
  updated_by: string | null;
  metadata: PaperMetadata;
  best_iteration: BestIteration | Record<string, never>;
  top_iterations: TopIteration[];
  robustness: {
    slippage_sensitivity: Record<string, unknown>;
    regime_breakdown: Record<string, unknown>;
  };
  verdict_gate: VerdictGate;
  journal_entries: PaperJournalEntry[];
  citations: PaperCitation[];
  sections: PaperSection[] | null;
  next_actions?: Array<{ kind: string; method: string; path: string; description?: string }>;
}

// ---------------------------------------------------------------------------
// Chart data (GET /papers/{id}/chart-data)
// ---------------------------------------------------------------------------

export interface EquityPoint {
  t: number;
  value: number;
}

export interface TradePoint {
  entry_time: ISO8601;
  exit_time: ISO8601 | null;
  side: string | null;
  pnl: number | null;
  pnl_pct: number | null;
}

export interface ChartData {
  paper_id: string;
  iteration_id: UUID;
  equity_curve: EquityPoint[];
  trades: TradePoint[];
  wf_equity_curve: EquityPoint[] | null;
  stored_at: ISO8601;
}

// ---------------------------------------------------------------------------
// Generate (POST /papers/{queue_id}/generate)
// ---------------------------------------------------------------------------

export interface GeneratedPaper {
  paper_id: string;
  queue_id: UUID;
  title: string;
  abstract: string | null;
  paper_status: PaperStatus;
  version: number;
  created_time: ISO8601;
  updated_time: ISO8601;
  next_actions: Array<{ kind: string; method: string; path: string; description?: string }>;
}
