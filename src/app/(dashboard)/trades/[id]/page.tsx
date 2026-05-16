'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Loader2,
  TrendingUp,
  X,
} from 'lucide-react';
import { PriceCell } from '@/components/shared/PriceCell';
import { PnlCell } from '@/components/shared/PnlCell';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { TradePositionRow } from '@/components/trading/TradePositionRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useCloseTrade, useTrade, useTradeAttribution } from '@/hooks/useTrades';
import { usePositionStore } from '@/store/positionStore';
import { useLivePnl } from '@/hooks/useLivePnl';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { formatDate, formatDuration } from '@/lib/formatters';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
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
        <div className="rounded-xl border border-bd-subtle bg-bg-surface p-8">
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

      {}
      <section className="rounded-xl border border-bd-subtle bg-bg-surface p-6">
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
            <div className="flex items-start gap-4">
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
              <CloseTradeButton trade={trade} />
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

      {}
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

      {}
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

      <EntryPlanPanel trade={trade} />

      {}
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
          <div className="rounded-xl border border-bd-subtle bg-bg-surface p-8">
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

                  liveUnrealizedPnl={legOpen ? (livePnl ?? trade.unrealizedPnl) : null}
                />
              );
            })}
          </div>
        )}
      </section>

      <TradeAttributionPanel tradeId={params.id} />
    </div>
  );
}

