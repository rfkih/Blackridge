import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';
import type { AccountType } from '@/types/accountType';
import type { StrategyDefinition } from '@/types/strategyDefinition';

import { NewStrategyDialog } from './NewStrategyDialog';

// --- mock the hooks the dialog reads ---
const useStrategyDefinitions = vi.fn();
const useCompatibleStrategies = vi.fn();
const useSymbolApprovals = vi.fn();
const useActiveAccount = vi.fn();
const createMutate = vi.fn();

vi.mock('@/hooks/useStrategyDefinitions', () => ({
  useStrategyDefinitions: () => useStrategyDefinitions(),
}));
vi.mock('@/hooks/useCompatibleStrategies', () => ({
  useCompatibleStrategies: () => useCompatibleStrategies(),
}));
vi.mock('@/hooks/useSymbolApprovals', () => ({
  useSymbolApprovals: () => useSymbolApprovals(),
}));
vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
}));
vi.mock('@/hooks/useStrategies', () => ({
  useCreateStrategy: () => ({ mutate: createMutate, isPending: false }),
}));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => false }));
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- native Select so SelectItem options land in the DOM as <option> ---
vi.mock('@/components/ui/select', () => {
  const R = require('react');
  return {
    Select: ({ value, onValueChange, disabled, children }: any) =>
      R.createElement(
        'select',
        { value, disabled, onChange: (e: any) => onValueChange(e.target.value) },
        children,
      ),
    SelectTrigger: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement('option', { value }, children),
    SelectValue: ({ placeholder }: any) => R.createElement(R.Fragment, null, placeholder ?? null),
  };
});

