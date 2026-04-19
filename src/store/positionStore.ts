// SLICE 1: Open positions + live unrealized P&L map (filled by WS subscriptions in slice 5).
import { create } from 'zustand';
import type { LivePosition, PnlUpdate } from '@/types/trading';

interface PositionStore {
  positions: LivePosition[];
  pnlMap: Record<string, number>;
  setPositions: (positions: LivePosition[]) => void;
  updatePnl: (update: PnlUpdate) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionStore>((set) => ({
  positions: [],
  pnlMap: {},
  setPositions: (positions) => set({ positions }),
  updatePnl: (update) =>
    set((state) => ({
      pnlMap: { ...state.pnlMap, [update.tradeId]: update.unrealizedPnl },
    })),
  reset: () => set({ positions: [], pnlMap: {} }),
}));
