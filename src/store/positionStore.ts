// SLICE 1: Open positions + live unrealized P&L map. Synced from REST via
// useSyncOpenPositions; updated in real time by useLivePnl. The pnlMap is
// pruned on every sync so it can never outgrow the active trade set.
import { create } from 'zustand';
import type { LivePosition, PnlUpdate } from '@/types/trading';

interface PositionStore {
  positions: LivePosition[];
  pnlMap: Record<string, number>;
  /**
   * Live mark price per open trade. Kept next to pnlMap (not folded in) so
   * per-row selectors can subscribe to either axis independently and avoid
   * rerenders when only the one they don't care about changed.
   */
  markMap: Record<string, number>;
  /**
   * Replaces the open positions list AND prunes pnlMap/markMap to only the
   * trade ids in the new list. Without the prune, the maps accumulate
   * entries for trades that have already closed.
   */
  setPositions: (positions: LivePosition[]) => void;
  updatePnl: (update: PnlUpdate) => void;
  /**
   * Coalesce many per-trade updates into a single store commit. WS frames
   * arrive with N trades at a time; dispatching one `updatePnl` per trade
   * fires N subscriber notifications and N `{...pnlMap}` spreads. This path
   * allocates the new maps exactly once per frame.
   */
  updatePnlBatch: (updates: PnlUpdate[]) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionStore>((set) => ({
  positions: [],
  pnlMap: {},
  markMap: {},
  setPositions: (positions) =>
    set((state) => {
      const activeIds = new Set(positions.map((p) => p.tradeId));
      const nextPnl: Record<string, number> = {};
      const nextMark: Record<string, number> = {};
      for (const id of Object.keys(state.pnlMap)) {
        if (activeIds.has(id)) nextPnl[id] = state.pnlMap[id];
      }
      for (const id of Object.keys(state.markMap)) {
        if (activeIds.has(id)) nextMark[id] = state.markMap[id];
      }
      return { positions, pnlMap: nextPnl, markMap: nextMark };
    }),
  updatePnl: (update) =>
    set((state) => ({
      pnlMap: { ...state.pnlMap, [update.tradeId]: update.unrealizedPnl },
      markMap: Number.isFinite(update.markPrice)
        ? { ...state.markMap, [update.tradeId]: update.markPrice }
        : state.markMap,
    })),
  updatePnlBatch: (updates) =>
    set((state) => {
      if (updates.length === 0) return state;
      // Skip commits entirely if nothing actually changed — spares every
      // subscriber from re-evaluating their selector.
      let pnlMutated = false;
      let markMutated = false;
      const nextPnl = { ...state.pnlMap };
      const nextMark = { ...state.markMap };
      for (const u of updates) {
        if (nextPnl[u.tradeId] !== u.unrealizedPnl) {
          nextPnl[u.tradeId] = u.unrealizedPnl;
          pnlMutated = true;
        }
        if (Number.isFinite(u.markPrice) && nextMark[u.tradeId] !== u.markPrice) {
          nextMark[u.tradeId] = u.markPrice;
          markMutated = true;
        }
      }
      if (!pnlMutated && !markMutated) return state;
      return {
        pnlMap: pnlMutated ? nextPnl : state.pnlMap,
        markMap: markMutated ? nextMark : state.markMap,
      };
    }),
  reset: () => set({ positions: [], pnlMap: {}, markMap: {} }),
}));
