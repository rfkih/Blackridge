// Auth state store. The JWT itself lives exclusively in the HttpOnly cookie
// `blackheart-token` issued by the backend on the API origin — it is NOT
// persisted to localStorage and is NOT written to document.cookie from JS.
// An XSS payload on our origin cannot lift the token.
//
// Separately we write a tiny non-sensitive SIGNAL cookie `blackheart-session`
// on the frontend origin. Next middleware route-gates on it because Next runs
// on a different origin than the API and therefore can't see the HttpOnly
// token cookie directly. The signal cookie is UX-only — spoofing it yields a
// dashboard shell whose first /me call 401s and bounces back to /login. The
// real auth is always enforced server-side.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/api';
import { usePositionStore } from './positionStore';

// Matches the middleware's cookie name + Spring's JWT cookie TTL default
// (15 min). Short TTL on the signal keeps idle tabs from lingering with a
// "logged in" UX shell after the server session has already expired.
const SIGNAL_COOKIE = 'blackheart-session';
const SIGNAL_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day ceiling — /me call is the real gate.

function writeSignalCookie(present: boolean) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
  if (present) {
    document.cookie = `${SIGNAL_COOKIE}=1; path=/; samesite=lax; max-age=${SIGNAL_MAX_AGE_SECONDS}${secure}`;
  } else {
    document.cookie = `${SIGNAL_COOKIE}=; path=/; samesite=lax; max-age=0${secure}`;
  }
}

interface AuthStore {
  /** In-memory only. Not persisted. Lost on hard refresh. */
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        writeSignalCookie(true);
        set({ token, user, isAuthenticated: true });
      },
      setUser: (user) => {
        writeSignalCookie(true);
        set({ user, isAuthenticated: true });
      },
      clearAuth: () => {
        writeSignalCookie(false);
        // Clear cross-store state that belongs to the previous session — leaving
        // these around bleeds yesterday's open positions/PnL into the new login.
        usePositionStore.getState().reset();
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'blackheart:auth',
      storage: createJSONStorage(() => localStorage),
      // Persist only non-sensitive profile data — token and isAuthenticated
      // are rehydrated from the HttpOnly cookie via /api/v1/users/me on mount.
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Keep the signal cookie in sync with the persisted user, so a
        // reopened tab doesn't flicker through /login before /me completes.
        if (state?.user) writeSignalCookie(true);
      },
    },
  ),
);

/**
 * Returns true once Zustand's persist middleware has loaded the stored token
 * (if any) into state. Callers that gate on `isAuthenticated` or `user.role`
 * must wait for this to flip, otherwise they read the pre-hydration initial
 * state (`token: null, user: null`) and redirect authenticated users to
 * `/login` on every hard refresh.
 *
 * <p>Implementation note: the initial state is always {@code false} (no
 * synchronous call to {@code persist.hasHydrated()} during render). Calling
 * the persist API during SSR or React Suspense rehydration produces
 * "Cannot read properties of undefined (reading 'hasHydrated')" because
 * {@code useAuthStore.persist} can be momentarily {@code undefined} while
 * React is tearing down/rebuilding a dehydrated suspense boundary. Driving
 * the flip from {@code useEffect} guarantees we only read the persist API
 * client-side, after the store is fully initialised.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useAuthStore.persist;
    // Defensive: if the persist middleware didn't attach for any reason,
    // treat the store as already hydrated rather than blocking the UI.
    if (!api) {
      setHydrated(true);
      return;
    }
    if (api.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = api.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
