// Read-only client for /api/v1/spec-trace on the trading JVM. Backed by
// the spec_trace table (V19); the StrategyEngine writes one row per
// evaluate() call (dense in backtest, 1% sample in live). Drives the
// SpecTraceViewer admin UI for forensic decision replay.
import { apiClient } from './client';
import type { PageEnvelope } from '@/types/api';

export interface SpecTraceRow {
  traceId: string;
  backtestRunId: string | null;
  accountStrategyId: string | null;
  strategyCode: string;
  barTime: string | null;
  phase: string;
  decision: string;
  decisionReason: string | null;
  evalLatencyUs: number | null;
  errorClass: string | null;
  createdTime: string | null;
}

export interface SpecTraceRule {
  index?: number;
  type?: string;
  result?: boolean;
  value?: unknown;
  [key: string]: unknown;
}

export interface SpecTraceDetail extends SpecTraceRow {
  specSnapshot: Record<string, unknown> | null;
  rules: SpecTraceRule[] | null;
  errorMessage: string | null;
}

export type SpecTracePage = PageEnvelope<SpecTraceRow>;

export interface ListSpecTraceParams {
  backtestRunId?: string;
  accountStrategyId?: string;
  strategyCode?: string;
  phase?: string;
  decision?: string;
  errorsOnly?: boolean;
  page?: number;
  size?: number;
}

export async function listSpecTraces(opts: ListSpecTraceParams = {}): Promise<SpecTracePage> {
  const params: Record<string, string | number | boolean> = {
    page: opts.page ?? 0,
    size: opts.size ?? 50,
  };
  if (opts.backtestRunId) params.backtestRunId = opts.backtestRunId;
  if (opts.accountStrategyId) params.accountStrategyId = opts.accountStrategyId;
  if (opts.strategyCode) params.strategyCode = opts.strategyCode;
  if (opts.phase) params.phase = opts.phase;
  if (opts.decision) params.decision = opts.decision;
  if (opts.errorsOnly) params.errorsOnly = true;
  const { data } = await apiClient.get<SpecTracePage>('/api/v1/spec-trace', {
    params,
  });
  return data;
}

export async function getSpecTrace(id: string): Promise<SpecTraceDetail> {
  const { data } = await apiClient.get<SpecTraceDetail>(`/api/v1/spec-trace/${id}`);
  return data;
}
