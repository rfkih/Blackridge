'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  initStompClient,
  disconnectStompClient,
  type StompTokenProvider,
} from '@/lib/ws/stompClient';
import { useAuthStore } from '@/store/authStore';
import { useWsStore } from '@/store/wsStore';

interface WsTicket {
  ticket: string;
  expiresInSeconds: number;
}

async function fetchWsTicket(): Promise<string> {
  const { data } = await apiClient.get<WsTicket>('/api/v1/users/ws-ticket');
  if (!data?.ticket) {
    throw new Error('ws-ticket response missing ticket');
  }
  return data.ticket;
}

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const connected = useWsStore((s) => s.connected);
  const reconnecting = useWsStore((s) => s.reconnecting);
  const queryClient = useQueryClient();

  const tokenRef = useRef<string | null>(token);
  const userRef = useRef<typeof user>(user);
  tokenRef.current = token;
  userRef.current = user;

  const tokenProvider = useMemo<StompTokenProvider | null>(() => {
    if (!user) return null;
    return async () => {
      if (!userRef.current) return null;
      if (tokenRef.current) return tokenRef.current;
      return fetchWsTicket();
    };
  }, [user]);

  useEffect(() => {
    if (!tokenProvider) {
      disconnectStompClient();
      return;
    }
    initStompClient(tokenProvider);
    return () => {
      disconnectStompClient();
    };
  }, [tokenProvider]);

  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['pnl'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      // Strategy queries are keyed ['strategies', userId] — the prior
      // ['account-strategies'] matched no query, so the strategy list never
      // reconciled after a socket reconnect.
      void queryClient.invalidateQueries({ queryKey: ['strategies'] });
    }
    wasConnected.current = connected;
  }, [connected, queryClient]);

  const status = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';
  return { connected, reconnecting, status } as const;
}
