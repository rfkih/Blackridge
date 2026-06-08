'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
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
 * Client-side filter UI for the public strategies catalog. Lifts state out
 * of the server page so the category pills are actually wired to a state,
 * not decorative dead buttons.
 */
export function StrategyFilterGrid({ strategies, categories }: Props) {
  const [active, setActive] = useState<string>('All');

  const visible = useMemo(() => {
    if (active === 'All') return strategies;
    return strategies.filter((s) => s.category === active);
  }, [active, strategies]);

  return (
    <>
      {}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {categories.map((c) => {
          const isOn = active === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              aria-pressed={isOn}
              className="br-chip transition-colors"
              style={{
                padding: '6px 14px',
                fontSize: 12,
                background: isOn ? 'var(--brand-500)' : undefined,
                color: isOn ? '#fff' : undefined,
                cursor: 'pointer',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {}
      <section style={{ padding: '32px 0 64px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div
            className="mb-5 text-center text-[13px]"
            style={{ color: 'var(--text-muted)' }}
            aria-live="polite"
          >
            Showing {visible.length} of {strategies.length}{' '}
            {active === 'All' ? 'strategies' : `${active.toLowerCase()} strategies`}
          </div>
          {visible.length === 0 ? (
            <div className="br-card mx-auto max-w-md text-center" style={{ padding: 32 }}>
              <div
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                No strategies in this category yet.
              </div>
              <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                Try “All” or another category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((s) => (
                <StrategyCard key={s.code} strategy={s} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function StrategyCard({ strategy }: { strategy: PublicStrategy }) {
  const isProfit = strategy.pnl30d >= 0;
  const isReal = strategy.illustrative === false;
  return (
    <Link
      href="/onboarding"
      className="br-card flex flex-col transition-all hover:-translate-y-0.5"
      style={{
        padding: 24,
        borderRadius: 24,
        gap: 16,
        textDecoration: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="br-ticker"
          style={{ width: 48, height: 48, borderRadius: 12, fontSize: 12 }}
        >
          {strategy.code}
        </div>
        {strategy.highlight && (
          <span className="br-chip br-chip-brand text-[10px]">{strategy.highlight}</span>
        )}
      </div>
      <div>
        <h3
          className="font-display"
          style={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {strategy.name}
        </h3>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {strategy.tagline}
        </p>
      </div>

      <Sparkline
        data={makeSpark(strategy.sparkSeed, 40)}
        color={isReal ? 'var(--color-profit)' : isProfit ? 'var(--brand-500)' : 'var(--color-loss)'}
        width={280}
        height={48}
      />

      <div>
        <span
          className="br-chip text-[10px]"
          style={{
            padding: '2px 8px',
            fontWeight: 600,
            background: isReal ? 'var(--brand-50)' : undefined,
            color: isReal ? 'var(--brand-700)' : 'var(--text-muted)',
          }}
        >
          {isReal ? 'Real backtest' : 'Illustrative'}
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-3 pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <MiniStat
          label={strategy.returnLabel ?? '30d return'}
          value={`${isProfit ? '+' : ''}${strategy.pnl30d.toFixed(2)}%`}
          tone={isProfit ? 'profit' : 'loss'}
          icon={isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        />
        <MiniStat label="Sharpe" value={strategy.sharpe.toFixed(2)} />
        <MiniStat label="Max DD" value={`${strategy.drawdown.toFixed(2)}%`} tone="loss" />
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {strategy.tags.map((t) => (
          <span
            key={t}
            className="br-chip text-[10px]"
            style={{ padding: '2px 8px', fontWeight: 500 }}
          >
            {t}
          </span>
        ))}
      </div>

      <div
        className="flex items-center justify-between pt-3 text-[12px]"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 size={12} />{' '}
          {strategy.footnote ??
            `${strategy.trades30d} trades · ${strategy.winRate.toFixed(1)}% win`}
        </span>
        <span
          className="inline-flex items-center gap-1 font-semibold"
          style={{ color: 'var(--brand-700)' }}
        >
          Enable <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
  icon?: React.ReactNode;
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="num mt-0.5 inline-flex items-center gap-1 font-display text-[14px] font-bold"
        style={{ color }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
