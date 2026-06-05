import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';

// --- mock the hook the registry reads the active account from ---
const useActiveAccount = vi.fn();
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));

import { ACCOUNT_TYPE_VIEW, useAccountView } from './registry';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return { id: 'a1', accountType: 'TRADING', ...p } as AccountSummary;
}

describe('ACCOUNT_TYPE_VIEW', () => {
  it('TRADING catalogFilter accepts TRADING and rejects HEDGING', () => {
    expect(ACCOUNT_TYPE_VIEW.TRADING.catalogFilter('TRADING')).toBe(true);
    expect(ACCOUNT_TYPE_VIEW.TRADING.catalogFilter('HEDGING')).toBe(false);
  });

  it('HEDGING catalogFilter accepts HEDGING and rejects TRADING', () => {
    expect(ACCOUNT_TYPE_VIEW.HEDGING.catalogFilter('HEDGING')).toBe(true);
    expect(ACCOUNT_TYPE_VIEW.HEDGING.catalogFilter('TRADING')).toBe(false);
  });

  it('both views carry a non-empty label and metrics', () => {
    for (const view of [ACCOUNT_TYPE_VIEW.TRADING, ACCOUNT_TYPE_VIEW.HEDGING]) {
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.metrics.length).toBeGreaterThan(0);
    }
  });

  it('exposes the expected terminology and monitor labels per type', () => {
    expect(ACCOUNT_TYPE_VIEW.TRADING.monitorLabel).toBe('Trades');
    expect(ACCOUNT_TYPE_VIEW.TRADING.terminology.event).toBe('Trade');
    expect(ACCOUNT_TYPE_VIEW.HEDGING.monitorLabel).toBe('Rebalances');
    expect(ACCOUNT_TYPE_VIEW.HEDGING.terminology.event).toBe('Rebalance');
  });
});

describe('useAccountView', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
  });

  it('returns the HEDGING view when the active account is HEDGING', () => {
    useActiveAccount.mockReturnValue({ activeAccount: mkAccount({ accountType: 'HEDGING' }) });
    const { result } = renderHook(() => useAccountView());
    expect(result.current).toBe(ACCOUNT_TYPE_VIEW.HEDGING);
  });

  it('returns the TRADING view when the active account is TRADING', () => {
    useActiveAccount.mockReturnValue({ activeAccount: mkAccount({ accountType: 'TRADING' }) });
    const { result } = renderHook(() => useAccountView());
    expect(result.current).toBe(ACCOUNT_TYPE_VIEW.TRADING);
  });

  it('falls back to the TRADING view when there is no active account ("All" mode)', () => {
    useActiveAccount.mockReturnValue({ activeAccount: null });
    const { result } = renderHook(() => useAccountView());
    expect(result.current).toBe(ACCOUNT_TYPE_VIEW.TRADING);
  });
});
