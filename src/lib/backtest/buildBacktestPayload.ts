import type { BacktestRunPayload, BacktestWizardConfig } from '@/types/backtest';

/**
 * Number equality at the precision users care about. Param values round-trip
 * through JSON so floating-point noise is possible; ignoring sub-1e-9 deltas
 * keeps the payload tight.
 */
function equal(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9;
  }
  return a === b;
}

/**
 * Only include fields whose override differs from the backend default. Sending
 * the full object would work, but the backend merge path handles partial diffs
 * and the slimmer payload is easier to diff in audit logs.
 */
export function computeDiff(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!equal(value, defaults[key])) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convert a YYYY-MM-DD ISO date (wizard field) to a LocalDateTime string
 * Spring Boot parses cleanly: "2024-01-01T00:00:00".
 */
function dateToLocalDateTime(isoDate: string): string {
  // Already a full timestamp? Pass through.
  if (isoDate.includes('T')) return isoDate;
  return `${isoDate}T00:00:00`;
}

/**
 * backtest_run.account_strategy_id is NOT NULL in Postgres. For multi-strategy
 * runs we don't have a single "default" — pick the first from the map so the
 * insert succeeds. The orchestrator routes per-strategy via
 * strategyAccountStrategyIds, so this choice only matters for DB integrity.
 */
function pickDefaultAccountStrategyId(
  strategyCodes: string[],
  map: Record<string, string>,
): string | undefined {
  for (const code of strategyCodes) {
    const id = map[code];
    if (id) return id;
  }
  const first = Object.values(map)[0];
  return first;
}

export function buildBacktestPayload(
  config: BacktestWizardConfig,
  paramOverrides: Record<string, Record<string, unknown>>,
  defaultParams: Record<string, Record<string, unknown>>,
): BacktestRunPayload {
  const accountStrategyId = pickDefaultAccountStrategyId(
    config.strategyCodes,
    config.strategyAccountStrategyIds,
  );
  if (!accountStrategyId) {
    throw new Error(
      'No account-strategy id available — configure at least one strategy on Step 1.',
    );
  }

  return {
    accountStrategyId,
    strategyAccountStrategyIds: config.strategyAccountStrategyIds,
    strategyCodes: config.strategyCodes,
    asset: config.symbol,
    interval: config.interval,
    startTime: dateToLocalDateTime(config.fromDate),
    endTime: dateToLocalDateTime(config.toDate),
    initialCapital: config.initialCapital,
    strategyParamOverrides: Object.fromEntries(
      config.strategyCodes.map((code) => [
        code,
        computeDiff(defaultParams[code] ?? {}, paramOverrides[code] ?? {}),
      ]),
    ),
  };
}
