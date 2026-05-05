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

  // Refs so the token provider closure can read the latest values on each
  // reconnect without churning provider identity (which would re-init the
  // STOMP client every render).
  const tokenRef = useRef<string | null>(token);
  const userRef = useRef<typeof user>(user);
  tokenRef.current = token;
  userRef.current = user;

  // One stable provider per authenticated session. Called by stompjs's
  // beforeConnect hook on the initial connect AND every reconnect, so a
  // ticket that expired between attempts is replaced before CONNECT is sent.
  // Using the in-memory Bearer when present saves a round-trip on first
  // connect; falls back to ws-ticket after a refresh when the token is gone
  // but the HttpOnly cookie still authenticates.
  const tokenProvider = useMemo<StompTokenProvider | null>(() => {
    if (!user) return null;
    return async () => {
      if (!userRef.current) return null;
      if (tokenRef.current) return tokenRef.current;
      return await fetchWsTicket();
    };
    // We deliberately key the provider on the user identity (and not the
    // in-memory `token`) so that a token going stale during reconnect does
    // not reset the STOMP client — beforeConnect picks up the latest value
    // via tokenRef on the next attempt.
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

  // On every false→true transition (initial connect AND reconnects), refetch
  // server state that the WS is responsible for keeping live. Per CLAUDE.md
  // we may have missed PnL frames or lifecycle events while disconnected, so
  // we reconcile via REST instead of trusting our cached snapshot. We
  // additionally refetch the things a missed event would silently rot:
  // portfolio balance, the trade list (closes happen via WS), and active
  // account-strategies (kill-switch trips are pushed via WS).
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['pnl'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      void queryClient.invalidateQueries({ queryKey: ['account-strategies'] });
    }
    wasConnected.current = connected;
  }, [connected, queryClient]);

  const status = connected ? 'connected' : reconnecting ? 'reconnecting' : 'disconnected';
  return { connected, reconnecting, status } as const;
}
