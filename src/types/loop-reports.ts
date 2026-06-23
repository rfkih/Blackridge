import type { PageEnvelope } from './api';

/** OK | WARN | CRITICAL — drives the status pill. String-typed defensively at the edge. */
export type LoopReportStatus = 'OK' | 'WARN' | 'CRITICAL';

/**
 * One self-improvement-loop report (a daily / exec-health digest the automation emits).
 * `metrics` is a free-form snapshot (trades, failures, naked legs, carry P&L, graduates...);
 * `body` is the full markdown report.
 */
export interface LoopReportRow {
  id: string;
  reportType: string;
  reportDate: string;
  title: string;
  summary: string | null;
  status: string;
  metrics: Record<string, unknown> | null;
  body: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export type LoopReportPage = PageEnvelope<LoopReportRow>;

export interface ListLoopReportParams {
  reportType?: string;
  status?: string;
  sort?: string;
  page?: number;
  size?: number;
}
