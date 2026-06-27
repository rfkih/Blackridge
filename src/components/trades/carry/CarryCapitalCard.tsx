'use client';

import { AlertTriangle } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { CarryBalance } from '@/types/trading';

/**
 * Consolidated carry capital: you fund ONE account, and carry holds the long leg as a
 * coin in the spot wallet and the short-leg margin in the futures wallet. This shows the
 * single total + the spot/futures split + per-pair legs, so the operator can see where
 * the capital actually sits without checking two Binance wallets.
 */
export function CarryCapitalCard({
  balance,
  isLoading,
}: {
  balance: CarryBalance | undefined;
  isLoading: boolean;
}) {
  const fmt = useCurrencyFormatter();
  if (!balance && isLoading) {
    return <div className="mm-card h-[120px] animate-pulse" style={{ padding: '16px 20px' }} />;
  }
  if (!balance) return null;

  const spotSide = balance.spotFreeUsdt + balance.spotLegsValueUsdt;
  const futSide = balance.futuresWalletUsdt;
  const total = balance.totalUsdt || spotSide + futSide;
  const spotPct = total > 0 ? (spotSide / total) * 100 : 50;
  const futPct = total > 0 ? (futSide / total) * 100 : 50;

  return (
    <section className="mm-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="mm-kicker">CARRY CAPITAL</div>
          <div
            className="font-mono tabular-nums"
            style={{ fontSize: 26, letterSpacing: '-0.02em', color: 'var(--mm-ink-0)', marginTop: 2 }}
          >
            {fmt(total)}
          </div>
        </div>
        <div className="text-right font-mono text-[13px] tabular-nums" style={{ color: 'var(--mm-ink-2)' }}>
          <div>
            Free <strong style={{ color: 'var(--mm-ink-0)' }}>{fmt(balance.freeUsdt)}</strong>
          </div>
          <div>
            Deployed {fmt(balance.spotLegsValueUsdt + balance.deployedMarginUsdt)} · {balance.openPairs} pair
            {balance.openPairs === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* spot / futures split bar */}
      <div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--mm-surface-2)' }}>
          <div style={{ width: `${spotPct}%`, background: 'var(--accent-primary)' }} />
          <div style={{ width: `${futPct}%`, background: 'var(--color-info, #3b82f6)' }} />
        </div>
        <div className="mt-1.5 flex flex-wrap justify-between gap-2 font-mono text-[12px] tabular-nums">
          <span style={{ color: 'var(--mm-ink-2)' }}>
            <Dot color="var(--accent-primary)" /> Spot {fmt(spotSide)}
            <span style={{ color: 'var(--mm-ink-3)' }}>
              {' '}
              (free {fmt(balance.spotFreeUsdt)} · legs {fmt(balance.spotLegsValueUsdt)})
            </span>
          </span>
          <span style={{ color: 'var(--mm-ink-2)' }}>
            <Dot color="var(--color-info, #3b82f6)" /> Futures {fmt(futSide)}
            <span style={{ color: 'var(--mm-ink-3)' }}> (margin {fmt(balance.deployedMarginUsdt)})</span>
          </span>
        </div>
      </div>

      {balance.futuresBalanceUnavailable && (
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-warning)' }}>
          <AlertTriangle size={12} /> Futures-wallet balance unreadable — split is spot-only/partial.
        </div>
      )}

      {balance.legs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[12px] tabular-nums">
            <thead>
              <tr style={{ color: 'var(--mm-ink-3)' }} className="text-left">
                <th className="py-1 pr-3 font-normal">Pair</th>
                <th className="py-1 pr-3 text-right font-normal">Spot leg</th>
                <th className="py-1 pr-3 text-right font-normal">Perp short</th>
                <th className="py-1 pr-3 text-right font-normal">Margin</th>
                <th className="py-1 text-right font-normal">Lev</th>
              </tr>
            </thead>
            <tbody>
              {balance.legs.map((l) => (
                <tr key={l.symbol} style={{ color: 'var(--mm-ink-1)' }}>
                  <td className="py-1 pr-3">
                    {l.symbol.replace(/USDT$/, '')}
                    {l.simulated && (
                      <span className="ml-1 text-[10px]" style={{ color: 'var(--mm-ink-3)' }}>
                        paper
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right">{fmt(l.spotValueUsdt)}</td>
                  <td className="py-1 pr-3 text-right">{fmt(l.perpNotionalUsdt)}</td>
                  <td className="py-1 pr-3 text-right">{fmt(l.marginUsdt)}</td>
                  <td className="py-1 text-right">{l.leverage}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-block size-2 rounded-full align-middle"
      style={{ background: color }}
    />
  );
}
