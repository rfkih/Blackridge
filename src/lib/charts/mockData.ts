import type { CandleData, IndicatorData, EquityPoint } from '@/types/market';
import { BASE_PRICES, INTERVAL_SECONDS } from './chartTheme';

// ─── Math helpers ────────────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(values: number[], period: number, i: number): number {
  const slice = values.slice(Math.max(0, i - period + 1), i + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function stddev(values: number[], period: number, i: number, mean: number): number {
  const slice = values.slice(Math.max(0, i - period + 1), i + 1);
  const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

function rsi14(closes: number[]): number[] {
  const result: number[] = new Array(14).fill(50);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain += Math.max(diff, 0);
    avgLoss += Math.max(-diff, 0);
  }
  avgGain /= 14;
  avgLoss /= 14;
  for (let i = 14; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * 13 + Math.max(diff, 0)) / 14;
    avgLoss = (avgLoss * 13 + Math.max(-diff, 0)) / 14;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

// ─── Mock generators ─────────────────────────────────────────────────────────

export function generateMockCandles(symbol: string, interval: string, count: number): CandleData[] {
  const basePrice = BASE_PRICES[symbol] ?? 1_000;
  const intervalSec = INTERVAL_SECONDS[interval] ?? 3_600;
  const nowSec = Math.floor(Date.now() / 1_000);
  const startSec = nowSec - count * intervalSec;

  const candles: CandleData[] = [];
  let close = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startSec + i * intervalSec;
    const open = close;
    const vol = basePrice * 0.003;
    close = Math.max(basePrice * 0.6, Math.min(basePrice * 1.4, open + (Math.random() - 0.49) * vol * 2));
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low = Math.min(open, close) - Math.random() * vol * 0.5;
    const move = Math.abs(close - open) / open;
    const volume = basePrice * 4 * (1 + move * 30) * (0.4 + Math.random() * 1.2);
    candles.push({ time, open, high, low, close, volume });
  }

  return candles;
}

export function generateMockIndicators(candles: CandleData[]): IndicatorData[] {
  if (!candles.length) return [];
  const closes = candles.map((c) => c.close);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsiArr = rsi14(closes);

  // MACD 12/26/9
  const macdFast = ema(closes, 12);
  const macdSlow = ema(closes, 26);
  const macdLine = macdFast.map((v, i) => v - macdSlow[i]);
  const macdSignalArr = ema(macdLine.slice(25), 9);
  const paddedSignal = new Array(25).fill(0).concat(macdSignalArr);
  const macdHisto = macdLine.map((v, i) => v - paddedSignal[i]);

  return candles.map((c, i) => {
    const mean = sma(closes, 20, i);
    const sd = stddev(closes, 20, i, mean);
    const atrValue = (c.high - c.low) * 0.8;

    return {
      time: c.time,
      ema20: ema20[i] ?? null,
      ema50: i >= 49 ? ema50[i] : null,
      ema200: i >= 199 ? ema200[i] : null,
      bbUpper: mean + 2 * sd,
      bbMiddle: mean,
      bbLower: mean - 2 * sd,
      kcUpper: mean + 1.5 * atrValue,
      kcMiddle: mean,
      kcLower: mean - 1.5 * atrValue,
      rsi: i >= 14 ? rsiArr[i] : null,
      macd: macdLine[i] ?? null,
      macdSignal: paddedSignal[i] ?? null,
      macdHistogram: macdHisto[i] ?? null,
      atr: atrValue,
      adx: 20 + Math.random() * 30,
    };
  });
}

export function generateMockEquity(days: number, initialCapital = 10_000): EquityPoint[] {
  const points: EquityPoint[] = [];
  let equity = initialCapital;
  let peak = initialCapital;
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const time = now - i * 86_400_000;
    const change = (Math.random() - 0.46) * equity * 0.012;
    equity = Math.max(equity * 0.78, equity + change);
    peak = Math.max(peak, equity);
    const drawdown = ((equity - peak) / peak) * 100;
    points.push({ time, equity, drawdown });
  }

  return points;
}
