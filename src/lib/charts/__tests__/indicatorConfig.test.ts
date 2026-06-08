import { describe, it, expect } from 'vitest';
import { INDICATORS, OVERLAY_KEYS, OSCILLATOR_KEYS, DEFAULT_INDICATORS } from '../indicatorConfig';

describe('indicatorConfig', () => {
  it('covers all ChartIndicators keys exactly once', () => {
    const keys = INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.slice().sort()).toEqual(
      ['adx', 'atr', 'bollingerBands', 'ema20', 'ema50', 'ema100', 'ema200', 'keltnerChannel', 'macd', 'rsi'].sort(),
    );
  });
  it('partitions into overlay and oscillator groups', () => {
    expect(OVERLAY_KEYS).toEqual(expect.arrayContaining(['ema20', 'ema50', 'ema200', 'bollingerBands', 'keltnerChannel']));
    expect(OSCILLATOR_KEYS).toEqual(expect.arrayContaining(['rsi', 'macd', 'atr', 'adx']));
    expect(OVERLAY_KEYS.some((k) => OSCILLATOR_KEYS.includes(k))).toBe(false);
  });
  it('defaults every indicator to off', () => {
    expect(Object.values(DEFAULT_INDICATORS).every((v) => v === false)).toBe(true);
  });
  it('every indicator declares at least one series with a colour', () => {
    for (const ind of INDICATORS) {
      expect(ind.series.length).toBeGreaterThan(0);
      for (const s of ind.series) expect(typeof s.color).toBe('string');
      // pill colour matches the first series colour (single source of truth)
      expect(ind.color).toBe(ind.series[0].color);
    }
  });
  it('rsi has 70/30 guides and adx has a 25 guide; overlays have none', () => {
    const byKey = Object.fromEntries(INDICATORS.map((i) => [i.key, i]));
    expect(byKey.rsi.guides).toEqual([70, 30]);
    expect(byKey.adx.guides).toEqual([25]);
    expect(byKey.ema20.guides).toBeUndefined();
  });
});
