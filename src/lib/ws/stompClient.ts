import { Client, type StompSubscription } from '@stomp/stompjs';
import { WS_URL } from '@/lib/constants';
import { useWsStore } from '@/store/wsStore';

let stompClient: Client | null = null;

export function initStompClient(token: string | null): void {
  if (stompClient?.active) return;

  stompClient = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5_000,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    onConnect: () => {
      const { setConnected } = useWsStore.getState();
      setConnected(true);
    },
    onDisconnect: () => {
      const { setConnected } = useWsStore.getState();
      setConnected(false);
    },
    onStompError: () => {
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
    },
    onWebSocketClose: () => {
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
    },
    onWebSocketError: () => {
      const { setConnected, setReconnecting } = useWsStore.getState();
      setConnected(false);
      setReconnecting(true);
    },
  });

  stompClient.activate();
}

export function disconnectStompClient(): void {
  if (stompClient) {
    void stompClient.deactivate();
    stompClient = null;
    useWsStore.getState().setConnected(false);
  }
}

export function subscribeToTopic(
  topic: string,
  callback: (body: string) => void,
): () => void {
  if (!stompClient?.active) return () => {};
  const sub: StompSubscription = stompClient.subscribe(topic, (msg) => {
    callback(msg.body);
  });
  return () => sub.unsubscribe();
}
