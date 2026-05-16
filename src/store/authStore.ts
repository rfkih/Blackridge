
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/api';
import { usePositionStore } from './positionStore';

const SIGNAL_COOKIE = 'blackheart-session';
const SIGNAL_MAX_AGE_SECONDS = 60 * 60 * 24;

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

        usePositionStore.getState().reset();
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'blackheart:auth',
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
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
