import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- mocks ------------------------------------------------------------------
let subscribeCb: ((body: string) => void) | null = null;
const unsubscribe = vi.fn();
const subscribeToTopic = vi.fn((_topic: string, cb: (body: string) => void) => {
  subscribeCb = cb;
  return unsubscribe;
});
vi.mock('@/lib/ws/stompClient', () => ({
  subscribeToTopic: (t: string, cb: (b: string) => void) => subscribeToTopic(t, cb),
}));

let connected = true;
vi.mock('@/store/wsStore', () => ({
  useWsStore: (selector: (s: { connected: boolean }) => unknown) => selector({ connected }),
}));

import { useLeaderboardStream } from './useLeaderboardStream';

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useLeaderboardStream', () => {
  beforeEach(() => {
    subscribeCb = null;
    connected = true;
    subscribeToTopic.mockClear();
    unsubscribe.mockClear();
  });

  it('subscribes to /topic/leaderboard and invalidates the query on a frame', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    renderHook(() => useLeaderboardStream(), { wrapper: makeWrapper(client) });

    expect(subscribeToTopic).toHaveBeenCalledWith('/topic/leaderboard', expect.any(Function));

    subscribeCb?.('{"event":"APPROVED","symbol":"BTCUSDT","strategyCode":"DCB"}');

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leaderboard', 'top-strategies'] });
  });

  it('does not subscribe while the socket is disconnected', () => {
    connected = false;
    const client = new QueryClient();

    renderHook(() => useLeaderboardStream(), { wrapper: makeWrapper(client) });

    expect(subscribeToTopic).not.toHaveBeenCalled();
  });

  it('calls unsubscribe on unmount', () => {
    const client = new QueryClient();
    const { unmount } = renderHook(() => useLeaderboardStream(), { wrapper: makeWrapper(client) });
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
