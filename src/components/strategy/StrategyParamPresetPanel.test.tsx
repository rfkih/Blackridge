import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StrategyParamPreset } from '@/types/strategy';

// --- mock the api module the hooks call ---
const listStrategyParams = vi.fn();
const activateStrategyParam = vi.fn();
vi.mock('@/lib/api/strategy-params', () => ({
  listStrategyParams: (...a: unknown[]) => listStrategyParams(...a),
  activateStrategyParam: (...a: unknown[]) => activateStrategyParam(...a),
  createStrategyParam: vi.fn(),
  deactivateStrategyParam: vi.fn(),
  deleteStrategyParam: vi.fn(),
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

// --- mock Select to a native <select> so onValueChange fires in jsdom ---
vi.mock('@/components/ui/select', () => {
  const R = require('react');
  return {
    Select: ({ value, onValueChange, disabled, children }: any) =>
      R.createElement(
        'select',
        {
          'aria-label': 'Parameter preset',
          value,
          disabled,
          onChange: (e: any) => onValueChange(e.target.value),
        },
        children,
      ),
    SelectTrigger: () => null,
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement('option', { value }, children),
    SelectValue: () => null,
  };
});

import { StrategyParamPresetPanel } from './StrategyParamPresetPanel';

function mkPreset(p: Partial<StrategyParamPreset>): StrategyParamPreset {
  return {
    paramId: 'p1',
    accountStrategyId: 'as1',
    name: 'Default',
    overrides: {},
    active: false,
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

function renderPanel(status: 'LIVE' | 'PAPER' | 'STOPPED' = 'PAPER') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const strategy = { id: 'as1', status } as any;
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(StrategyParamPresetPanel, { strategy }),
    ),
  );
}

describe('StrategyParamPresetPanel', () => {
  beforeEach(() => {
    listStrategyParams.mockReset();
    activateStrategyParam.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('selects the active preset and lists the others', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'Default', active: true }),
      mkPreset({ paramId: 'p2', name: 'Aggressive', overrides: { a: 1 }, active: false }),
    ]);
    renderPanel('PAPER');
    const select = (await screen.findByLabelText('Parameter preset')) as HTMLSelectElement;
    expect(select.value).toBe('p1');
    expect(screen.getByText('Aggressive')).toBeInTheDocument();
  });

  it('activates the chosen preset on select (PAPER: no confirm)', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'Default', active: true }),
      mkPreset({ paramId: 'p2', name: 'Aggressive', active: false }),
    ]);
    activateStrategyParam.mockResolvedValue(mkPreset({ paramId: 'p2', active: true }));
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderPanel('PAPER');
    const select = (await screen.findByLabelText('Parameter preset')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p2' } });
    await waitFor(() => expect(activateStrategyParam).toHaveBeenCalledWith('p2'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('prompts confirm for a LIVE strategy and skips activate when cancelled', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'Default', active: true }),
      mkPreset({ paramId: 'p2', name: 'Aggressive', active: false }),
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel('LIVE');
    const select = (await screen.findByLabelText('Parameter preset')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p2' } });
    expect(confirmSpy).toHaveBeenCalled();
    expect(activateStrategyParam).not.toHaveBeenCalled();
  });

  it('shows an error toast when activate fails (e.g. open trades)', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'Default', active: true }),
      mkPreset({ paramId: 'p2', name: 'Aggressive', active: false }),
    ]);
    activateStrategyParam.mockRejectedValue(new Error('strategy has open trades'));
    renderPanel('PAPER');
    const select = (await screen.findByLabelText('Parameter preset')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p2' } });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('renders the empty state with a manage link when there are no presets', async () => {
    listStrategyParams.mockResolvedValue([]);
    renderPanel('PAPER');
    expect(await screen.findByText(/No saved presets/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage presets/ })).toHaveAttribute(
      'href',
      '/strategies/as1/params',
    );
  });

  it('disables the dropdown while a switch is in flight', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'Default', active: true }),
      mkPreset({ paramId: 'p2', name: 'Aggressive', active: false }),
    ]);
    // never resolves → mutation stays pending
    activateStrategyParam.mockReturnValue(new Promise(() => {}));
    renderPanel('PAPER');
    const select = (await screen.findByLabelText('Parameter preset')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p2' } });
    await waitFor(() =>
      expect((screen.getByLabelText('Parameter preset') as HTMLSelectElement).disabled).toBe(true),
    );
  });

  it('renders the single preset read-only with no dropdown', async () => {
    listStrategyParams.mockResolvedValue([
      mkPreset({ paramId: 'p1', name: 'OnlyOne', overrides: { a: 1 }, active: true }),
    ]);
    renderPanel('PAPER');
    expect(await screen.findByText('OnlyOne')).toBeInTheDocument();
    expect(screen.queryByLabelText('Parameter preset')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage presets/ })).toHaveAttribute(
      'href',
      '/strategies/as1/params',
    );
  });
});
