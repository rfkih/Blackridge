'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Clock, TrendingUp } from 'lucide-react';
import { PriceCell } from '@/components/shared/PriceCell';
import { PnlCell } from '@/components/shared/PnlCell';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { TradePositionRow } from '@/components/trading/TradePositionRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrade } from '@/hooks/useTrades';
import { usePositionStore } from '@/store/positionStore';
import { useLivePnl } from '@/hooks/useLivePnl';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { formatDate, formatDuration } from '@/lib/formatters';
import type { TradePosition, TradeStatus, Trades } from '@/types/trading';

const LEG_ORDER: Record<TradePosition['type'], number> = {
  SINGLE: 0,
  TP1: 1,
  TP2: 2,
  RUNNER: 3,
};

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const tradeQuery = useTrade(params.id);
  const formatCurrency = useCurrencyFormatter();

  // Start live P&L for the trade's account. The positionStore is keyed by
  // tradeId so subscribing is cheap whether or not this specific trade is
  // currently in the open set.
  useLivePnl(tradeQuery.data?.accountId);
  const livePnl = usePositionStore((s) => s.pnlMap[params.id]);

  const positions = useMemo(() => {
    const pos = tradeQuery.data?.positions ?? [];
    return [...pos].sort((a, b) => LEG_ORDER[a.type] - LEG_ORDER[b.type]);
  }, [tradeQuery.data?.positions]);

  if (tradeQuery.isLoading && !tradeQuery.data) {
    return <TradeDetailSkeleton />;
  }

  if (tradeQuery.isError || !tradeQuery.data) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink />
        <div className="rounded-md border border-bd-subtle bg-bg-surface p-8">
          <EmptyState
            title="Trade not found"
            description="The trade may have been deleted, or the id is wrong."
          />
        </div>
      </div>
    );
  }

  const trade = tradeQuery.data;
  const isOpen = trade.status !== 'CLOSED';
  const unrealized = isOpen ? (livePnl ?? trade.unrealizedPnl) : 0;
  const netPnl = trade.realizedPnl - trade.feeUsdt + (isOpen ? unrealized : 0);

  return (
    <div className="flex flex-col gap-5">
      <BackLink />

      {/* Header */}
      <section className="rounded-md border border-bd-subtle bg-bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <SymbolAvatar symbol={trade.symbol} direction={trade.direction} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[26px] font-semibold tracking-tighter text-text-primary">
                  {trade.symbol}
                </h1>
                <DirectionBadge direction={trade.direction} />
                <StatusBadge status={trade.status} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-text-muted">
                <StrategyBadge code={trade.strategyCode} size="sm" />
                <span className="font-mono">id · {trade.id.slice(0, 8)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} strokeWidth={1.75} />
                  {formatDate(trade.entryTime)}
                </span>
              </div>
            </div>
          </div>

          {isOpen ? (
            <div className="flex flex-col items-end">
              <span className="label-caps">Unrealized P&L</span>
              <PnlCell value={unrealized} className="!text-[22px]" />
              {trade.unrealizedPnlPct != null && (
                <span className="font-mono text-[11px] text-text-muted">
                  {trade.unrealizedPnlPct >= 0 ? '+' : ''}
                  {trade.unrealizedPnlPct.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <span className="label-caps">Realized P&L</span>
              <PnlCell value={trade.realizedPnl} noFlash className="!text-[22px]" />
              <span className="font-mono text-[11px] text-text-muted">
                closed {formatDate(trade.exitTime)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Summary row */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bd-subtle bg-bd-subtle sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCell label="Entry price">
          <PriceCell value={trade.entryPrice} decimals={4} />
        </SummaryCell>
        <SummaryCell label={isOpen ? 'Mark price' : 'Exit price'}>
          <PriceCell value={isOpen ? trade.markPrice : trade.exitAvgPrice} decimals={4} />
        </SummaryCell>
        <SummaryCell label="Stop loss">
          <PriceCell value={trade.stopLossPrice} decimals={4} />
        </SummaryCell>
        <SummaryCell label="Realized P&L">
          <PnlCell value={trade.realizedPnl} noFlash className="!text-[14px]" />
        </SummaryCell>
        <SummaryCell label="Fees">
          <span className="font-mono text-[14px] tabular-nums text-text-primary">
            {formatCurrency(-Math.abs(trade.feeUsdt), { withSign: true })}
          </span>
        </SummaryCell>
        <SummaryCell label="Net P&L">
          <PnlCell value={netPnl} noFlash className="!text-[14px]" />
        </SummaryCell>
      </section>

      {/* Meta row — duration, TP targets, sizing */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaTile label="Duration" icon={Clock}>
          {formatDuration((trade.exitTime ?? Date.now()) - trade.entryTime)}
        </MetaTile>
        <MetaTile label="Quantity">
          <span className="font-mono tabular-nums">{trade.quantity.toFixed(4)}</span>
        </MetaTile>
        <MetaTile label="TP1 target">
          <PriceCell value={trade.tp1Price} decimals={4} />
        </MetaTile>
        <MetaTile label="TP2 target">
          <PriceCell value={trade.tp2Price} decimals={4} />
        </MetaTile>
      </section>

      {/* Position legs */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="label-caps">Position legs</p>
            <h2 className="mt-1 font-display text-[18px] font-semibold tracking-tighter text-text-primary">
              Fills
            </h2>
          </div>
          <span className="text-[11px] text-text-muted">
            {positions.length} leg{positions.length === 1 ? '' : 's'}
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="rounded-md border border-bd-subtle bg-bg-surface p-8">
            <EmptyState
              icon={TrendingUp}
              title="No legs recorded"
              description="Position legs appear here as the trade gets filled, partially closed, or runs into TP/SL."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {positions.map((p) => {
              const legOpen = p.exitTime == null;
              return (
                <TradePositionRow
                  key={p.id}
                  position={p}
                  direction={trade.direction}
                  isOpen={legOpen}
                  // Only the SINGLE leg, or an open TP/RUNNER leg, can contribute
                  // to the trade's live unrealized P&L. Allocating the whole
                  // trade unrealized to a single leg is a rough approximation —
                  // the backend doesn't break it down per leg yet.
                  liveUnrealizedPnl={legOpen ? (livePnl ?? trade.unrealizedPnl) : null}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/trades"
      className="inline-flex w-fit items-center gap-1 text-[12px] text-text-muted transition-colors hover:text-text-primary"
    >
      <ArrowLeft size={13} strokeWidth={1.75} />
      All trades
    </Link>
  );
}

function DirectionBadge({ direction }: { direction: Trades['direction'] }) {
  const isLong = direction === 'LONG';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wider"
      style={{
        backgroundColor: isLong ? 'var(--tint-profit)' : 'var(--tint-loss)',
        color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
      }}
    >
      {isLong ? (
        <ArrowUpRight size={11} strokeWidth={2} />
      ) : (
        <ArrowDownRight size={11} strokeWidth={2} />
      )}
      {direction}
    </span>
  );
}

function StatusBadge({ status }: { status: TradeStatus }) {
  if (status === 'OPEN') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-info)', color: 'var(--color-info)' }}
      >
        <span className="pulse-dot inline-block size-1.5 rounded-full bg-info" aria-hidden="true" />
        Open
      </span>
    );
  }
  if (status === 'PARTIALLY_CLOSED') {
    return (
      <span
        className="inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wider"
        style={{ backgroundColor: 'var(--tint-warning)', color: 'var(--color-warning)' }}
      >
        Partially closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sm bg-bg-elevated px-2 py-0.5 text-[11px] font-semibold tracking-wider text-text-secondary">
      Closed
    </span>
  );
}

function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-bg-surface px-4 py-3">
      <span className="label-caps">{label}</span>
      <div className="font-mono">{children}</div>
    </div>
  );
}

function MetaTile({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-surface p-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} strokeWidth={1.75} className="text-text-muted" />}
        <span className="label-caps">{label}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-text-primary">{children}</div>
    </div>
  );
}

function SymbolAvatar({ symbol, direction }: { symbol: string; direction: Trades['direction'] }) {
  const isLong = direction === 'LONG';
  return (
    <div
      aria-hidden="true"
      className="flex size-11 items-center justify-center rounded-md font-mono text-[14px] font-semibold"
      style={{
        backgroundColor: isLong ? 'var(--tint-profit)' : 'var(--tint-loss)',
        color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
      }}
    >
      {symbol.slice(0, 3)}
    </div>
  );
}

function TradeDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink />
      <Skeleton className="h-[96px] w-full rounded-md" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bd-subtle bg-bd-subtle lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-surface px-4 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[72px] w-full rounded-md" />
      <Skeleton className="h-[72px] w-full rounded-md" />
    </div>
  );
}
