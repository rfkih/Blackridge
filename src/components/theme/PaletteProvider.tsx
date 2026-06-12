'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Palette = 'midnight' | 'slate' | 'oxford';

const PALETTES: Palette[] = ['midnight', 'slate', 'oxford'];
const STORAGE_KEY = 'br.palette';

export const PALETTE_META: Record<
  Palette,
  { label: string; desc: string; swatch: string; accent: string }
> = {
  midnight: {
    label: 'Midnight',
    desc: 'Ink-navy brand. The default.',
    swatch: '#121924',
    accent: '#0A0E16',
  },
  slate: {
    label: 'Slate',
    desc: 'Charcoal with steel-blue accents.',
    swatch: '#2C3A4E',
    accent: '#1F2A38',
  },
  oxford: {
    label: 'Oxford',
    desc: 'Premium deep teal-navy.',
    swatch: '#143C3A',
    accent: '#0E2D2C',
  },
};

interface PaletteContextValue {
  palette: Palette;
  setPalette: (p: Palette) => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

function readInitialPalette(): Palette {
  if (typeof document === 'undefined') return 'midnight';
  const attr = document.documentElement.getAttribute('data-palette');
  if (attr && (PALETTES as string[]).includes(attr)) return attr as Palette;
  return 'midnight';
}

function applyPalette(next: Palette) {
  document.documentElement.setAttribute('data-palette', next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(readInitialPalette);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue || !(PALETTES as string[]).includes(e.newValue)) return;
      const next = e.newValue as Palette;
      applyPalette(next);
      setPaletteState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPalette = useCallback((next: Palette) => {
    applyPalette(next);
    setPaletteState(next);
  }, []);

  const value = useMemo<PaletteContextValue>(
    () => ({ palette, setPalette }),
    [palette, setPalette],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette must be used inside <PaletteProvider>');
  return ctx;
}
