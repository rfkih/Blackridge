'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkline, makeSpark } from '@/components/marketing/Sparkline';

export interface PublicStrategy {
  code: string;
  name: string;
  tagline: string;
  category: string;
  pnl30d: number;
  sharpe: number;
  drawdown: number;
  winRate: number;
  trades30d: number;
  tags: string[];
  highlight?: string;
  sparkSeed: number;
  /** When true (default), the stat numbers are illustrative, not live/backtested. */
  illustrative?: boolean;
  /** Override the return stat label, e.g. "CAGR" for a low-turnover hedge. */
  returnLabel?: string;
  /** Override the bottom line (e.g. backtest window) instead of "N trades · X% win". */
  footnote?: string;
}

interface Props {
  strategies: PublicStrategy[];
  categories: string[];
}

/**
 * Client-side filter for the public strategy library — qp "ledger"
 * presentation: mono ruled tabs above a hairline table. Real-backtest
 * rows carry an ink status tag; illustrative rows are labelled as such.
 */
export function StrategyFilterGrid({ strategies, categories }: Props) {
  const [active, setActive] = useState<string>('All');

  const visible = useMemo(() => {
    if (active === 'All') return strategies;
    return strategies.filter((s) => s.category === active);
  }, [active, strategies]);

  return (
    <div style={{ textAlign: 'left' }}>
      <div className="qp-tabs" role="group" aria-label="Filter strategies by category">
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setActive(c)} aria-pressed={active === c}>
            {c}
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--qp-ink-muted)',
          padding: '18px 2px 14px',
        }}
      >
        Showing {visible.length} of {strategies.length} strategies
        {active !== 'All' ? ` · ${active}` : ''}
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            border: '1px solid var(--qp-line)',
            padding: 40,
            textAlign: 'center',
            color: 'var(--qp-ink-muted)',
            fontSize: 14,
          }}
        >
          No strategies in this category yet — try “All” or another category.
        </div>
      ) : (
        <div className="qp-table-wrap">
          <table className="qp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Strategy</th>
                <th>Category</th>
                <th aria-label="Equity sketch" />
                <th className="num-r">Return</th>
                <th className="num-r">Sharpe</th>
                <th className="num-r">Max DD</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <StrategyRow key={s.code} strategy={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="qp-foot-note">
        Figures marked <em>Illustrative</em> are example numbers, not live or backtested results;
        real per-strategy statistics render inside the app against your own data window. The
        EMA-band hedge row is a real backtest on BTC daily closes, 2022–2026.{' '}
        <Link
          href="/onboarding"
          style={{ color: 'var(--qp-ink)', fontWeight: 600, textDecoration: 'none' }}
        >
          Open an account&ensp;→
        </Link>
      </div>
    </div>
  );
}

function StrategyRow({ strategy }: { strategy: PublicStrategy }) {
  const isProfit = strategy.pnl30d >= 0;
  const isReal = strategy.illustrative === false;
  return (
    <tr>
      <td className="code">{strategy.code}</td>
      <td className="name">
        {strategy.name}
        <span className="sub">{strategy.tagline}</span>
      </td>
      <td>{strategy.category}</td>
      <td style={{ color: 'var(--qp-ink-muted)' }}>
        <Sparkline
          data={makeSpark(strategy.sparkSeed, 32)}
          color="currentColor"
          width={96}
          height={28}
          fill={false}
        />
      </td>
      <td className={`mono num-r ${isProfit ? 'up' : 'dn'}`}>
        {isProfit ? '+' : ''}
        {strategy.pnl30d.toFixed(2)}%
        <span
          style={{
            display: 'block',
            fontSize: 9,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--qp-ink-muted)',
            marginTop: 2,
          }}
        >
          {strategy.returnLabel ?? '30d'}
        </span>
      </td>
      <td className="mono num-r">{strategy.sharpe.toFixed(2)}</td>
      <td className="mono num-r dn">{strategy.drawdown.toFixed(2)}%</td>
      <td>
        {isReal ? (
          <span className="qp-status ink">{strategy.footnote ?? 'Real backtest'}</span>
        ) : (
          <span className="qp-status">Illustrative</span>
        )}
      </td>
    </tr>
  );
}
