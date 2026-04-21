'use client';

import { useEffect } from 'react';
import { publishToApp, subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';
import { usePositionStore } from '@/store/positionStore';
import type { LivePosition } from '@/types/trading';

/**
 * The backend publishes an account-level envelope on `/topic/pnl/{accountId}`:
 *
 *   {
 *     accountId, totalUnrealizedPnlAmount: "<string>",
 *     trades: [
 *       { tradeId, asset, side, status,
 *         avgEntryPrice, currentPrice, totalRemainingQty,
 *         unrealizedPnlAmount, unrealizedPnlPercent }   // all strings
 *     ]
 *   }
 *
 * We iterate each element, coerce strings → numbers, and dispatch one
 * updatePnl() per trade so the store's pnlMap stays keyed by tradeId (what
 * OpenPositionsPanel's per-row selector expects).
 */
interface BackendActiveTradePnlItem {
  tradeId: string | null;
  asset: string | null;
  side: string | null;
  status: string | null;
  avgEntryPrice: string | null;
  currentPrice: string | null;
  totalRemainingQty: string | null;
  unrealizedPnlAmount: string | null;
  unrealizedPnlPercent: string | null;
}
interface BackendActiveTradePnlEnvelope {
  accountId: string | null;
  totalUnrealizedPnlAmount: string | null;
  trades: BackendActiveTradePnlItem[] | null;
}

function numberOrNull(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function useLivePnl(accountId: string | undefined) {
  const connected = useWsStore((s) => s.connected);
  const updatePnl = usePositionStore((s) => s.updatePnl);

  useEffect(() => {
    if (!connected || !accountId) return;

    // 1) Subscribe to the destination. Must happen BEFORE we register with the
    //    backend publisher — otherwise the first frame arrives before the
    //    subscription is active and is dropped by the broker.
    const unsubscribe = subscribeToTopic(`/topic/pnl/${accountId}`, (body) => {
      try {
        const env = JSON.parse(body) as BackendActiveTradePnlEnvelope;
        const trades = env.trades ?? [];
        const ts = Date.now();
        for (const t of trades) {
          if (!t.tradeId) continue;
          const mark = numberOrNull(t.currentPrice);
          const pnl = numberOrNull(t.unrealizedPnlAmount);
          const pnlPct = numberOrNull(t.unrealizedPnlPercent);
          if (pnl == null) continue; // malformed row — skip rather than corrupt the map
          updatePnl({
            tradeId: t.tradeId,
            accountId,
            markPrice: mark ?? 0,
            unrealizedPnl: pnl,
            unrealizedPnlPct: pnlPct ?? 0,
            ts,
          });
        }
      } catch {
        // ignore malformed frames
      }
    });

    // 2) Opt this account into the backend's publish loop. The registry is
    //    idempotent, so resending on every reconnect is safe.
    publishToApp('/pnl.subscribe', { accountId });

    return unsubscribe;
  }, [connected, accountId, updatePnl]);
}

/**
 * Syncs the REST-fetched open positions list into the position store so the
 * pnlMap can be pruned to currently-open trades. Without this, pnlMap entries
 * for closed trades pile up across the session.
 */
export function useSyncOpenPositions(positions: LivePosition[] | undefined) {
  const setPositions = usePositionStore((s) => s.setPositions);
  useEffect(() => {
    if (!positions) return;
    setPositions(positions);
  }, [positions, setPositions]);
}
