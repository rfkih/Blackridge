import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PortfolioBalance } from '@/types/portfolio';
import type { AccountStrategy } from '@/types/strategy';

// --- mock the underlying reads ---
const usePortfolio = vi.fn();
const useStrategies = vi.fn();
const useEarnPosition = vi.fn();

vi.mock('./usePortfolio', () => ({
  usePortfolio: (accountId?: string) => usePortfolio(accountId),
}));
vi.mock('./useStrategies', () => ({
  useStrategies: () => useStrategies(),
}));
vi.mock('@/hooks/useEarnPosition', () => ({
  useEarnPosition: (...a: unknown[]) => useEarnPosition(...a),
}));

import { useAllocation } from './useAllocation';

const ACCOUNT_ID = 'acct-1';

function mkBalance(overrides: Partial<PortfolioBalance> = {}): PortfolioBalance {
  return {
    accountId: ACCOUNT_ID,
    totalUsdt: 10_000,
    availableUsdt: 2_500,
    lockedUsdt: 0,
    assets: [
      { asset: 'BTC', free: 0.1, locked: 0, usdtValue: 7_500 },
      { asset: 'USDT', free: 2_500, locked: 0, usdtValue: 2_500 },
    ],
    ...overrides,
  };
}

function mkHedgingStrategy(overrides: Partial<AccountStrategy> = {}): AccountStrategy {
  return {
    id: 'as-1',
    accountId: ACCOUNT_ID,
    strategyCode: 'ENSEMBLE_TREND',
    strategyKind: 'HEDGING',
    archetype: 'ensemble_trend',
    presetName: 'default',
    symbol: 'BTCUSDT',
    interval: '1d',
    status: 'LIVE',
    simulated: false,
    capitalAllocationPct: 75,
    maxOpenPositions: 1,
    allowLong: true,
    allowShort: false,
    priorityOrder: 0,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ddKillThresholdPct: 0,
    isKillSwitchTripped: false,
    killSwitchTrippedAt: null,
    killSwitchReason: null,
    regimeGateEnabled: false,
    allowedTrendRegimes: null,
    allowedVolatilityRegimes: null,
    killSwitchGateEnabled: false,
    correlationGateEnabled: false,
    concurrentCapGateEnabled: false,
    executionStyle: 'MARKET',
    kellySizingEnabled: false,
    kellyMaxFraction: 0.25,
    useRiskBasedSizing: false,
    riskPct: 0.05,
    minNotionalFloorEnabled: false,
    visibility: 'PRIVATE',
    ownedByCurrentUser: true,
    ownerLabel: 'You',
    ...overrides,
  };
}

describe('useAllocation', () => {
  beforeEach(() => {
    usePortfolio.mockReset();
    useStrategies.mockReset();
    useEarnPosition.mockReset();
    // Default: no Earn position → earnUsdt=0 → identical to the spot-only read.
    useEarnPosition.mockReturnValue({ data: { amountUsdt: 0, enabled: false } });
  });

  it('derives btc/cash weight fractions from the balance read', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({
      data: [mkHedgingStrategy()],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));

    expect(result.current.equity).toBe(10_000);
    expect(result.current.btcValue).toBe(7_500);
    expect(result.current.cashValue).toBe(2_500);
    expect(result.current.btcWeightPct).toBeCloseTo(75);
    expect(result.current.cashWeightPct).toBeCloseTo(25);
  });

  it('folds Earn USDT into cash + equity so weights are correct', () => {
    // spot: $600 BTC, $0 USDT; Earn: $400 USDT
    usePortfolio.mockReturnValue({
      data: mkBalance({
        totalUsdt: 600,
        availableUsdt: 0,
        assets: [{ asset: 'BTC', free: 0.01, locked: 0, usdtValue: 600 }],
      }),
      isLoading: false,
      isError: false,
    });
    useStrategies.mockReturnValue({ data: [mkHedgingStrategy()], isLoading: false, isError: false });
    useEarnPosition.mockReturnValue({ data: { amountUsdt: 400, enabled: true } });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.equity).toBe(1_000);
    expect(result.current.cashValue).toBe(400);
    expect(result.current.btcValue).toBe(600);
    expect(result.current.btcWeightPct).toBeCloseTo(60, 5);
    expect(result.current.cashWeightPct).toBeCloseTo(40, 5);
    expect(result.current.earnUsdt).toBe(400);
  });

  it('reads targetWeightPct from the active hedging binding capitalAllocationPct', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({
      data: [mkHedgingStrategy({ capitalAllocationPct: 100 })],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.targetWeightPct).toBe(100);
  });

  it('scopes to the given account and ignores other accounts strategies', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({
      data: [
        mkHedgingStrategy({ id: 'other', accountId: 'acct-2', capitalAllocationPct: 50 }),
        mkHedgingStrategy({ capitalAllocationPct: 75 }),
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.targetWeightPct).toBe(75);
  });

  it('prefers a LIVE hedging binding over a stopped one for the target', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({
      data: [
        mkHedgingStrategy({ id: 'stopped', status: 'STOPPED', capitalAllocationPct: 25 }),
        mkHedgingStrategy({ id: 'live', status: 'LIVE', capitalAllocationPct: 90 }),
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.targetWeightPct).toBe(90);
  });

  it('returns null targetWeightPct when no hedging binding exists', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({
      data: [mkHedgingStrategy({ strategyKind: 'TRADING', archetype: 'LEGACY_JAVA' })],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.targetWeightPct).toBeNull();
  });

  it('yields zero weights (not NaN) when equity is zero', () => {
    usePortfolio.mockReturnValue({
      data: mkBalance({ totalUsdt: 0, availableUsdt: 0, assets: [] }),
      isLoading: false,
      isError: false,
    });
    useStrategies.mockReturnValue({ data: [], isLoading: false, isError: false });

    const { result } = renderHook(() => useAllocation(ACCOUNT_ID));
    expect(result.current.btcWeightPct).toBe(0);
    expect(result.current.cashWeightPct).toBe(0);
    expect(result.current.equity).toBe(0);
  });

  it('scopes the portfolio read to the given account (not the active scope)', () => {
    usePortfolio.mockReturnValue({ data: mkBalance(), isLoading: false, isError: false });
    useStrategies.mockReturnValue({ data: [mkHedgingStrategy()], isLoading: false, isError: false });

    renderHook(() => useAllocation('acc-X'));

    expect(usePortfolio).toHaveBeenCalledWith('acc-X');
  });

  it('passes through loading and error states', () => {
    usePortfolio.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useStrategies.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    expect(renderHook(() => useAllocation(ACCOUNT_ID)).result.current.isLoading).toBe(true);

    usePortfolio.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    useStrategies.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    expect(renderHook(() => useAllocation(ACCOUNT_ID)).result.current.isError).toBe(true);
  });
});
