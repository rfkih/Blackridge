import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { AccountSummary } from '@/types/account';

// --- control the accounts list + the active account ---
const useAccounts = vi.fn();
const useActiveAccount = vi.fn();
const updateRiskMutate = vi.fn();
vi.mock('@/hooks/useAccounts', () => ({
  useAccounts: () => useAccounts(),
  useActiveAccount: () => useActiveAccount(),
  useUpdateAccountRiskConfig: () => ({ mutateAsync: updateRiskMutate, isPending: false }),
  // The account cards now embed AccountTypeControl → SwitchAccountTypeDialog,
  // which reads these (dialog starts closed, so the preview stays disabled).
  useAccountTypeSwitchPreview: () => ({ data: undefined, isLoading: false, isError: false }),
  useSwitchAccountType: () => ({ mutate: vi.fn(), isPending: false }),
}));

// --- toast no-op ---
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- next/navigation + Link need an app-router context that jsdom lacks ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: any) => {
    const R = require('react');
    return R.createElement('a', rest, children);
  },
}));

// --- ProfileSection's data/provider hooks (initial panel) — stub to no-ops ---
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Trader' }, logout: vi.fn() }) }));
vi.mock('@/hooks/useProfile', () => ({
  useUpdateMyProfile: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));
vi.mock('@/components/theme/PaletteProvider', () => ({
  usePalette: () => ({ palette: 'midnight', setPalette: vi.fn() }),
  PALETTE_META: { midnight: { label: 'Midnight', swatch: '#000', accent: '#111', desc: '' } },
}));

import SettingsPage from './page';

function mkAccount(p: Partial<AccountSummary>): AccountSummary {
  return {
    id: 'a1',
    userId: 'u1',
    label: 'Main',
    exchange: 'BNC',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    accountType: 'TRADING',
    maxConcurrentLongs: 3,
    maxConcurrentShorts: 3,
    maxConcurrentTrades: null,
    volTargetingEnabled: false,
    earnEnabled: false,
    bookVolTargetPct: 15,
    ...p,
  };
}

/** Click into the Risk guardrails nav section and return the content panel. */
function openRiskSection() {
  // The "Risk guardrails" nav button switches the panel to RiskGuardrailsSection.
  const navBtn = screen.getByRole('button', { name: 'Risk guardrails' });
  fireEvent.click(navBtn);
}

describe('SettingsPage — account-type-specific risk section', () => {
  beforeEach(() => {
    useAccounts.mockReset();
    useActiveAccount.mockReset();
    updateRiskMutate.mockReset();
  });

  it('renders the trading concurrency/vol-targeting controls for a TRADING account', () => {
    const trading = mkAccount({ id: 't1', label: 'Main', accountType: 'TRADING' });
    useAccounts.mockReturnValue({ data: [trading] });
    useActiveAccount.mockReturnValue({ activeAccount: trading, isAll: false });

    render(<SettingsPage />);
    openRiskSection();

    // trading controls present
    expect(screen.getByText('Max concurrent longs')).toBeInTheDocument();
    expect(screen.getByText('Max concurrent shorts')).toBeInTheDocument();
    expect(screen.getByText('Vol-targeting')).toBeInTheDocument();
    // hedging note absent
    expect(screen.queryByTestId('hedging-risk-note')).not.toBeInTheDocument();
  });

  it('hides trading controls and shows the hedging note for a HEDGING account', () => {
    const hedging = mkAccount({ id: 'h1', label: 'Hedge book', accountType: 'HEDGING' });
    useAccounts.mockReturnValue({ data: [hedging] });
    useActiveAccount.mockReturnValue({ activeAccount: hedging, isAll: false });

    render(<SettingsPage />);
    openRiskSection();

    // trading concurrency / vol-targeting controls are absent for hedging
    expect(screen.queryByText('Max concurrent longs')).not.toBeInTheDocument();
    expect(screen.queryByText('Max concurrent shorts')).not.toBeInTheDocument();
    expect(screen.queryByText('Vol-targeting')).not.toBeInTheDocument();

    // honest hedging note shown, pointing at per-strategy params
    const note = screen.getByTestId('hedging-risk-note');
    expect(within(note).getByText(/per-strategy/i)).toBeInTheDocument();
  });
});
