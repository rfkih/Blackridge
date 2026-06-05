import { describe, it, expect } from 'vitest';

import { mapStrategyParamPreset } from './strategy-params';

function mkBackend(overrides: Record<string, unknown>) {
  return {
    paramId: 'p1',
    accountStrategyId: 'as-1',
    name: 'Active',
    overrides,
    active: true,
    deleted: false,
    deletedAt: null,
    sourceBacktestRunId: null,
    version: 1,
    createdAt: '2026-05-01T00:00:00Z',
    createdBy: null,
    updatedAt: '2026-05-01T00:00:00Z',
    updatedBy: null,
  };
}

describe('mapStrategyParamPreset — override numeric coercion', () => {
  it('coerces a numeric-string override to a number', () => {
    const mapped = mapStrategyParamPreset(mkBackend({ erThreshold: '0.35' }));
    expect(mapped.overrides.erThreshold).toBe(0.35);
    expect(typeof mapped.overrides.erThreshold).toBe('number');
  });

  it('leaves already-numeric values unchanged', () => {
    const mapped = mapStrategyParamPreset(mkBackend({ deadband: 0.1 }));
    expect(mapped.overrides.deadband).toBe(0.1);
  });

  it('leaves genuinely non-numeric strings as-is', () => {
    const mapped = mapStrategyParamPreset(mkBackend({ mode: 'aggressive', flag: '' }));
    expect(mapped.overrides.mode).toBe('aggressive');
    expect(mapped.overrides.flag).toBe('');
  });

  it('leaves boolean / null override values untouched', () => {
    const mapped = mapStrategyParamPreset(mkBackend({ enabled: true, gate: null }));
    expect(mapped.overrides.enabled).toBe(true);
    expect(mapped.overrides.gate).toBeNull();
  });
});
