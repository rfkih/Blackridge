import { describe, it, expect } from 'vitest';

import { readPrediction } from './SignalLatestPrediction';

describe('readPrediction', () => {
  it('classifies high P(risk-on) as bullish (mirrors the gate SHORT-block at 0.70)', () => {
    const r = readPrediction(0.81, 'binary');
    expect(r.directional).toBe(true);
    expect(r.direction).toBe('bullish');
    expect(r.conviction).toBeCloseTo(0.62, 5);
  });

  it('classifies low P(risk-on) as bearish (mirrors the gate LONG-block at 0.30)', () => {
    const r = readPrediction(0.12, 'binary');
    expect(r.direction).toBe('bearish');
    expect(r.conviction).toBeCloseTo(0.76, 5);
  });

  it('treats the abstain band as neutral with low conviction', () => {
    expect(readPrediction(0.5, 'binary').direction).toBe('neutral');
    expect(readPrediction(0.5, 'binary').conviction).toBe(0);
    expect(readPrediction(0.55, 'binary').direction).toBe('neutral');
    expect(readPrediction(0.65, 'binary').direction).toBe('neutral');
  });

  it('uses strict inequality at the boundaries (0.70 / 0.30 stay neutral)', () => {
    // Matches the gate: value EXACTLY at the threshold permits the trade (uncertain, not directional).
    expect(readPrediction(0.7, 'binary').direction).toBe('neutral');
    expect(readPrediction(0.3, 'binary').direction).toBe('neutral');
    expect(readPrediction(0.7001, 'binary').direction).toBe('bullish');
    expect(readPrediction(0.2999, 'binary').direction).toBe('bearish');
  });

  it('defaults to the binary read when the objective is unknown (regime signals are binary)', () => {
    expect(readPrediction(0.9, null).direction).toBe('bullish');
    expect(readPrediction(0.9, undefined).direction).toBe('bullish');
  });

  it('caps conviction at 1.0 for the extremes', () => {
    expect(readPrediction(1, 'binary').conviction).toBe(1);
    expect(readPrediction(0, 'binary').conviction).toBe(1);
  });

  it('is non-directional for regression / multiclass / out-of-range values', () => {
    expect(readPrediction(1.7, 'regression').directional).toBe(false);
    expect(readPrediction(0.8, 'multiclass').directional).toBe(false);
    expect(readPrediction(-0.2, 'binary').directional).toBe(false);
  });
});
