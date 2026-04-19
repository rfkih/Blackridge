// SLICE 1: Backtest wizard state (config + per-strategy paramOverrides). Wired into UI in slice 7.
import { create } from 'zustand';
import type { BacktestParamPreset, BacktestWizardConfig } from '@/types/backtest';

interface BacktestWizardState {
  config: BacktestWizardConfig | null;
  paramOverrides: Record<string, Record<string, unknown>>;
  activePresetName: string | null;
  setConfig: (config: BacktestWizardConfig) => void;
  setParamOverride: (strategyCode: string, key: string, value: unknown) => void;
  resetParamOverrides: (strategyCode: string) => void;
  resetAll: () => void;
  loadPreset: (preset: BacktestParamPreset) => void;
}

export const useBacktestParamStore = create<BacktestWizardState>((set) => ({
  config: null,
  paramOverrides: {},
  activePresetName: null,
  setConfig: (config) => set({ config }),
  setParamOverride: (strategyCode, key, value) =>
    set((state) => ({
      paramOverrides: {
        ...state.paramOverrides,
        [strategyCode]: {
          ...(state.paramOverrides[strategyCode] ?? {}),
          [key]: value,
        },
      },
      activePresetName: null,
    })),
  resetParamOverrides: (strategyCode) =>
    set((state) => {
      const next = { ...state.paramOverrides };
      delete next[strategyCode];
      return { paramOverrides: next, activePresetName: null };
    }),
  resetAll: () => set({ config: null, paramOverrides: {}, activePresetName: null }),
  loadPreset: (preset) =>
    set((state) => ({
      paramOverrides: {
        ...state.paramOverrides,
        [preset.strategyCode]: { ...preset.overrides },
      },
      activePresetName: preset.name,
    })),
}));
