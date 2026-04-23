'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { initStompClient, disconnectStompClient } from '@/lib/ws/stompClient';
import { useAuthStore } from '@/store/authStore';
import { useWsStore } from '@/store/wsStore';

interface WsTicket {
  ticket: string;
  expiresInSeconds: number;
}

async function fetchWsTicket(): Promise<string> {
  // The HttpOnly auth cookie authenticates this call. The backend returns a
  // short-lived (≤60 s) JWT that we pass in the STOMP CONNECT frame's
  // Authorization header — the only auth mechanism the STOMP interceptor
  // accepts.
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

  // Fetch a short-lived WS ticket whenever we're authenticated but don't have
  // an in-memory JWT (e.g. after a page refresh — the HttpOnly cookie still
  // authenticates, but the in-memory Bearer is gone). If the in-memory token
  // is present (immediately after login), use it directly.
  const [wsToken, setWsToken] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      setWsToken(null);
      return;
    }
    if (token) {
      setWsToken(token);
      return;
    }
    let cancelled = false;
    fetchWsTicket()
      .then((ticket) => {
        if (!cancelled) setWsToken(ticket);
      })
      .catch(() => {
        if (!cancelled) setWsToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, token]);

  useEffect(() => {
    if (!wsToken) return;
    initStompClient(wsToken);
    return () => {
      disconnectStompClient();
    };
  }, [wsToken]);

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
