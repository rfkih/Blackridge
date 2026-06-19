'use client';

import { useMemo } from 'react';
import { compareToBuyHold } from '@/lib/buyHold';

interface BuyHoldVerdictStripProps {
  symbol?: string;
  /** Strategy total return %, e.g. (endingEquity/initialCapital - 1) * 100. */
  strategyReturnPct: number;
  /** Strategy max drawdown % (non-positive; sign-agnostic here). */
  strategyMaxDdPct: number;
  /** Buy-and-hold total return % over the same window. */
  buyHoldReturnPct: number;
  /** Buy-and-hold max drawdown % (non-positive; sign-agnostic here). */
  buyHoldMaxDdPct: number;
}

function signedPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Drawdowns rendered as a negative magnitude (e.g. -49.00%). */
function ddPct(v: number): string {
  return `-${Math.abs(v).toFixed(2)}%`;
}

function returnColor(v: number): string {
  return v >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
}

/**
 * Compact "Strategy vs Buy-Hold" comparison strip: total return and max
 * drawdown side-by-side for both, plus a plain-English verdict.
 *
 * When buy-hold was up, the verdict frames the strategy's upside capture and
 * drawdown cut. When buy-hold lost money, "% of upside captured" is
 * meaningless, so the verdict instead states that buy-hold was down N% while
 * the strategy was up/down M% — never a nonsense capture figure.
 */
export function BuyHoldVerdictStrip({
  symbol,
  strategyReturnPct,
  strategyMaxDdPct,
  buyHoldReturnPct,
  buyHoldMaxDdPct,
}: BuyHoldVerdictStripProps) {
  const cmp = useMemo(
    () =>
      compareToBuyHold(
        strategyReturnPct,
        strategyMaxDdPct,
        buyHoldReturnPct,
        buyHoldMaxDdPct,
      ),
    [strategyReturnPct, strategyMaxDdPct, buyHoldReturnPct, buyHoldMaxDdPct],
  );

  const sym = symbol ? ` ${symbol}` : '';

  const verdict = useMemo(() => {
    const ddPhrase =
      cmp.ddCutPct == null
        ? null
        : cmp.ddCutPct >= 0
          ? `cut max drawdown by ~${Math.round(cmp.ddCutPct)}% (${ddPct(strategyMaxDdPct)} vs ${ddPct(buyHoldMaxDdPct)})`
          : `had a deeper drawdown (${ddPct(strategyMaxDdPct)} vs ${ddPct(buyHoldMaxDdPct)})`;

    if (buyHoldReturnPct > 0 && cmp.upsideCapturedPct != null) {
      const cap = Math.round(cmp.upsideCapturedPct);
      const head =
        cap >= 100
          ? `Beat buy-hold — ${cap}% of the upside`
          : `Captured ${cap}% of the upside`;
      return ddPhrase ? `${head} · ${ddPhrase}.` : `${head}.`;
    }

    // buy-hold was flat or down — no upside to "capture"
    const stratDir = strategyReturnPct >= 0 ? 'up' : 'down';
    const head = `Buy-hold was down ${Math.abs(buyHoldReturnPct).toFixed(0)}%; strategy was ${stratDir} ${Math.abs(strategyReturnPct).toFixed(0)}%`;
    return ddPhrase ? `${head} · ${ddPhrase}.` : `${head}.`;
  }, [cmp, buyHoldReturnPct, strategyReturnPct, strategyMaxDdPct, buyHoldMaxDdPct]);

  return (
    <div className="rounded-xl border border-bd-subtle bg-bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="font-display text-[14px] font-semibold text-text-primary">
          Strategy vs Buy-Hold{sym}
        </h4>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Strategy return" value={signedPct(strategyReturnPct)} color={returnColor(strategyReturnPct)} />
        <Stat
          label={`Buy & Hold${sym} return`}
          value={signedPct(buyHoldReturnPct)}
          color={returnColor(buyHoldReturnPct)}
        />
        <Stat label="Strategy max DD" value={ddPct(strategyMaxDdPct)} color="var(--color-loss)" />
        <Stat
          label={`Buy & Hold${sym} max DD`}
          value={ddPct(buyHoldMaxDdPct)}
          color="var(--color-loss)"
        />
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{verdict}</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[12px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className="font-mono text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
