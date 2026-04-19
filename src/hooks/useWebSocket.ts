'use client';

import { useEffect } from 'react';
import { initStompClient, disconnectStompClient } from '@/lib/ws/stompClient';
import { useAuthStore } from '@/store/authStore';
import { useWsStore } from '@/store/wsStore';

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);

  useEffect(() => {
    if (!token) return;
    initStompClient(token);
    return () => {
      disconnectStompClient();
    };
  }, [token]);

  const status = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';
  return { connected, reconnecting, status } as const;
}
