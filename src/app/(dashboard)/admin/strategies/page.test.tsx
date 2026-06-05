import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { StrategyDefinition } from '@/types/strategyDefinition';

// --- admin gating: pretend we're an authed admin ---
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => true }));
vi.mock('@/store/authStore', () => ({ useAuthHydrated: () => true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

// --- the catalogue data hook ---
const useStrategyDefinitions = vi.fn();
vi.mock('@/hooks/useStrategyDefinitions', () => ({
  useStrategyDefinitions: () => useStrategyDefinitions(),
  useDeprecateStrategyDefinition: () => ({ mutate: vi.fn(), isPending: false }),
}));

// --- the dialog + sibling admin sections pull their own hooks; stub them out ---
vi.mock('@/components/admin/StrategyDefinitionDialog', () => ({
  StrategyDefinitionDialog: () => null,
}));
vi.mock('@/components/admin/symbol-approval/SymbolApprovalsSection', () => ({
  SymbolApprovalsSection: () => null,
}));
vi.mock('@/components/admin/pending-approval/PendingApprovalsSection', () => ({
  PendingApprovalsSection: () => null,
}));
vi.mock('@/components/admin/portfolio-rebalance/PortfolioRebalanceSection', () => ({
  PortfolioRebalanceSection: () => null,
}));
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import AdminStrategiesPage from './page';

function mkDef(p: Partial<StrategyDefinition>): StrategyDefinition {
  return {
    id: 'd1',
    strategyCode: 'CODE',
    strategyName: 'Name',
    strategyType: 'TREND',
    strategyKind: 'TRADING',
    description: null,
    status: 'ACTIVE',
    archetype: null,
    archetypeVersion: null,
    specJsonb: null,
    enabled: true,
    simulated: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...p,
  };
}

describe('AdminStrategiesPage — kind column', () => {
  beforeEach(() => {
    useStrategyDefinitions.mockReset();
  });

  it('renders a Kind header and the kind for a HEDGING definition row', () => {
    useStrategyDefinitions.mockReturnValue({
      data: [
        mkDef({ id: 'h1', strategyCode: 'ENSEMBLE_TREND', strategyKind: 'HEDGING' }),
        mkDef({ id: 't1', strategyCode: 'LSR_V2', strategyKind: 'TRADING' }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AdminStrategiesPage />);

    // a "Kind" column header is present
    expect(screen.getByRole('columnheader', { name: 'Kind' })).toBeInTheDocument();

    // the hedging row shows the Hedging kind
    const hedgeCodeCell = screen.getByText('ENSEMBLE_TREND');
    const hedgeRow = hedgeCodeCell.closest('tr') as HTMLElement;
    expect(within(hedgeRow).getByText('Hedging')).toBeInTheDocument();

    // the trading row shows the Trading kind
    const tradeCodeCell = screen.getByText('LSR_V2');
    const tradeRow = tradeCodeCell.closest('tr') as HTMLElement;
    expect(within(tradeRow).getByText('Trading')).toBeInTheDocument();
  });
});
