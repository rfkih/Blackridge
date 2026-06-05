import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AccountType } from '@/types/accountType';
import type { StrategyDefinition } from '@/types/strategyDefinition';

// --- mock the two underlying hooks ---
const useStrategyDefinitions = vi.fn();
const useActiveAccount = vi.fn();

vi.mock('./useStrategyDefinitions', () => ({
  useStrategyDefinitions: () => useStrategyDefinitions(),
}));
vi.mock('./useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));

import { useCompatibleStrategies } from './useCompatibleStrategies';

function mkDef(code: string, kind: AccountType): StrategyDefinition {
  return {
    id: `id-${code}`,
    strategyCode: code,
    strategyName: code,
    strategyType: 'archetype',
    strategyKind: kind,
    description: null,
    status: 'ACTIVE',
    archetype: null,
    archetypeVersion: null,
    specJsonb: null,
    enabled: true,
    simulated: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

const DEFS: StrategyDefinition[] = [
  mkDef('LSR', 'TRADING'),
  mkDef('VBO', 'TRADING'),
  mkDef('DYNAMIC_TILT', 'HEDGING'),
];

/** Minimal active-account context: only the fields the hook reads. */
function mkActiveAccount(opts: { accountType?: AccountType; isAll?: boolean }) {
  return {
    isAll: opts.isAll ?? false,
    activeAccount: opts.accountType ? { accountType: opts.accountType } : null,
  };
}

describe('useCompatibleStrategies', () => {
  beforeEach(() => {
    useStrategyDefinitions.mockReset();
    useActiveAccount.mockReset();
  });

  it('returns only HEDGING definitions when a HEDGING account is active', () => {
    useStrategyDefinitions.mockReturnValue({ data: DEFS, isLoading: false, isError: false });
    useActiveAccount.mockReturnValue(mkActiveAccount({ accountType: 'HEDGING' }));

    const { result } = renderHook(() => useCompatibleStrategies());
    expect(result.current.data?.map((d) => d.strategyCode)).toEqual(['DYNAMIC_TILT']);
    expect(result.current.data?.every((d) => d.strategyKind === 'HEDGING')).toBe(true);
  });

  it('returns only TRADING definitions when a TRADING account is active', () => {
    useStrategyDefinitions.mockReturnValue({ data: DEFS, isLoading: false, isError: false });
    useActiveAccount.mockReturnValue(mkActiveAccount({ accountType: 'TRADING' }));

    const { result } = renderHook(() => useCompatibleStrategies());
    expect(result.current.data?.map((d) => d.strategyCode)).toEqual(['LSR', 'VBO']);
    expect(result.current.data?.every((d) => d.strategyKind === 'TRADING')).toBe(true);
  });

  it('returns the full unfiltered list in All mode', () => {
    useStrategyDefinitions.mockReturnValue({ data: DEFS, isLoading: false, isError: false });
    useActiveAccount.mockReturnValue(mkActiveAccount({ isAll: true }));

    const { result } = renderHook(() => useCompatibleStrategies());
    expect(result.current.data?.map((d) => d.strategyCode)).toEqual(['LSR', 'VBO', 'DYNAMIC_TILT']);
  });

  it('passes through loading and error states', () => {
    useStrategyDefinitions.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useActiveAccount.mockReturnValue(mkActiveAccount({ accountType: 'TRADING' }));
    expect(renderHook(() => useCompatibleStrategies()).result.current.isLoading).toBe(true);

    useStrategyDefinitions.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    expect(renderHook(() => useCompatibleStrategies()).result.current.isError).toBe(true);
  });

  it('returns undefined data when the underlying data is undefined', () => {
    useStrategyDefinitions.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    useActiveAccount.mockReturnValue(mkActiveAccount({ accountType: 'HEDGING' }));
    expect(renderHook(() => useCompatibleStrategies()).result.current.data).toBeUndefined();
  });
});
