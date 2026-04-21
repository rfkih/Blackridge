// SLICE 1: Open positions + live unrealized P&L map. Synced from REST via
// useSyncOpenPositions; updated in real time by useLivePnl. The pnlMap is
// pruned on every sync so it can never outgrow the active trade set.
import { create } from 'zustand';
import type { LivePosition, PnlUpdate } from '@/types/trading';

interface PositionStore {
  positions: LivePosition[];
  pnlMap: Record<string, number>;
  /**
   * Replaces the open positions list AND prunes the pnlMap to only the trade
   * ids in the new list. Without the prune, pnlMap accumulates entries for
   * trades that have already closed and never gets cleared in a long session.
   */
  setPositions: (positions: LivePosition[]) => void;
  updatePnl: (update: PnlUpdate) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionStore>((set) => ({
  positions: [],
  pnlMap: {},
  setPositions: (positions) =>
    set((state) => {
      const activeIds = new Set(positions.map((p) => p.tradeId));
      const nextPnl: Record<string, number> = {};
      for (const id of Object.keys(state.pnlMap)) {
        if (activeIds.has(id)) nextPnl[id] = state.pnlMap[id];
      }
      return { positions, pnlMap: nextPnl };
    }),
  updatePnl: (update) =>
    set((state) => ({
      pnlMap: { ...state.pnlMap, [update.tradeId]: update.unrealizedPnl },
    })),
  reset: () => set({ positions: [], pnlMap: {} }),
}));
