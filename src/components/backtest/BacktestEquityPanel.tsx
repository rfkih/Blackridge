'use client';

import { useMemo, useState } from 'react';
import { DrawdownChart } from '@/components/charts/DrawdownChart';
import { EquityCurve, type EquityCompareSeries } from '@/components/charts/EquityCurve';
import { Skeleton } from '@/components/ui/skeleton';
import { buyHoldSeries, maxDrawdownPct, totalReturnPct } from '@/lib/buyHold';
import { BuyHoldVerdictStrip } from './BuyHoldVerdictStrip';
import type { BacktestEquityPoint } from '@/types/backtest';
import type { CandleData } from '@/types/market';

interface BacktestEquityPanelProps {
  points: BacktestEquityPoint[];
  initialCapital: number;
  isLoading?: boolean;
  /** Optional price candles for the run's asset. When present (with `symbol`),
   *  a buy-and-hold benchmark line is overlaid on the equity curve. Absent →
   *  the panel behaves exactly as before (strategy line only). */
  candles?: CandleData[];
  /** The run's symbol (e.g. "BTCUSDT") — labels the buy-hold line. */
  symbol?: string;
}

/** Brand colors for the buy-hold overlay line, by base asset. */
function buyHoldColor(symbol: string | undefined): string {
  const s = (symbol ?? '').toUpperCase();
  if (s.startsWith('BTC')) return '#F7931A';
  if (s.startsWith('ETH')) return '#627EEA';
  return '#8A94A6';
}

/**
 * Align a candle close series to the equity timestamps. Candle `time` is in
 * Unix seconds; equity `ts` is epoch-ms — so we scale candle time to ms and, for
 * each equity ts, take the candle close at-or-just-before it. When the cadence
 * matches 1:1 this is a direct mapping; otherwise it carries the last known
 * close forward (step-hold), which is the correct mark-to-market for a held
 * position between candles.
 */
function alignBuyHoldToEquity(
  candles: CandleData[],
  equity: BacktestEquityPoint[],
  initialCapital: number,
): EquityCurvePointLike[] {
  if (!candles.length || !equity.length) return [];
  // Normalize candles to buy-hold values (anchored at the first candle close),
  // carrying ms timestamps so they align with the equity axis.
  const bh = buyHoldSeries(
    candles.map((c) => ({ ts: c.time * 1_000, close: c.close })),
    initialCapital,
  );
  if (!bh.length) return [];

  const out: EquityCurvePointLike[] = [];
  let j = 0;
  for (const p of equity) {
    // advance to the last candle at-or-before this equity ts
    while (j + 1 < bh.length && bh[j + 1].ts <= p.ts) j++;
    out.push({ ts: p.ts, equity: bh[j].value });
  }
  return out;
}

interface EquityCurvePointLike {
  ts: number;
  equity: number;
}

function PanelShell({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">{title}</h3>
        <div className="flex items-baseline gap-3">
          {headerRight}
          {subtitle && (
            <span className="font-mono text-[11px] tabular-nums text-text-muted">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="px-2 pb-2 pt-3">{children}</div>
    </div>
  );
}

export function BacktestEquityPanel({
  points,
  initialCapital,
  isLoading,
  candles,
  symbol,
}: BacktestEquityPanelProps) {
  const equityPoints = useMemo(() => points.map((p) => ({ ts: p.ts, equity: p.equity })), [points]);

  const buyHoldPoints = useMemo(
    () => (candles?.length ? alignBuyHoldToEquity(candles, points, initialCapital) : []),
    [candles, points, initialCapital],
  );
  const hasBuyHold = buyHoldPoints.length > 0;
  const [showBuyHold, setShowBuyHold] = useState(true);

  const compareSeries = useMemo<EquityCompareSeries | undefined>(() => {
    if (!hasBuyHold || !showBuyHold) return undefined;
    return {
      points: buyHoldPoints,
      label: `Buy & Hold ${symbol ?? ''}`.trim(),
      color: buyHoldColor(symbol),
    };
  }, [hasBuyHold, showBuyHold, buyHoldPoints, symbol]);

  const drawdownPoints = useMemo(
    () => points.map((p) => ({ ts: p.ts, drawdownPct: p.drawdownPct })),
    [points],
  );

  const maxDrawdown = useMemo(() => {
    if (!points.length) return 0;

    let min = points[0].drawdownPct;
    for (let i = 1; i < points.length; i++) {
      const v = points[i].drawdownPct;
      if (v < min) min = v;
    }
    return min;
  }, [points]);

  const endingEquity = points.length ? points[points.length - 1].equity : initialCapital;

  const strategyReturnPct =
    initialCapital !== 0 ? (endingEquity / initialCapital - 1) * 100 : 0;

  const buyHoldStats = useMemo(() => {
    if (!hasBuyHold) return null;
    const first = buyHoldPoints[0].equity;
    const last = buyHoldPoints[buyHoldPoints.length - 1].equity;
    return {
      returnPct: totalReturnPct(first, last),
      maxDdPct: maxDrawdownPct(buyHoldPoints.map((p) => ({ value: p.equity }))),
    };
  }, [hasBuyHold, buyHoldPoints]);

  return (
    <div className="space-y-4">
      {buyHoldStats && (
        <BuyHoldVerdictStrip
          symbol={symbol}
          strategyReturnPct={strategyReturnPct}
          strategyMaxDdPct={maxDrawdown}
          buyHoldReturnPct={buyHoldStats.returnPct}
          buyHoldMaxDdPct={buyHoldStats.maxDdPct}
        />
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PanelShell
          title="Equity Curve"
          subtitle={`End: $${endingEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          headerRight={
            hasBuyHold ? (
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1" style={{ color: '#00C896' }}>
                  <span aria-hidden>●</span> Strategy
                </span>
                <span
                  className="flex items-center gap-1"
                  style={{ color: buyHoldColor(symbol), opacity: showBuyHold ? 1 : 0.4 }}
                >
                  <span aria-hidden>●</span> {`Buy & Hold ${symbol ?? ''}`.trim()}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-normal text-text-muted">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-[#F7931A]"
                    checked={showBuyHold}
                    onChange={(e) => setShowBuyHold(e.target.checked)}
                    aria-label="Show buy & hold"
                  />
                  Show buy &amp; hold
                </label>
              </div>
            ) : undefined
          }
        >
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : equityPoints.length ? (
            <EquityCurve
              points={equityPoints}
              initialCapital={initialCapital}
              compareSeries={compareSeries}
            />
          ) : (
            <EmptyChartState label="No equity points available" />
          )}
        </PanelShell>
      </div>
      <div className="lg:col-span-2">
        <PanelShell title="Drawdown" subtitle={`Max: ${Math.abs(maxDrawdown).toFixed(2)}%`}>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : drawdownPoints.length ? (
            <DrawdownChart points={drawdownPoints} />
          ) : (
            <EmptyChartState label="No drawdown data" />
          )}
        </PanelShell>
      </div>
      </div>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-[12px] text-text-muted">
      {label}
    </div>
  );
}
