import { describe, expect, it } from 'vitest';
import { executionBody, executionTitle } from './NotificationPanel';
import type { TradeExecutionEvent } from '@/types/trading';

function event(overrides: Partial<TradeExecutionEvent>): TradeExecutionEvent {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    executionType: 'OPEN',
    side: 'LONG',
    status: 'SUCCESS',
    accountId: null,
    username: 'starsky',
    asset: 'ETHUSDT',
    strategyName: 'DCB',
    executionReason: null,
    errorMessage: null,
    tradeId: null,
    executedAt: '2026-06-10T23:00:04',
    ...overrides,
  };
}

describe('executionTitle', () => {
  it('labels a successful open', () => {
    expect(executionTitle(event({}))).toBe('Trade opened — LONG ETHUSDT');
  });

  it('labels a stop-loss close with the mapped reason', () => {
    expect(
      executionTitle(event({ executionType: 'CLOSE', executionReason: 'STOP_LOSS', side: 'LONG' })),
    ).toBe('Trade closed (stop loss) — LONG ETHUSDT');
  });

  it('labels a take-profit close with the mapped reason', () => {
    expect(executionTitle(event({ executionType: 'CLOSE', executionReason: 'TAKE_PROFIT' }))).toBe(
      'Trade closed (take profit) — LONG ETHUSDT',
    );
  });

  it('labels a close without a mapped reason plainly', () => {
    expect(
      executionTitle(event({ executionType: 'CLOSE', executionReason: 'custom signal flip' })),
    ).toBe('Trade closed — LONG ETHUSDT');
  });

  it('labels failed entries and closes distinctly', () => {
    expect(executionTitle(event({ status: 'FAILED' }))).toBe('Trade entry failed — LONG ETHUSDT');
    expect(executionTitle(event({ status: 'FAILED', executionType: 'CLOSE' }))).toBe(
      'Trade close failed — LONG ETHUSDT',
    );
  });

  it('tolerates a null side and asset', () => {
    expect(executionTitle(event({ side: null, asset: null }))).toBe('Trade opened — —');
  });
});

describe('executionBody', () => {
  it('prefers the error message on failures', () => {
    expect(
      executionBody(
        event({
          status: 'FAILED',
          errorMessage: 'Pre-trade validation: Estimated notional below minimum notional.',
        }),
      ),
    ).toBe('DCB · Pre-trade validation: Estimated notional below minimum notional.');
  });

  it('shows free-form entry reasons on success', () => {
    expect(executionBody(event({ executionReason: 'DCB long: donchian breakout + volume' }))).toBe(
      'DCB · DCB long: donchian breakout + volume',
    );
  });

  it('omits mapped reason codes already shown in the title', () => {
    expect(executionBody(event({ executionType: 'CLOSE', executionReason: 'TAKE_PROFIT' }))).toBe(
      'DCB',
    );
  });

  it('falls back when nothing else is available', () => {
    expect(executionBody(event({ strategyName: null }))).toBe('Execution recorded.');
  });
});
