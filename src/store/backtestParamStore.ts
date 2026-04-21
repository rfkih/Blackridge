// SLICE 1: Backtest wizard state (config + per-strategy paramOverrides). Wired into UI in slice 7.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
  /**
   * Replace the entire config + overrides atomically. Used by "Re-run with
   * these params" so a partial write (config applied but overrides missed) can
   * never leave the wizard half-populated.
   */
  hydrateFromRun: (
    config: BacktestWizardConfig,
    paramOverrides: Record<string, Record<string, unknown>>,
  ) => void;
}

// SSR-safe sessionStorage shim — falls back to a no-op store on the server
// so the persist middleware doesn't blow up during prerender.
const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

const sessionStorageSafe = createJSONStorage(() =>
  typeof window === 'undefined' ? noopStorage : window.sessionStorage,
);

export const useBacktestParamStore = create<BacktestWizardState>()(
  persist(
    (set) => ({
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
      hydrateFromRun: (config, paramOverrides) =>
        set({ config, paramOverrides, activePresetName: null }),
    }),
    {
      // sessionStorage so the wizard survives an accidental refresh but doesn't
      // bleed into a different tab's run.
      name: 'blackheart:backtest-wizard',
      storage: sessionStorageSafe,
      partialize: (state) => ({
        config: state.config,
        paramOverrides: state.paramOverrides,
        activePresetName: state.activePresetName,
      }),
    },
  ),
);
