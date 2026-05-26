/**
 * Domain types for the ML visibility surface (Phase 1, 2026-05-23).
 *
 * Shapes mirror the orchestrator's Pydantic models in
 * `blackheart-research-orchestrator/src/orchestrator/api/{ml_monitor,signals}.py`
 * and the trading JVM's `MlGateResponse` / `UpdateMlGateRequest` DTOs. Keep
 * field names in lockstep with the server — if a field is renamed here,
 * rename there in the same PR.
 */

export type ModelStatus =
  | 'training'
  | 'awaiting_operator_review'
  | 'trained'
  | 'staged'
  | 'shadow'
  | 'cooling_down'
  | 'live'
  | 'retired'
  | 'rejected_by_operator';

export type SignalStatus = 'active' | 'shadow' | 'retired';

export type SignalSource = 'stream' | 'catchup_scan' | 'historical_replay';

export type HealthVerdict = 'green' | 'amber' | 'red';

// ── /ml/monitor (dashboard rollup) ─────────────────────────────────────────

export interface MlMonitorRow {
  signalId: string;
  signalName: string;
  modelSpecName: string;
  status: SignalStatus;
  symbol: string | null;
  intervalName: string | null;
  boundStrategyCodes: string[];
  health: HealthVerdict;
  healthReason: string | null;
  walkforwardAuc: number | null;
  coverage7dRatio: number | null;
  fires24h: number;
  lastFireTs: string | null;
}

export interface MlMonitorResponse {
  rows: MlMonitorRow[];
  generatedAt: string;
}

// ── /signals (list + detail) ───────────────────────────────────────────────

export interface SignalRow {
  signalId: string;
  signalName: string;
  modelId: string;
  modelSpecName: string;
  status: SignalStatus;
  symbol: string | null;
  intervalName: string | null;
  boundStrategyCodes: string[];
  createdAt: string;
  gauntletVerdict: 'PASS' | 'FAIL' | null;
}

export interface SignalListResponse {
  signals: SignalRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface SignalHealth {
  health: HealthVerdict;
  healthReason: string | null;
  lastFireTs: string | null;
  lastFireAgeSeconds: number | null;
  expectedFireSeconds: number | null;
  coverage7dRatio: number | null;
  fires24h: number;
  fires7d: number;
  walkforwardAuc: number | null;
}

export interface SignalDetail extends SignalRow {
  description: string | null;
  updatedAt: string;
  health: SignalHealth;
}

export interface FiringRow {
  signalId: string;
  symbol: string;
  ts: string;
  value: number;
  confidence: number | null;
  producedAt: string;
  source: SignalSource;
  meta: Record<string, unknown> | null;
}

export interface FiringsResponse {
  firings: FiringRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DailyCount {
  date: string; // YYYY-MM-DD
  fireCount: number;
}

export interface DailyCountsResponse {
  days: DailyCount[];
}

// ── /models (Phase 1: list + detail; promote is operator-mode only) ─────────

export interface MlModel {
  id: string;
  family: string;
  purpose: string;
  symbol: string | null;
  interval: string | null;
  horizonBars: number | null;
  status: ModelStatus;
  version: number;
  artifactSha256: string | null;
  artifactSizeBytes: number | null;
  createdTime: string;
  createdBy: string | null;
  /** Backend shape uses snake_case; we re-shape on the client. */
  metrics: Record<string, unknown> | null;
}

export interface ModelListResponse {
  models: MlModel[];
  total: number;
  limit: number;
  offset: number;
}

// ── /api/v1/account-strategies/{id}/ml-gate (trading JVM) ───────────────────

export interface MlGateConfig {
  accountStrategyId: string;
  strategyCode: string;
  gateEnabled: boolean;
  signalName: string | null;
  shadowMode: boolean;
  /** updated_time of the row after the write. */
  effectiveFromTs: string;
}

export interface ApplyMlGateRequest {
  gateEnabled: boolean;
  signalName: string | null;
  shadowMode: boolean;
  /** Operator echoes the strategy code to confirm — tamper guard on the JVM. */
  confirmedStrategyCode: string;
}

// ── /ml/streaming-status ────────────────────────────────────────────────────

export interface StreamingStatus {
  status: 'ok' | 'lagging' | 'offline';
  stalledSignals: string[];
  checkedAt: string;
  totalSignals: number;
}

// ── promotion (read-only Phase 1 spec stub; write enabled in Phase 2) ───────

export interface PromoteRequest {
  to: ModelStatus | SignalStatus;
  reason: string;
}
