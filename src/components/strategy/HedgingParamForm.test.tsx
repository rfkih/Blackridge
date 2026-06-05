import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import type { AccountStrategy, StrategyParamPreset } from '@/types/strategy';
import type { StrategyDefinition } from '@/types/strategyDefinition';

import { HedgingParamForm } from './HedgingParamForm';

// --- mock the strategy-params hooks ---
const useStrategyParamPresets = vi.fn();
const createMutateAsync = vi.fn();
const useCreateStrategyParam = vi.fn((_id?: string) => ({
  mutateAsync: createMutateAsync,
  isPending: false,
}));
vi.mock('@/hooks/useStrategyParams', () => ({
  useStrategyParamPresets: (id: string) => useStrategyParamPresets(id),
  useCreateStrategyParam: (id: string) => useCreateStrategyParam(id),
}));

// --- mock toast ---
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

function mkDefinition(params: Record<string, unknown>): StrategyDefinition {
  return {
    id: 'def-1',
    strategyCode: 'ENSEMBLE_TREND',
    strategyName: 'Ensemble Trend',
    strategyType: 'archetype',
    strategyKind: 'HEDGING',
    description: null,
    status: 'ACTIVE',
    archetype: 'ensemble_trend',
    archetypeVersion: 1,
    specJsonb: { params },
    enabled: true,
    simulated: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

function mkStrategy(): AccountStrategy {
  return {
    id: 'as-1',
    archetype: 'ensemble_trend',
  } as unknown as AccountStrategy;
}

function mkPreset(p: Partial<StrategyParamPreset>): StrategyParamPreset {
  return {
    paramId: 'p1',
    accountStrategyId: 'as-1',
    name: 'Active',
    overrides: {},
    active: true,
    deleted: false,
    deletedAt: null,
    sourceBacktestRunId: null,
    version: 1,
    createdAt: '2026-05-01T00:00:00Z',
    createdBy: null,
    updatedAt: '2026-05-01T00:00:00Z',
    updatedBy: null,
    ...p,
  };
}

const PARAMS = { erThreshold: 0.2, deadband: 0.1, maxWeight: 1, priceBand: 0.03 };

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(HedgingParamForm, {
        strategy: mkStrategy(),
        definition: mkDefinition(PARAMS),
      }),
    ),
  );
}

describe('HedgingParamForm', () => {
  beforeEach(() => {
    useStrategyParamPresets.mockReset();
    createMutateAsync.mockReset();
    createMutateAsync.mockResolvedValue(mkPreset({}));
    useCreateStrategyParam.mockClear();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('renders one number input per spec param defaulted to the spec value', async () => {
    useStrategyParamPresets.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderForm();

    const er = (await screen.findByLabelText('Er threshold')) as HTMLInputElement;
    const deadband = screen.getByLabelText('Deadband') as HTMLInputElement;
    const maxWeight = screen.getByLabelText('Max weight') as HTMLInputElement;
    const priceBand = screen.getByLabelText('Price band') as HTMLInputElement;

    expect(er.value).toBe('0.2');
    expect(deadband.value).toBe('0.1');
    expect(maxWeight.value).toBe('1');
    expect(priceBand.value).toBe('0.03');
  });

  it('overlays the active preset overrides on top of the spec defaults', async () => {
    useStrategyParamPresets.mockReturnValue({
      data: [mkPreset({ active: true, overrides: { erThreshold: 0.35 } })],
      isLoading: false,
      isError: false,
    });
    renderForm();

    const er = (await screen.findByLabelText('Er threshold')) as HTMLInputElement;
    expect(er.value).toBe('0.35');
    // untouched keys still fall back to the spec default
    expect((screen.getByLabelText('Deadband') as HTMLInputElement).value).toBe('0.1');
  });

  it('saves the merged overrides via the strategy-params mutation', async () => {
    useStrategyParamPresets.mockReturnValue({
      data: [mkPreset({ active: true, overrides: { erThreshold: 0.35 } })],
      isLoading: false,
      isError: false,
    });
    renderForm();

    const deadband = (await screen.findByLabelText('Deadband')) as HTMLInputElement;
    fireEvent.change(deadband, { target: { value: '0.25' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const req = createMutateAsync.mock.calls[0][0];
    expect(req.accountStrategyId).toBe('as-1');
    expect(req.activate).toBe(true);
    expect(req.overrides).toEqual({
      erThreshold: 0.35,
      deadband: 0.25,
      maxWeight: 1,
      priceBand: 0.03,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('renders an empty-state when the spec declares no params', async () => {
    useStrategyParamPresets.mockReturnValue({ data: [], isLoading: false, isError: false });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(HedgingParamForm, {
          strategy: mkStrategy(),
          definition: mkDefinition({}),
        }),
      ),
    );
    expect(await screen.findByText(/no tunable parameters/i)).toBeInTheDocument();
  });
});
