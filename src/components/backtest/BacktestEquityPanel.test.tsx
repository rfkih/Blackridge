import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { BacktestEquityPanel } from './BacktestEquityPanel';
import type { BacktestEquityPoint } from '@/types/backtest';
import type { CandleData } from '@/types/market';

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client: qc }, ui));
}

const SEC = 1_000;

// equity ts is epoch-ms; candle time is epoch-seconds (per the candles mapper)
const EQUITY: BacktestEquityPoint[] = [
  {
    ts: 1_000 * SEC,
    equity: 10_000,
    drawdown: 0,
    drawdownPct: 0,
    assetValue: 6_000,
    cashBalance: 4_000,
  },
  {
    ts: 2_000 * SEC,
    equity: 11_000,
    drawdown: 0,
    drawdownPct: -2,
    assetValue: 7_000,
    cashBalance: 4_000,
  },
  {
    ts: 3_000 * SEC,
    equity: 12_500,
    drawdown: 0,
    drawdownPct: 0,
    assetValue: 8_500,
    cashBalance: 4_000,
  },
];

// composition all-zero → the panel must NOT offer the composition toggles
const EQUITY_NO_COMPOSITION: BacktestEquityPoint[] = [
  { ts: 1_000 * SEC, equity: 10_000, drawdown: 0, drawdownPct: 0, assetValue: 0, cashBalance: 0 },
  { ts: 2_000 * SEC, equity: 11_000, drawdown: 0, drawdownPct: -2, assetValue: 0, cashBalance: 0 },
];

const CANDLES: CandleData[] = [
  { time: 1_000, open: 100, high: 101, low: 99, close: 100, volume: 1 },
  { time: 2_000, open: 100, high: 121, low: 100, close: 120, volume: 1 },
  { time: 3_000, open: 120, high: 151, low: 120, close: 150, volume: 1 },
];

describe('BacktestEquityPanel — buy-hold overlay', () => {
  it('shows the buy-hold legend with the symbol when candles + symbol are provided', () => {
    renderWithClient(
      <BacktestEquityPanel
        points={EQUITY}
        initialCapital={10_000}
        candles={CANDLES}
        symbol="BTCUSDT"
      />,
    );
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Buy & Hold BTCUSDT')).toBeInTheDocument();
  });

  it('renders only the strategy line (no overlay) when no candles are provided', () => {
    renderWithClient(<BacktestEquityPanel points={EQUITY} initialCapital={10_000} />);
    // legend / toggle for buy-hold must not appear
    expect(screen.queryByText(/Buy & Hold/)).not.toBeInTheDocument();
    expect(screen.queryByText('Show buy & hold')).not.toBeInTheDocument();
    // the equity panel still renders
    expect(screen.getByText('Equity Curve')).toBeInTheDocument();
  });

  it('exposes a toggle (default on) to show/hide the buy-hold line', () => {
    renderWithClient(
      <BacktestEquityPanel
        points={EQUITY}
        initialCapital={10_000}
        candles={CANDLES}
        symbol="ETHUSDT"
      />,
    );
    const toggle = screen.getByRole('checkbox', { name: /show buy & hold/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });
});

describe('BacktestEquityPanel — equity composition (BTC / USDT)', () => {
  it('shows asset-holdings + USDT-cash toggles (default on) when composition data is present', () => {
    renderWithClient(
      <BacktestEquityPanel points={EQUITY} initialCapital={10_000} symbol="BTCUSDT" />,
    );
    const asset = screen.getByRole('checkbox', { name: /show btc holdings/i });
    const cash = screen.getByRole('checkbox', { name: /show usdt cash/i });
    expect(asset).toBeChecked();
    expect(cash).toBeChecked();
    expect(screen.getByText('BTC holdings')).toBeInTheDocument();
    expect(screen.getByText('USDT cash')).toBeInTheDocument();
  });

  it('omits the composition toggles when the run carries no split (all zero)', () => {
    renderWithClient(
      <BacktestEquityPanel
        points={EQUITY_NO_COMPOSITION}
        initialCapital={10_000}
        symbol="BTCUSDT"
      />,
    );
    expect(screen.queryByText('BTC holdings')).not.toBeInTheDocument();
    expect(screen.queryByText('USDT cash')).not.toBeInTheDocument();
  });
});
