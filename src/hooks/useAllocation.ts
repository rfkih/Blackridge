'use client';

import { useMemo } from 'react';
import { usePortfolio } from './usePortfolio';
import { useStrategies } from './useStrategies';
import type { AccountStrategy } from '@/types/strategy';
import type { PortfolioBalance } from '@/types/portfolio';

/**
 * Live spot allocation of a HEDGING account, derived from the existing
 * balance read (`usePortfolio`) and the active hedging binding.
 *
 * A hedging account holds both BTC and USDT spot; its "state" is a weight,
 * not a book of positions. `btcWeightPct` / `cashWeightPct` are the current
 * split of equity; `targetWeightPct` is the configured BTC target.
 */
export interface UseAllocationResult {
  /** Current BTC weight as a percentage of equity (0–100). 0 when equity is 0. */
  btcWeightPct: number;
  /** Current USDT/cash weight as a percentage of equity (0–100). */
  cashWeightPct: number;
  /** Configured BTC target weight (0–100), or `null` when the account has no
   *  hedging binding to read it from. */
  targetWeightPct: number | null;
  /** USDT value of all non-cash (BTC) holdings. */
  btcValue: number;
  /** USDT value of cash (USDT) holdings. */
  cashValue: number;
  /** Total account equity in USDT. */
  equity: number;
  isLoading: boolean;
  isError: boolean;
}

const CASH_ASSETS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI']);

/** USDT-denominated cash vs. risk (BTC/crypto) split of the balance. */
function splitBalance(balance: PortfolioBalance): { btcValue: number; cashValue: number } {
  let cashValue = 0;
  let btcValue = 0;
  for (const asset of balance.assets) {
    if (CASH_ASSETS.has(asset.asset.toUpperCase())) {
      cashValue += asset.usdtValue;
    } else {
      btcValue += asset.usdtValue;
    }
  }
  return { btcValue, cashValue };
}

/**
 * Pick the binding whose configured target we treat as the account's target
 * weight: the active (LIVE) hedging binding if present, else any hedging
 * binding. Trading bindings are ignored.
 */
function pickTargetBinding(
  strategies: AccountStrategy[],
  accountId: string,
): AccountStrategy | null {
  const hedging = strategies.filter(
    (s) => s.accountId === accountId && s.strategyKind === 'HEDGING',
  );
  if (hedging.length === 0) return null;
  return hedging.find((s) => s.status === 'LIVE') ?? hedging[0];
}

export function useAllocation(accountId: string | undefined): UseAllocationResult {
  // Scope the balance read to THIS account, not the active-account context —
  // a hedging account's allocation must reflect its own BTC/cash split even
  // when it isn't the currently-selected account.
  const portfolio = usePortfolio(accountId);
  const strategies = useStrategies();

  return useMemo(() => {
    const balance = portfolio.data;
    const equity = balance?.totalUsdt ?? 0;
    const { btcValue, cashValue } = balance ? splitBalance(balance) : { btcValue: 0, cashValue: 0 };

    // targetWeightPct: the configured BTC target for the account. We use the
    // active hedging binding's `capitalAllocationPct` as the configured target
    // — good enough until the engine exposes a live "current target" field.
    const binding =
      accountId && strategies.data ? pickTargetBinding(strategies.data, accountId) : null;

    return {
      btcWeightPct: equity > 0 ? (btcValue / equity) * 100 : 0,
      cashWeightPct: equity > 0 ? (cashValue / equity) * 100 : 0,
      targetWeightPct: binding ? binding.capitalAllocationPct : null,
      btcValue,
      cashValue,
      equity,
      isLoading: portfolio.isLoading || strategies.isLoading,
      isError: portfolio.isError || strategies.isError,
    };
  }, [
    accountId,
    portfolio.data,
    portfolio.isLoading,
    portfolio.isError,
    strategies.data,
    strategies.isLoading,
    strategies.isError,
  ]);
}
