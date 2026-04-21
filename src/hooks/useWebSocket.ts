'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initStompClient, disconnectStompClient } from '@/lib/ws/stompClient';
import { useAuthStore } from '@/store/authStore';
import { useWsStore } from '@/store/wsStore';

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    initStompClient(token);
    return () => {
      disconnectStompClient();
    };
  }, [token]);

  // On every false→true transition (initial connect AND reconnects), refetch
  // server state that the WS is responsible for keeping live. Per CLAUDE.md
  // we may have missed PnL frames or lifecycle events while disconnected, so
  // we reconcile via REST instead of trusting our cached snapshot.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      void queryClient.invalidateQueries({ queryKey: ['trades', 'open'] });
      void queryClient.invalidateQueries({ queryKey: ['pnl'] });
    }
    wasConnected.current = connected;
  }, [connected, queryClient]);

  const status = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';
  return { connected, reconnecting, status } as const;
}
