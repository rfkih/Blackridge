'use client';

import { useEffect } from 'react';
import { subscribeToTopic } from '@/lib/ws/stompClient';
import { useWsStore } from '@/store/wsStore';
import { usePositionStore } from '@/store/positionStore';
import type { PnlUpdate } from '@/types/trading';

export function useLivePnl(accountId: string | undefined) {
  const connected = useWsStore((s) => s.connected);
  const updatePnl = usePositionStore((s) => s.updatePnl);

  useEffect(() => {
    if (!connected || !accountId) return;

    const unsubscribe = subscribeToTopic(`/topic/pnl/${accountId}`, (body) => {
      try {
        const update = JSON.parse(body) as PnlUpdate;
        updatePnl(update);
      } catch {
        // ignore malformed frames
      }
    });

    return unsubscribe;
  }, [connected, accountId, updatePnl]);
}
