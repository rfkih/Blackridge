'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';
import { DEFAULT_INDICATORS } from '@/lib/charts/indicatorConfig';

function load(key: string): ChartIndicators {
  if (typeof window === 'undefined') return { ...DEFAULT_INDICATORS };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_INDICATORS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...DEFAULT_INDICATORS };
    for (const k of Object.keys(next) as ChartIndicatorKey[]) {
      if (typeof parsed[k] === 'boolean') next[k] = parsed[k] as boolean;
    }
    return next;
  } catch {
    return { ...DEFAULT_INDICATORS };
  }
}

export function useChartIndicators(storageKey: string) {
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);

  // Rehydrate on mount (SSR-safe: read after mount to avoid hydration mismatch).
  useEffect(() => { setIndicators(load(storageKey)); }, [storageKey]);

  const toggle = useCallback((key: ChartIndicatorKey) => {
    setIndicators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const anyActive = Object.values(indicators).some(Boolean);
  return { indicators, toggle, anyActive };
}