function mkDef(code: string, kind: AccountType): StrategyDefinition {
  return {
    id: `id-${code}`,
    strategyCode: code,
    strategyName: code,
    strategyType: 'archetype',
    strategyKind: kind,
    description: null,
    status: 'ACTIVE',
    archetype: kind === 'HEDGING' ? 'ensemble_trend' : null,
    archetypeVersion: null,
    specJsonb: null,
    enabled: true,
    simulated: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

const TRADING_DEFS = [mkDef('LSR', 'TRADING'), mkDef('VBO', 'TRADING')];
const HEDGING_DEFS = [mkDef('ENSEMBLE_TREND', 'HEDGING')];
const ALL_DEFS = [...TRADING_DEFS, ...HEDGING_DEFS];

const APPROVALS = [
  { symbol: 'BTCUSDT', strategyCode: 'LSR' },
  { symbol: 'BTCUSDT', strategyCode: 'VBO' },
];

function mkAccount(id: string, accountType: AccountType): AccountSummary {
  return { id, label: id, exchange: 'BINANCE', active: true, accountType } as AccountSummary;
}

function setActive(accountType: AccountType | null) {
  useActiveAccount.mockReturnValue({
    activeAccount: accountType ? mkAccount('acct', accountType) : null,
    isAll: accountType === null,
  });
}

function renderDialog(accounts: AccountSummary[]) {
  return render(
    React.createElement(NewStrategyDialog, {
      open: true,
      onOpenChange: () => {},
      accounts,
      defaultAccountId: accounts[0]?.id,
    }),
  );
}

describe('NewStrategyDialog — kind-filtered picker', () => {
  beforeEach(() => {
    useStrategyDefinitions.mockReset();
    useCompatibleStrategies.mockReset();
    useSymbolApprovals.mockReset();
    useActiveAccount.mockReset();
    createMutate.mockReset();
    useSymbolApprovals.mockReturnValue({ data: APPROVALS, isLoading: false });
  });

  it('under a TRADING account, lists only approval-gated trading strategies', () => {
    setActive('TRADING');
    useStrategyDefinitions.mockReturnValue({ data: ALL_DEFS, isLoading: false });
    useCompatibleStrategies.mockReturnValue({
      data: TRADING_DEFS,
      isLoading: false,
      isError: false,
    });

    renderDialog([mkAccount('acct', 'TRADING')]);

    // approval-gated trading codes are offered
    expect(screen.getByText('LSR')).toBeInTheDocument();
    expect(screen.getByText('VBO')).toBeInTheDocument();
    // hedging codes never appear
    expect(screen.queryByText('ENSEMBLE_TREND')).not.toBeInTheDocument();
  });

  it('under a HEDGING account, lists hedging strategies and skips the symbol-approval gate', () => {
    setActive('HEDGING');
    useStrategyDefinitions.mockReturnValue({ data: ALL_DEFS, isLoading: false });
    useCompatibleStrategies.mockReturnValue({
      data: HEDGING_DEFS,
      isLoading: false,
      isError: false,
    });
    // No hedging approvals exist — the gate must be skipped for the option to show.
    useSymbolApprovals.mockReturnValue({ data: APPROVALS, isLoading: false });

    renderDialog([mkAccount('acct', 'HEDGING')]);

    expect(screen.getByText('ENSEMBLE_TREND')).toBeInTheDocument();
    // trading codes are filtered out for a hedging account
    expect(screen.queryByText('LSR')).not.toBeInTheDocument();
    expect(screen.queryByText('VBO')).not.toBeInTheDocument();
    // the approval warning copy is NOT shown for hedging
    expect(screen.queryByText(/No strategies are validated/i)).not.toBeInTheDocument();
  });

  // --- isHedging must track the SELECTED account in the dropdown, not the
  //     globally-active account context (the dialog can bind to any account). ---

  it('active=TRADING but selected dropdown account is HEDGING → hedging picker, no approval gate', () => {
    // Active context is a TRADING account…
    setActive('TRADING');
    useStrategyDefinitions.mockReturnValue({ data: ALL_DEFS, isLoading: false });
    useCompatibleStrategies.mockReturnValue({
      data: HEDGING_DEFS,
      isLoading: false,
      isError: false,
    });
    useSymbolApprovals.mockReturnValue({ data: APPROVALS, isLoading: false });

    // …but the dialog defaults to (and the dropdown selects) the HEDGING account.
    render(
      React.createElement(NewStrategyDialog, {
        open: true,
        onOpenChange: () => {},
        accounts: [mkAccount('trade-acct', 'TRADING'), mkAccount('hedge-acct', 'HEDGING')],
        defaultAccountId: 'hedge-acct',
      }),
    );

    // The picker follows the SELECTED hedging account → hedging strategy listed.
    expect(screen.getByText('ENSEMBLE_TREND')).toBeInTheDocument();
    expect(screen.queryByText('LSR')).not.toBeInTheDocument();
    // …and the symbol-approval warning is skipped (hedging path).
    expect(screen.queryByText(/No strategies are validated/i)).not.toBeInTheDocument();
  });

  it('active=HEDGING but selected dropdown account is TRADING → trading picker + approval gate', () => {
    // Active context is a HEDGING account…
    setActive('HEDGING');
    useStrategyDefinitions.mockReturnValue({ data: ALL_DEFS, isLoading: false });
    useCompatibleStrategies.mockReturnValue({
      data: HEDGING_DEFS,
      isLoading: false,
      isError: false,
    });
    useSymbolApprovals.mockReturnValue({ data: APPROVALS, isLoading: false });

    // …but the dialog defaults to (and the dropdown selects) the TRADING account.
    render(
      React.createElement(NewStrategyDialog, {
        open: true,
        onOpenChange: () => {},
        accounts: [mkAccount('hedge-acct', 'HEDGING'), mkAccount('trade-acct', 'TRADING')],
        defaultAccountId: 'trade-acct',
      }),
    );

    // The picker follows the SELECTED trading account → approval-gated trading codes.
    expect(screen.getByText('LSR')).toBeInTheDocument();
    expect(screen.getByText('VBO')).toBeInTheDocument();
    expect(screen.queryByText('ENSEMBLE_TREND')).not.toBeInTheDocument();
  });
});
