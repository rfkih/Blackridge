import { describe, it, expect } from 'vitest';
import { defaultIntervalForSpan } from './defaultInterval';

const DAY = 86_400_000;

describe('defaultIntervalForSpan', () => {
  it('uses 15m for short (≤4d) windows', () => {
    expect(defaultIntervalForSpan(0)).toBe('15m');
    expect(defaultIntervalForSpan(2 * DAY)).toBe('15m');
    expect(defaultIntervalForSpan(4 * DAY)).toBe('15m');
  });

  it('uses 1h for ≤16d windows', () => {
    expect(defaultIntervalForSpan(5 * DAY)).toBe('1h');
    expect(defaultIntervalForSpan(16 * DAY)).toBe('1h');
  });

  it('uses 4h for ≤66d windows', () => {
    expect(defaultIntervalForSpan(17 * DAY)).toBe('4h');
    expect(defaultIntervalForSpan(66 * DAY)).toBe('4h');
  });

  it('uses 1d for long (>66d) windows', () => {
    expect(defaultIntervalForSpan(67 * DAY)).toBe('1d');
    expect(defaultIntervalForSpan(365 * DAY)).toBe('1d');
  });

  it('falls back to 15m for non-finite spans', () => {
    expect(defaultIntervalForSpan(NaN)).toBe('15m');
  });
});
