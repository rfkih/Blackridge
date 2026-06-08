import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartIndicators } from '../useChartIndicators';

describe('useChartIndicators', () => {
  beforeEach(() => localStorage.clear());
  it('starts all-off and toggles a key', () => {
    const { result } = renderHook(() => useChartIndicators('test:key'));
    expect(result.current.indicators.rsi).toBe(false);
    act(() => result.current.toggle('rsi'));
    expect(result.current.indicators.rsi).toBe(true);
    expect(result.current.anyActive).toBe(true);
  });
  it('persists to localStorage and rehydrates', () => {
    const { result, unmount } = renderHook(() => useChartIndicators('test:key'));
    act(() => result.current.toggle('ema20'));
    unmount();
    const { result: r2 } = renderHook(() => useChartIndicators('test:key'));
    expect(r2.current.indicators.ema20).toBe(true);
  });
  it('ignores unknown keys from stale storage', () => {
    localStorage.setItem('test:key', JSON.stringify({ ema20: true, bogus: true }));
    const { result } = renderHook(() => useChartIndicators('test:key'));
    expect(result.current.indicators.ema20).toBe(true);
    expect((result.current.indicators as unknown as Record<string, boolean>).bogus).toBeUndefined();
  });
});
