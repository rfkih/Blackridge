'use client';

import { ArrowDownRight, ArrowUpRight, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type { AccountSummary } from '@/types/account';

interface HeroPnlProps {
  unrealizedPnl: number;
  realizedPnlToday: number;
  openCount: number;
  winRate: number;
  isLoading?: boolean;
  scope: {
    isAll: boolean;
    account: AccountSummary | null;
  };
}

export function HeroPnl({
  unrealizedPnl,
  realizedPnlToday,
  openCount,
  winRate,
  isLoading,
  scope,
}: HeroPnlProps) {
  const formatCurrency = useCurrencyFormatter();
  const isUp = unrealizedPnl >= 0;
  const pnlColor = isUp ? 'var(--color-profit)' : 'var(--color-loss)';

  return (
    <section
      aria-label="Portfolio summary"
      className="relative overflow-hidden rounded-md border border-bd-subtle bg-bg-surface"
    >
      {/* Razor edge — 2px accent line hugging the top of the hero, full width.
          The one visually loud element on the entire page. */}
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 h-[2px]"
        style={{ backgroundColor: pnlColor }}
      />

      <div className="grid grid-cols-1 gap-px bg-bd-subtle lg:grid-cols-[1.4fr_1fr]">
        {/* ── Left: the big number ────────────────────────────────────── */}
        <div className="relative bg-bg-surface px-6 py-7 lg:px-8 lg:py-9">
          <ScopeLabel scope={scope} />

          <div className="mt-5 flex items-baseline gap-4">
            <div className="flex items-center gap-2">
              {isUp ? (
                <ArrowUpRight size={22} strokeWidth={1.75} style={{ color: pnlColor }} />
              ) : (
                <ArrowDownRight size={22} strokeWidth={1.75} style={{ color: pnlColor }} />
              )}
              <span className="label-caps !text-[10px]">Unrealized P&L</span>
            </div>
          </div>

          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-[58px] w-[340px]" />
            ) : (
              <h1
                className="num leading-[0.95] tracking-tightest"
                style={{
                  color: pnlColor,
                  fontSize: 'clamp(40px, 5.4vw, 68px)',
                  fontWeight: 600,
                }}
              >
                {formatCurrency(unrealizedPnl, { withSign: true })}
              </h1>
            )}
            <p className="num mt-3 text-[11px] text-text-muted">
              {isLoading ? (
                <span className="invisible">placeholder</span>
              ) : (
                <>
                  Open notional ·{' '}
                  <span className="text-text-secondary">
                    {openCount} position{openCount === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── Right: Bloomberg scorecard rows ─────────────────────────── */}
        <div className="flex flex-col bg-bg-surface">
          <ScoreRow
            label="Realized · Today"
            value={formatCurrency(realizedPnlToday, { withSign: true })}
            valueColor={realizedPnlToday >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
            isLoading={isLoading}
          />
          <ScoreRow
            label="Open Positions"
            value={String(openCount)}
            valueColor="var(--text-primary)"
            isLoading={isLoading}
          />
          <ScoreRow
            label="Win Rate · 30d"
            value={`${winRate.toFixed(1)}%`}
            valueColor={winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)'}
            sub={winRate >= 50 ? '▲ above 50%' : '▼ below 50%'}
            subColor={winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)'}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}

function ScopeLabel({ scope }: { scope: HeroPnlProps['scope'] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps">Scope</span>
      <span className="flex items-center gap-1.5 font-mono text-[11px]">
        {scope.isAll ? (
          <>
            <Layers size={10} strokeWidth={2} className="text-profit" />
            <span className="text-text-primary">All accounts</span>
          </>
        ) : scope.account ? (
          <>
            <span className="text-text-primary">{scope.account.label}</span>
            <span className="text-text-muted">· {scope.account.exchange}</span>
          </>
        ) : (
          <span className="text-text-muted">no account selected</span>
        )}
      </span>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  valueColor,
  sub,
  subColor,
  isLoading,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
  subColor?: string;
  isLoading?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-between gap-6 bg-bg-surface px-6 py-4',
        'border-b border-bd-subtle last:border-b-0',
      )}
    >
      <span className="label-caps">{label}</span>
      <div className="flex flex-col items-end leading-tight">
        {isLoading ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <>
            <span
              className="num text-[18px] font-semibold tracking-tight"
              style={{ color: valueColor }}
            >
              {value}
            </span>
            {sub && (
              <span className="num mt-0.5 text-[10px]" style={{ color: subColor }}>
                {sub}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

