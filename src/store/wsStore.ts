// SLICE 1: WebSocket connection state (consumed by status indicator + reconnect handler in slice 5).
import { create } from 'zustand';

interface WsStore {
  connected: boolean;
  reconnecting: boolean;
  setConnected: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
}

export const useWsStore = create<WsStore>((set) => ({
  connected: false,
  reconnecting: false,
  setConnected: (connected) => set({ connected, reconnecting: false }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
}));
