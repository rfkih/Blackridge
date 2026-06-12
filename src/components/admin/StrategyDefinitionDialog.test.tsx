import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StrategyDefinition } from '@/types/strategyDefinition';

import { StrategyDefinitionDialog } from './StrategyDefinitionDialog';

// --- mock the create/update hooks so we can assert the mutation payloads ---
const createMutate = vi.fn();
const updateMutate = vi.fn();
vi.mock('@/hooks/useStrategyDefinitions', () => ({
  useCreateStrategyDefinition: () => ({ mutate: createMutate, isPending: false }),
  useUpdateStrategyDefinition: () => ({ mutate: updateMutate, isPending: false }),
}));

// --- toast no-op ---
vi.mock('@/hooks/useToast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- mock the Radix Select to native <select> (jsdom-friendly). The
//     strategy-kind picker uses AccountTypeSelector (segmented buttons) and
//     stays REAL so we exercise the real wiring. ---
vi.mock('@/components/ui/select', () => {
  const R = require('react');
  return {
    Select: ({ value, onValueChange, disabled, children }: any) =>
      R.createElement(
        'select',
        { value, disabled, onChange: (e: any) => onValueChange(e.target.value) },
        children,
      ),
    SelectTrigger: () => null,
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement('option', { value }, children),
    SelectValue: () => null,
  };
});

function mkDef(p: Partial<StrategyDefinition>): StrategyDefinition {
  return {
    id: 'd1',
    strategyCode: 'ENSEMBLE_TREND',
    strategyName: 'Ensemble Trend',
    strategyType: 'TREND',
    strategyKind: 'HEDGING',
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

describe('StrategyDefinitionDialog — strategy_kind picker', () => {
  beforeEach(() => {
    createMutate.mockReset();
    updateMutate.mockReset();
  });

  it('defaults create to TRADING and submits strategyKind:TRADING', async () => {
    const user = userEvent.setup();
    render(<StrategyDefinitionDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText('LSR_V3'), 'NEW_CODE');
    await user.type(screen.getByPlaceholderText('Long/Short Regime v3'), 'New strategy');

    // kind selector defaults to TRADING — untouched
    expect(screen.getByRole('button', { name: /Trading/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Register strategy/ }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      strategyCode: 'NEW_CODE',
      strategyKind: 'TRADING',
    });
  });

  it('submits strategyKind:HEDGING after selecting Hedging on create', async () => {
    const user = userEvent.setup();
    render(<StrategyDefinitionDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText('LSR_V3'), 'HEDGE_CODE');
    await user.type(screen.getByPlaceholderText('Long/Short Regime v3'), 'Hedge strategy');

    await user.click(screen.getByRole('button', { name: /Hedging/ }));
    await user.click(screen.getByRole('button', { name: /Register strategy/ }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({ strategyKind: 'HEDGING' });
  });

  it('prefills strategyKind from the definition on edit and submits it in the update payload', async () => {
    const user = userEvent.setup();
    render(
      <StrategyDefinitionDialog
        open
        onOpenChange={() => {}}
        existing={mkDef({ strategyKind: 'HEDGING' })}
      />,
    );

    // prefilled to HEDGING
    expect(screen.getByRole('button', { name: /Hedging/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0].payload).toMatchObject({ strategyKind: 'HEDGING' });
  });
});
