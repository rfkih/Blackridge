import { Client, type StompSubscription } from '@stomp/stompjs';
import { env } from '@/lib/env';
import { useWsStore } from '@/store/wsStore';

/**
 * Async producer of the credential placed in the STOMP CONNECT
 * Authorization header. Called once per connect attempt (initial AND every
 * reconnect) so short-lived ws-tickets (≤60 s) are always fresh — a stale
 * ticket from a slow initial /me would otherwise wedge the client in an
 * infinite reconnect loop with no recovery path.
 */
export type StompTokenProvider = () => Promise<string | null>;

let stompClient: Client | null = null;

let currentTokenProvider: StompTokenProvider | null = null;

let intentionalDisconnect = false;

let attemptCount = 0;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

const MAX_RETRIES = 8;

function backoffMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}

export function initStompClient(tokenProvider: StompTokenProvider | null): void {
  if (stompClient?.active && currentTokenProvider === tokenProvider) return;

  if (stompClient) {
    intentionalDisconnect = true;
    void stompClient.deactivate();
    stompClient = null;
  }
  currentTokenProvider = tokenProvider;
  intentionalDisconnect = false;
  attemptCount = 0;
  const ws = useWsStore.getState();
  ws.setReconnectAttempts(0);
  ws.setPermanentlyDisconnected(false);

  if (!tokenProvider) return;

  stompClient = new Client({
    brokerURL: env.wsUrl,

    reconnectDelay: BASE_DELAY_MS,

    beforeConnect: async () => {
      if (!stompClient) return;
      try {
        const fresh = await tokenProvider();

        if (stompClient) {
          stompClient.connectHeaders = fresh ? { Authorization: `Bearer ${fresh}` } : {};
        }
      } catch {
        if (stompClient) stompClient.connectHeaders = {};
      }
    },
    connectHeaders: {},
    onConnect: () => {
      attemptCount = 0;
      if (stompClient) stompClient.reconnectDelay = BASE_DELAY_MS;
      const s = useWsStore.getState();
      s.setConnected(true);
      s.setReconnectAttempts(0);
      s.setPermanentlyDisconnected(false);
    },
    onDisconnect: () => {
      useWsStore.getState().setConnected(false);
    },
    onStompError: () => {
      if (intentionalDisconnect) return;
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
    },
    onWebSocketClose: () => {
      if (intentionalDisconnect) return;
      attemptCount += 1;
      const s = useWsStore.getState();
      s.setConnected(false);
      s.setReconnectAttempts(attemptCount);

      if (attemptCount > MAX_RETRIES) {
        s.setReconnecting(false);
        s.setPermanentlyDisconnected(true);
        if (stompClient) {
          stompClient.reconnectDelay = 0;
          void stompClient.deactivate();
          stompClient = null;
        }
        return;
      }

      const delay = backoffMs(attemptCount);
      if (stompClient) stompClient.reconnectDelay = delay;
      s.setReconnecting(true);
    },
    onWebSocketError: () => {
      if (intentionalDisconnect) return;
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
    },
  });

  stompClient.activate();
}

/**
 * Manual retry from the UI after the circuit breaker has tripped. Resets
 * the attempt counter and re-initialises with the same token. No-op if the
 * client is already live or if no token has ever been set.
 */
export function retryStompClient(): void {
  if (stompClient?.active) return;
  const provider = currentTokenProvider;

  currentTokenProvider = null;
  initStompClient(provider);
}

export function disconnectStompClient(): void {
  if (stompClient) {
    intentionalDisconnect = true;
    void stompClient.deactivate();
    stompClient = null;
    currentTokenProvider = null;
    attemptCount = 0;
    const s = useWsStore.getState();
    s.setConnected(false);
    s.setReconnecting(false);
    s.setPermanentlyDisconnected(false);
    s.setReconnectAttempts(0);
  }
}

export function subscribeToTopic(topic: string, callback: (body: string) => void): () => void {
  const client = stompClient;
  if (!client?.active) {
    // eslint-disable-next-line no-console -- intentional: helps diagnose broken WS setups
    console.warn('[stomp] subscribeToTopic: client not active — subscription dropped for', topic);
    return () => {};
  }
  const sub: StompSubscription = client.subscribe(topic, (msg) => {
    callback(msg.body);
  });
  return () => {
    try {
      sub.unsubscribe();
    } catch {
    }
  };
}

/**
 * STOMP SEND to an @MessageMapping-handled destination (prefix `/app`). Used
 * to opt accounts into server-side publish loops such as `/pnl.subscribe`.
 * No-ops silently when the client isn't connected; callers should re-send on
 * every `connected` transition.
 */
export function publishToApp(destination: string, body: unknown): void {
  const client = stompClient;
  if (!client?.active) return;
  try {
    client.publish({
      destination: destination.startsWith('/app')
        ? destination
        : `/app${destination.startsWith('/') ? '' : '/'}${destination}`,
      body: JSON.stringify(body ?? {}),
      headers: { 'content-type': 'application/json' },
    });
  } catch {
  }
}
