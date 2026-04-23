// SLICE 1: JWT + user state (Zustand) with persist (localStorage) + cookie mirror for middleware.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/api';
import { usePositionStore } from './positionStore';

const TOKEN_COOKIE = 'blackheart-token';
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function writeTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  const secure = process.env.NODE_ENV === 'production' ? '; secure' : '';
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; samesite=lax; max-age=${TOKEN_COOKIE_MAX_AGE}${secure}`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; samesite=lax; max-age=0${secure}`;
  }
}

interface AuthStore {
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
        writeTokenCookie(token);
        set({ token, user, isAuthenticated: true });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        writeTokenCookie(null);
        // Clear cross-store state that belongs to the previous session — leaving
        // these around bleeds yesterday's open positions/PnL into the new login.
        usePositionStore.getState().reset();
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'blackheart:token',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Keep cookie in sync with persisted token (e.g. after browser restart).
        if (state?.token) writeTokenCookie(state.token);
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
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
