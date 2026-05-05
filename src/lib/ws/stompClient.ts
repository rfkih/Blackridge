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
// Tracked so we can detect a provider swap on re-init (e.g. after re-login)
// and spin up a fresh client. Comparing references is enough — the auth
// hook recreates the closure when the user identity changes.
let currentTokenProvider: StompTokenProvider | null = null;
// True while we're intentionally tearing down — suppresses the spurious
// "reconnecting" flash that would otherwise fire from the final onWebSocketClose.
let intentionalDisconnect = false;
// Exponential-backoff state. Reset to 0 on successful CONNECT; incremented
// on every websocket close that wasn't intentional.
let attemptCount = 0;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
// 1 + 2 + 4 + 8 + 16 + 30 + 30 + 30 ≈ 2 minutes wall time. Past that we
// give up and surface a manual retry CTA — silent infinite reconnects mask
// real outages (server down, token expired, network gone) far worse than a
// loud "click to retry" banner.
const MAX_RETRIES = 8;

function backoffMs(attempt: number): number {
  // attempt is 1-based — attempt #1 waits 1s, #2 waits 2s, #3 waits 4s, …
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}

export function initStompClient(tokenProvider: StompTokenProvider | null): void {
  if (stompClient?.active && currentTokenProvider === tokenProvider) return;
  // Provider swapped while a client was still live — drop it so we can
  // activate a new one that will mint its own CONNECT credential.
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
    // Initial reconnect cadence — onWebSocketClose mutates this on the live
    // client to implement exponential backoff before stompjs schedules the
    // next attempt.
    reconnectDelay: BASE_DELAY_MS,
    // beforeConnect runs on the initial activate AND every reconnect, so
    // short-lived ws-tickets (≤60 s) are refreshed every attempt. Stash the
    // result in connectHeaders, which stompjs reads when it sends CONNECT.
    beforeConnect: async () => {
      if (!stompClient) return;
      try {
        const fresh = await tokenProvider();
        // Re-check after the async ticket fetch — disconnectStompClient() may
        // have run concurrently (logout, page unload) and set stompClient = null.
        if (stompClient) {
          stompClient.connectHeaders = fresh ? { Authorization: `Bearer ${fresh}` } : {};
        }
      } catch {
        // Ticket fetch failed (likely 401 on /me — cookie expired). Clear
        // the header so CONNECT fails fast with a recognizable auth error
        // instead of using a stale one. The reconnect loop will retry until
        // the user re-authenticates or the circuit breaker trips.
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
        // Circuit breaker: stop the auto-reconnect loop. The user must click
        // "Retry" (which calls retryStompClient) to spin up a fresh attempt.
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
  // Force a fresh init by clearing module state — initStompClient's
  // short-circuit otherwise treats the stored provider as still-valid.
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
  if (!client?.active) return () => {};
  const sub: StompSubscription = client.subscribe(topic, (msg) => {
    callback(msg.body);
  });
  return () => {
    try {
      sub.unsubscribe();
    } catch {
      // Client may already be torn down — ignore.
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
    // Publish can throw if the socket just closed between the active check
    // and the send; a reconnect will re-publish so we can safely swallow this.
  }
}
