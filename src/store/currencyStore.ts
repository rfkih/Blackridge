'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Display currency preference — purely a UI concern. The backend never
 * converts values on the wire; everything it returns is USDT and the frontend
 * reformats at render time via {@link useCurrencyFormatter}.
 */
export type DisplayCurrency = 'USD' | 'IDR' | 'BTC';

export const DISPLAY_CURRENCY_OPTIONS: ReadonlyArray<{
  value: DisplayCurrency;
  label: string;
  hint: string;
}> = [
  { value: 'USD', label: 'USD', hint: 'US Dollar · same unit as account balances' },
  { value: 'IDR', label: 'IDR', hint: 'Indonesian Rupiah · converted via daily ECB rate' },
  { value: 'BTC', label: 'BTC', hint: 'Bitcoin · converted via Binance spot price' },
];

interface CurrencyState {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
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

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      displayCurrency: 'USD',
      setDisplayCurrency: (c) => set({ displayCurrency: c }),
    }),
    {
      name: 'blackheart:display-currency',
      storage: localStorageSafe,
      partialize: (s) => ({ displayCurrency: s.displayCurrency }),
    },
  ),
);
