import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import type { AccountStrategy } from '@/types/strategy';
import type { StrategyDefinition } from '@/types/strategyDefinition';

import { ParametersTab } from './ParametersTab';

// --- mock the strategy-definitions catalogue lookup ---
const useStrategyDefinitions = vi.fn();
vi.mock('@/hooks/useStrategyDefinitions', () => ({
  useStrategyDefinitions: () => useStrategyDefinitions(),
}));

// --- stub the heavy legacy editors + the hedging form so we assert routing, not internals ---
vi.mock('@/components/strategy/LsrParamsForm', () => ({
  LsrParamsForm: () => React.createElement('div', null, 'LSR_EDITOR'),
}));
vi.mock('@/components/strategy/VcbParamsForm', () => ({
  VcbParamsForm: () => React.createElement('div', null, 'VCB_EDITOR'),
}));
vi.mock('@/components/strategy/HedgingParamForm', () => ({
  HedgingParamForm: ({ definition }: { definition: StrategyDefinition }) =>
    React.createElement('div', null, `HEDGING_FORM:${definition.strategyCode}`),
}));

// LSR/VCB editors fetch their defaults/params — stub those hooks to a ready state.
vi.mock('@/hooks/useStrategies', () => ({
  useLsrDefaults: () => ({ data: {}, isLoading: false, isError: false }),
  useLsrParams: () => ({ data: {}, isLoading: false }),
  useVcbDefaults: () => ({ data: {}, isLoading: false, isError: false }),
  useVcbParams: () => ({ data: {}, isLoading: false }),
}));

function mkStrategy(p: Partial<AccountStrategy>): AccountStrategy {
  return {
    id: 'as-1',
    strategyCode: 'LSR',
    strategyKind: 'TRADING',
    archetype: 'LEGACY_JAVA',
    ...p,
  } as unknown as AccountStrategy;
}

function mkDef(code: string, kind: 'TRADING' | 'HEDGING'): StrategyDefinition {
  return {
    id: `id-${code}`,
    strategyCode: code,
    strategyName: code,
    strategyType: 'archetype',
    strategyKind: kind,
    description: null,
    status: 'ACTIVE',
    archetype: kind === 'HEDGING' ? 'ensemble_trend' : 'LEGACY_JAVA',
    archetypeVersion: null,
    specJsonb: kind === 'HEDGING' ? { params: { erThreshold: 0.2 } } : null,
    enabled: true,
    simulated: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

function renderTab(strategy: AccountStrategy) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(ParametersTab, { strategy }),
    ),
  );
}

describe('ParametersTab — config form routing by kind', () => {
  beforeEach(() => {
    useStrategyDefinitions.mockReset();
    useStrategyDefinitions.mockReturnValue({
      data: [mkDef('LSR', 'TRADING'), mkDef('ENSEMBLE_TREND', 'HEDGING')],
      isLoading: false,
    });
  });

  it('renders the legacy LSR editor for a TRADING (LEGACY_JAVA) binding', () => {
    renderTab(
      mkStrategy({ strategyCode: 'LSR', strategyKind: 'TRADING', archetype: 'LEGACY_JAVA' }),
    );
    expect(screen.getByText('LSR_EDITOR')).toBeInTheDocument();
    expect(screen.queryByText(/HEDGING_FORM/)).not.toBeInTheDocument();
  });

  it('renders the HedgingParamForm for a HEDGING binding', () => {
    renderTab(
      mkStrategy({
        strategyCode: 'ENSEMBLE_TREND',
        strategyKind: 'HEDGING',
        archetype: 'ensemble_trend',
      }),
    );
    expect(screen.getByText('HEDGING_FORM:ENSEMBLE_TREND')).toBeInTheDocument();
    expect(screen.queryByText('LSR_EDITOR')).not.toBeInTheDocument();
  });
});
