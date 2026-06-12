import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';

import { EarnToggleCard } from './EarnToggleCard';

const useActiveAccount = vi.fn();
const useUpdateAccountEarnConfig = vi.fn();
const useEarnPosition = vi.fn();
const mutate = vi.fn();

vi.mock('@/hooks/useAccounts', () => ({
  useActiveAccount: () => useActiveAccount(),
  useUpdateAccountEarnConfig: () => useUpdateAccountEarnConfig(),
}));
vi.mock('@/hooks/useEarnPosition', () => ({
  useEarnPosition: (...a: unknown[]) => useEarnPosition(...a),
}));

function hedgingAccount(earnEnabled: boolean): AccountSummary {
  return {
    id: 'acc-1',
    userId: 'u1',
    label: 'blackheart',
    exchange: 'BNC',
    active: true,
    createdAt: '2026-01-01',
    accountType: 'HEDGING',
    maxConcurrentLongs: 1,
    maxConcurrentShorts: 0,
    maxConcurrentTrades: null,
    volTargetingEnabled: false,
    bookVolTargetPct: 15,
    earnEnabled,
  };
}

describe('EarnToggleCard', () => {
  beforeEach(() => {
    useActiveAccount.mockReset();
    useUpdateAccountEarnConfig.mockReset();
    useEarnPosition.mockReset();
    mutate.mockReset();
    useUpdateAccountEarnConfig.mockReturnValue({ mutate, isPending: false });
    useEarnPosition.mockReturnValue({ data: { enabled: false } });
  });

  it('renders nothing for a non-hedging account', () => {
    useActiveAccount.mockReturnValue({
      activeAccount: { ...hedgingAccount(false), accountType: 'TRADING' },
    });
    const { container } = render(<EarnToggleCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('optimistically shows the requested state while the mutation is in flight', () => {
    useActiveAccount.mockReturnValue({ activeAccount: hedgingAccount(false) });
    useUpdateAccountEarnConfig.mockReturnValue({
      mutate,
      isPending: true,
      variables: { accountId: 'acc-1', enabled: true },
    });
    render(<EarnToggleCard />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('toggling on calls the mutation with enabled=true', () => {
    useActiveAccount.mockReturnValue({ activeAccount: hedgingAccount(false) });
    render(<EarnToggleCard />);
    fireEvent.click(screen.getByRole('switch'));
    expect(mutate).toHaveBeenCalledWith({ accountId: 'acc-1', enabled: true }, expect.anything());
  });

  it('shows the "not yet live platform-wide" hint when opted in but master off', () => {
    useActiveAccount.mockReturnValue({ activeAccount: hedgingAccount(true) });
    useEarnPosition.mockReturnValue({ data: { enabled: false } });
    render(<EarnToggleCard />);
    expect(screen.getByText(/activates once the platform/i)).toBeInTheDocument();
  });
});
