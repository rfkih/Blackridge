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

/**
 * Trade-sizing defaults the wizard doesn't collect from the user yet.
 *
 * <p>Without these, the backend persists {@code null} for {@code riskPerTradePct},
 * {@code minNotional}, {@code minQty}, {@code qtyStep}, {@code maxOpenPositions}
 * on the {@code BacktestRun} row. During execution, {@code StrategyHelper.resolveRiskPct}
 * returns {@code null} (no risk-snapshot, no runtime-config risk) → position
 * sizing bails → every signal produces a zero-sized order → the run completes
 * with <b>zero trades</b> even though signals fired. That is exactly the
 * "frontend gives 0 trades but Postman works" symptom.
 *
 * <p>These values match the shape the platform was originally tuned with.
 * Make them user-configurable (add to {@code BacktestWizardConfig} and the
 * Step-1 form) once the UX design for per-run sizing is decided.
 */
const DEFAULT_SIZING = {
  /** 0.9% of equity risked per trade. */
  riskPerTradePct: 0.9,
  /** Binance spot taker fee (0.075%). */
  feeRate: 0.00075,
  /** No slippage by default — deterministic replays. */
  slippageRate: 0,
  /** Binance min-notional ≈ $5; 7 USDT gives a safety cushion. */
  minNotional: 7,
  minQty: 0.000001,
  qtyStep: 0.000001,
  maxOpenPositions: 1,
  allowLong: true,
  allowShort: false,
} as const;

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
    // Trade-sizing fields — without these, signals fire but every position
    // sizes to zero. See DEFAULT_SIZING for the rationale behind each value.
    riskPerTradePct: DEFAULT_SIZING.riskPerTradePct,
    feeRate: DEFAULT_SIZING.feeRate,
    slippageRate: DEFAULT_SIZING.slippageRate,
    minNotional: DEFAULT_SIZING.minNotional,
    minQty: DEFAULT_SIZING.minQty,
    qtyStep: DEFAULT_SIZING.qtyStep,
    maxOpenPositions: DEFAULT_SIZING.maxOpenPositions,
    allowLong: DEFAULT_SIZING.allowLong,
    allowShort: DEFAULT_SIZING.allowShort,
    strategyParamOverrides: Object.fromEntries(
      config.strategyCodes.map((code) => [
        code,
        computeDiff(defaultParams[code] ?? {}, paramOverrides[code] ?? {}),
      ]),
    ),
  };
}
