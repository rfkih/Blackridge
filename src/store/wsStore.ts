import { create } from 'zustand';

interface WsStore {
  connected: boolean;
  reconnecting: boolean;
  /** Set after MAX_RETRIES exhausted — the client has stopped trying and the
   *  user must press "Retry" to spin up a fresh connection. While true, the
   *  TopNav status pill flips to "Offline" without a pulse and the
   *  WsReconnectingBanner surfaces a manual retry CTA. */
  permanentlyDisconnected: boolean;
  /** 0 = connected (or fresh init); 1+ = current consecutive failure count.
   *  Used by the banner to show "Retry 3 / 8" so the user sees progress. */
  reconnectAttempts: number;
  setConnected: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  setPermanentlyDisconnected: (v: boolean) => void;
  setReconnectAttempts: (n: number) => void;
}

export const useWsStore = create<WsStore>((set) => ({
  connected: false,
  reconnecting: false,
  permanentlyDisconnected: false,
  reconnectAttempts: 0,
  setConnected: (connected) =>
    set(
      connected
        ? { connected, reconnecting: false, permanentlyDisconnected: false, reconnectAttempts: 0 }
        : { connected },
    ),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setPermanentlyDisconnected: (permanentlyDisconnected) =>
    set((s) => ({
      permanentlyDisconnected,

      reconnecting: permanentlyDisconnected ? false : s.reconnecting,
    })),
  setReconnectAttempts: (reconnectAttempts) => set({ reconnectAttempts }),
}));