function EntryPlanPanel({ trade }: { trade: Trades }) {
  const isLong = trade.direction === 'LONG';
  const stop = trade.stopLossPrice;
  const tp1 = trade.tp1Price;
  const tp2 = trade.tp2Price;

  const rDistance = stop != null && trade.entryPrice ? Math.abs(trade.entryPrice - stop) : null;
  const rMultiple = (target: number | null | undefined): number | null => {
    if (target == null || rDistance == null || rDistance === 0) return null;
    const move = isLong ? target - trade.entryPrice : trade.entryPrice - target;
    return move / rDistance;
  };
  const tp1R = rMultiple(tp1);
  const tp2R = rMultiple(tp2);

  const rationale = isLong
    ? `${trade.strategyCode} LONG entries gate on a bullish regime — this trade implies that gate passed at entry.`
    : `${trade.strategyCode} SHORT entries gate on a bearish regime — this trade implies that gate passed at entry.`;

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Entry plan
          </p>
          <h3 className="mt-0.5 font-display text-[15px] font-semibold text-text-primary">
            Why the strategy took this trade
          </h3>
        </div>
        <Link
          href={`/strategies/${trade.accountStrategyId}`}
          className="font-mono text-[11px] text-text-muted hover:text-text-primary"
        >
          View strategy →
        </Link>
      </header>

      <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">{rationale}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Risk distance (1 R)
          </span>
          <span className="font-mono text-[14px] tabular-nums text-text-primary">
            {rDistance == null ? '—' : rDistance.toFixed(4)}
          </span>
          <span className="text-[10px] leading-snug text-text-muted">
            Entry to stop. All R-multiples below scale to this.
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            TP1 reward
          </span>
          <span
            className="font-mono text-[14px] tabular-nums"
            style={{ color: 'var(--color-profit)' }}
          >
            {tp1R == null ? '—' : `${tp1R >= 0 ? '+' : ''}${tp1R.toFixed(2)} R`}
          </span>
          <span className="text-[10px] leading-snug text-text-muted">
            Move from entry to TP1, in units of risk.
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            TP2 reward
          </span>
          <span
            className="font-mono text-[14px] tabular-nums"
            style={{ color: 'var(--color-profit)' }}
          >
            {tp2R == null ? '—' : `${tp2R >= 0 ? '+' : ''}${tp2R.toFixed(2)} R`}
          </span>
          <span className="text-[10px] leading-snug text-text-muted">
            Move from entry to TP2, in units of risk.
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Phase 2c — splits realized P&L into the three legs:
 *   signal alpha = price moved as expected
 *   exec drift   = entry slippage cost
 *   sizing resid = gap between intended and actual size
 *
 * Sum equals realized. Hidden when the trade is still open or pre-dates
 * intent capture (legacy rows) — better to show nothing than fake numbers.
 */
function TradeAttributionPanel({ tradeId }: { tradeId: string }) {
  const { data, isLoading } = useTradeAttribution(tradeId);
  const formatCurrency = useCurrencyFormatter();

  if (isLoading) {
    return (
      <section className="rounded-xl border border-bd-subtle bg-bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-16 w-full" />
      </section>
    );
  }
  if (!data) return null;

  const legs: Array<{ label: string; value: number; help: string }> = [
    {
      label: 'Signal alpha',
      value: data.signalAlpha,
      help: 'P&L from price moving as the strategy predicted, at intended entry + size.',
    },
    {
      label: 'Execution drift',
      value: data.executionDrift,
      help: 'Cost of entry slippage — realized fill vs intended price.',
    },
    {
      label: 'Sizing residual',
      value: data.sizingResidual,
      help: 'Gap between intended and actual size (vol-targeting, partial fills).',
    },
  ];

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            P&L attribution
          </p>
          <h3 className="mt-0.5 font-display text-[15px] font-semibold text-text-primary">
            How realized P&L was earned
          </h3>
        </div>
        <span className="font-mono text-[11px] text-text-muted">
          Σ legs = {formatCurrency(data.realizedPnl, { withSign: true })}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {legs.map((leg) => (
          <div
            key={leg.label}
            className="flex flex-col gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-2.5"
          >
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
              {leg.label}
            </span>
            <span
              className="font-mono text-[14px] tabular-nums"
              style={{
                color:
                  leg.value > 0
                    ? 'var(--color-profit)'
                    : leg.value < 0
                      ? 'var(--color-loss)'
                      : 'var(--text-secondary)',
              }}
            >
              {formatCurrency(leg.value, { withSign: true })}
            </span>
            <span className="text-[10px] leading-snug text-text-muted">{leg.help}</span>
          </div>
        ))}
      </div>

      {(data.entrySlippagePct != null || data.sizeRatio != null) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-bd-subtle pt-3 font-mono text-[11px] text-text-muted">
          {data.entrySlippagePct != null && (
            <span>
              Entry slip:{' '}
              <span className="text-text-secondary">
                {data.entrySlippagePct >= 0 ? '+' : ''}
                {data.entrySlippagePct.toFixed(3)}%
              </span>
            </span>
          )}
          {data.sizeRatio != null && (
            <span>
              Size vs intent:{' '}
              <span className="text-text-secondary">{(data.sizeRatio * 100).toFixed(1)}%</span>
            </span>
          )}
        </div>
      )}
    </section>
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

/**
 * Manual close — places a Binance market order in the opposite direction
 * for the full remaining quantity of every open leg. Surfaces a confirm
 * dialog because this hits real money, and shows a loading/disabled state
 * during the network call so the user can't double-click and trigger two
 * close orders.
 *
 * Only renders for open trades; nothing to do on a CLOSED row.
 */
function CloseTradeButton({ trade }: { trade: Trades }) {
  const closeMutation = useCloseTrade();

  const openLegs = (trade.positions ?? []).filter((p) => p.exitTime == null);
  const remainingQty = openLegs.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  const baseAsset = trade.symbol.replace('USDT', '');

  const handleClose = () => {
    const qtyStr =
      remainingQty > 0
        ? `${remainingQty.toFixed(5)} ${baseAsset} across ${openLegs.length} leg${openLegs.length === 1 ? '' : 's'}`
        : 'all open legs';
    const ok = window.confirm(
      `Close ${trade.symbol} ${trade.direction}?\n\n` +
        `Places ONE Binance market ${trade.direction === 'LONG' ? 'SELL' : 'BUY'} ` +
        `for ${qtyStr}. Cannot be undone.`,
    );
    if (!ok) return;
    closeMutation.mutate(trade.id, {
      onSuccess: () =>
        toast.success({
          title: 'Trade closed',
          description: 'Realised P&L persisted; listener reconciled fills.',
        }),
      onError: (err) =>
        toast.error({ title: 'Could not close trade', description: normalizeError(err) }),
    });
  };

  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={closeMutation.isPending}
      title="Place a real Binance market order to flatten every open leg of this trade"
      className="border-[var(--color-loss)]/60 inline-flex items-center gap-1.5 rounded-sm border bg-[var(--bg-base)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-loss)] transition-colors hover:bg-[rgba(229,72,77,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {closeMutation.isPending ? (
        <Loader2 size={11} strokeWidth={1.75} className="animate-spin" />
      ) : (
        <X size={11} strokeWidth={1.75} />
      )}
      {closeMutation.isPending ? 'Closing…' : 'Close trade'}
    </button>
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
    <span className="inline-flex items-center rounded-sm bg-bg-base px-2 py-0.5 text-[11px] font-semibold tracking-wider text-text-secondary">
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
    <div className="rounded-xl border border-bd-subtle bg-bg-surface p-3">
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
