
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BacktestParamPreset, BacktestWizardConfig } from '@/types/backtest';

interface BacktestWizardState {
  config: BacktestWizardConfig | null;
  paramOverrides: Record<string, Record<string, unknown>>;
  activePresetName: string | null;
  /** Originating backtest run id when the wizard was hydrated via "Re-run with
   *  these params". Null on a fresh wizard or after submit. Forwarded to the
   *  Save-to-library button so saved presets can be tagged with their source. */
  sourceBacktestRunId: string | null;
  setConfig: (config: BacktestWizardConfig) => void;
  setParamOverride: (strategyCode: string, key: string, value: unknown) => void;
  resetParamOverrides: (strategyCode: string) => void;
  resetAll: () => void;
  loadPreset: (preset: BacktestParamPreset) => void;
  /**
   * Replace the entire config + overrides atomically. Used by "Re-run with
   * these params" so a partial write (config applied but overrides missed) can
   * never leave the wizard half-populated. Pass `sourceBacktestRunId` to mark
   * the wizard as derived from an existing run.
   */
  hydrateFromRun: (
    config: BacktestWizardConfig,
    paramOverrides: Record<string, Record<string, unknown>>,
    sourceBacktestRunId?: string | null,
  ) => void;
}

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
      sourceBacktestRunId: null,
      setConfig: (config) => set({ config, sourceBacktestRunId: null }),
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
      resetAll: () =>
        set({
          config: null,
          paramOverrides: {},
          activePresetName: null,
          sourceBacktestRunId: null,
        }),
      loadPreset: (preset) =>
        set((state) => ({
          paramOverrides: {
            ...state.paramOverrides,
            [preset.strategyCode]: { ...preset.overrides },
          },
          activePresetName: preset.name,
        })),
      hydrateFromRun: (config, paramOverrides, sourceBacktestRunId = null) =>
        set({ config, paramOverrides, activePresetName: null, sourceBacktestRunId }),
    }),
    {
      name: 'blackheart:backtest-wizard',
      storage: sessionStorageSafe,
      partialize: (state) => ({
        config: state.config,
        paramOverrides: state.paramOverrides,
        activePresetName: state.activePresetName,
        sourceBacktestRunId: state.sourceBacktestRunId,
      }),
    },
  ),
);
