import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackendAccountStrategy } from '@/types/api';

// --- mock the axios client the api module calls ---
const get = vi.fn();
vi.mock('./client', () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
  },
}));

import { mapAccountStrategy } from './strategies';

function mkBackend(p: Partial<BackendAccountStrategy>): BackendAccountStrategy {
  return {
    id: 'as-1',
    accountId: 'acc-1',
    strategyCode: 'LSR',
    symbol: 'BTCUSDT',
    interval: '1h',
    enabled: true,
    simulated: false,
    capitalAllocationPct: 10,
    maxOpenPositions: 1,
    allowLong: true,
    allowShort: false,
    priorityOrder: 1,
    ...p,
  };
}

describe('mapAccountStrategy — strategyKind + archetype', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('defaults a missing strategyKind to TRADING (legacy rows)', () => {
    expect(mapAccountStrategy(mkBackend({})).strategyKind).toBe('TRADING');
  });

  it('defaults an unknown strategyKind to TRADING', () => {
    expect(mapAccountStrategy(mkBackend({ strategyKind: 'BOGUS' })).strategyKind).toBe('TRADING');
  });

  it('passes through a HEDGING strategyKind', () => {
    expect(mapAccountStrategy(mkBackend({ strategyKind: 'HEDGING' })).strategyKind).toBe('HEDGING');
  });

  it('defaults a missing archetype to LEGACY_JAVA', () => {
    expect(mapAccountStrategy(mkBackend({})).archetype).toBe('LEGACY_JAVA');
  });

  it('passes through a provided archetype', () => {
    expect(mapAccountStrategy(mkBackend({ archetype: 'ensemble_trend' })).archetype).toBe(
      'ensemble_trend',
    );
  });

  it('defaults an empty-string archetype to LEGACY_JAVA', () => {
    expect(mapAccountStrategy(mkBackend({ archetype: '' })).archetype).toBe('LEGACY_JAVA');
  });

  it('coerces a truthy minNotionalFloorEnabled (V168) to true', () => {
    expect(
      mapAccountStrategy(mkBackend({ minNotionalFloorEnabled: true })).minNotionalFloorEnabled,
    ).toBe(true);
  });

  it('defaults a missing minNotionalFloorEnabled (V168) to false', () => {
    expect(mapAccountStrategy(mkBackend({})).minNotionalFloorEnabled).toBe(false);
  });
});
