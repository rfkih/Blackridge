import { Client, type StompSubscription } from '@stomp/stompjs';
import { WS_URL } from '@/lib/constants';
import { useWsStore } from '@/store/wsStore';

let stompClient: Client | null = null;
// True while we're intentionally tearing down — suppresses the spurious
// "reconnecting" flash that would otherwise fire from the final onWebSocketClose.
let intentionalDisconnect = false;

export function initStompClient(token: string | null): void {
  if (stompClient?.active) return;
  intentionalDisconnect = false;

  stompClient = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5_000,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    onConnect: () => {
      useWsStore.getState().setConnected(true);
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
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
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

export function disconnectStompClient(): void {
  if (stompClient) {
    intentionalDisconnect = true;
    void stompClient.deactivate();
    stompClient = null;
    const { setConnected, setReconnecting } = useWsStore.getState();
    setConnected(false);
    setReconnecting(false);
  }
}

export function subscribeToTopic(
  topic: string,
  callback: (body: string) => void,
): () => void {
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
