import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';

import { SwitchAccountTypeDialog } from './SwitchAccountTypeDialog';

// Passthrough the Radix dialog so content renders inline (no portal).
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

const { useAccountTypeSwitchPreview, mutate } = vi.hoisted(() => ({
  useAccountTypeSwitchPreview: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock('@/hooks/useAccounts', () => ({
  useAccountTypeSwitchPreview: (...a: unknown[]) => useAccountTypeSwitchPreview(...a),
  useSwitchAccountType: () => ({ mutate, isPending: false }),
}));
vi.mock('@/hooks/useToast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ normalizeError: (e: unknown) => String(e) }));

const ACCOUNT = {
  id: 'acc-1',
  accountType: 'TRADING',
  label: 'Main',
  exchange: 'BINANCE',
} as AccountSummary;

const PREVIEW = {
  currentType: 'TRADING',
  targetType: 'HEDGING',
  alreadyTargetType: false,
  strategiesToDisable: [
    { accountStrategyId: 's1', strategyCode: 'LSR', presetName: 'LSR base', simulated: false },
  ],
  strategiesToRestore: [
    { accountStrategyId: 's2', strategyCode: 'ENS_TREND_BTC', presetName: 'Ens', simulated: false },
  ],
  openTradesToClose: [{ tradeId: 't1', accountStrategyId: 's1', asset: 'BTCUSDT', side: 'LONG' }],
  hasLivePositions: true,
};

describe('SwitchAccountTypeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountTypeSwitchPreview.mockReturnValue({
      data: PREVIEW,
      isLoading: false,
      isError: false,
    });
  });

  it('warns about real-money closes, disables and restores', () => {
    render(<SwitchAccountTypeDialog account={ACCOUNT} open onOpenChange={() => {}} />);
    expect(screen.getByText(/Switch account to HEDGING/i)).toBeInTheDocument();
    expect(screen.getByText(/will be closed at market/i)).toBeInTheDocument();
    expect(screen.getByText(/real trades on Binance/i)).toBeInTheDocument();
    expect(screen.getByText(/LONG BTCUSDT/)).toBeInTheDocument();
    expect(screen.getByText(/will be disabled/i)).toBeInTheDocument();
    expect(screen.getByText('LSR')).toBeInTheDocument();
    expect(screen.getByText(/will be re-enabled/i)).toBeInTheDocument();
  });

  it('gates the confirm behind a live-close acknowledgement', () => {
    render(<SwitchAccountTypeDialog account={ACCOUNT} open onOpenChange={() => {}} />);
    const confirm = screen.getByRole('button', { name: /Switch to HEDGING/i });
    expect(confirm).toBeDisabled();
    // clicking while gated does nothing
    fireEvent.click(confirm);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('fires the switch mutation once the live-close box is checked', () => {
    render(<SwitchAccountTypeDialog account={ACCOUNT} open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Switch to HEDGING/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ accountId: 'acc-1', target: 'HEDGING' });
  });

  it('does not require an ack when there are no live closes', () => {
    useAccountTypeSwitchPreview.mockReturnValue({
      data: { ...PREVIEW, openTradesToClose: [], hasLivePositions: false },
      isLoading: false,
      isError: false,
    });
    render(<SwitchAccountTypeDialog account={ACCOUNT} open onOpenChange={() => {}} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Switch to HEDGING/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('shows the no-op message when nothing is affected', () => {
    useAccountTypeSwitchPreview.mockReturnValue({
      data: {
        ...PREVIEW,
        strategiesToDisable: [],
        strategiesToRestore: [],
        openTradesToClose: [],
        hasLivePositions: false,
      },
      isLoading: false,
      isError: false,
    });
    render(<SwitchAccountTypeDialog account={ACCOUNT} open onOpenChange={() => {}} />);
    expect(screen.getByText(/only the account type changes/i)).toBeInTheDocument();
  });
});
