'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActiveAccountSelection } from '@/types/account';

interface AccountState {
  /** `null` until hydrated. `'all'` or a specific account UUID once the user has chosen. */
  selection: ActiveAccountSelection | null;
  setSelection: (sel: ActiveAccountSelection) => void;
  /** Clears the selection (used on logout). */
  reset: () => void;
}

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

const localStorageSafe = createJSONStorage(() =>
  typeof window === 'undefined' ? noopStorage : window.localStorage,
);

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      selection: null,
      setSelection: (sel) => set({ selection: sel }),
      reset: () => set({ selection: null }),
    }),
    {
      name: 'blackheart:active-account',
      storage: localStorageSafe,
      partialize: (state) => ({ selection: state.selection }),
    },
  ),
);
