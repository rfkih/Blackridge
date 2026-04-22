'use client';

import { memo } from 'react';
import { TrendingUp, Target, CircleDot, StopCircle, CheckCircle2 } from 'lucide-react';
import { PriceCell } from '@/components/shared/PriceCell';
import { PnlCell } from '@/components/shared/PnlCell';
import { formatDate, formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { TradeDirection, TradePosition } from '@/types/trading';

const TYPE_META: Record<
  TradePosition['type'],
  { label: string; icon: React.ElementType; subtle: string }
> = {
  SINGLE: { label: 'SINGLE', icon: CircleDot, subtle: 'Full size' },
  TP1: { label: 'TP1', icon: Target, subtle: 'First take-profit' },
  TP2: { label: 'TP2', icon: Target, subtle: 'Second take-profit' },
  RUNNER: { label: 'RUNNER', icon: TrendingUp, subtle: 'Trailing position' },
};

type ExitTone = 'win' | 'loss' | 'runner' | 'pending';

function classifyExit(pos: TradePosition): ExitTone {
  if (!pos.exitReason) return 'pending';
  switch (pos.exitReason) {
    case 'TP_HIT':
      return 'win';
    case 'SL_HIT':
      return 'loss';
    case 'RUNNER_CLOSE':
      return 'runner';
    case 'MANUAL_CLOSE':
      return pos.realizedPnl >= 0 ? 'win' : 'loss';
    case 'BACKTEST_END':
      return pos.realizedPnl >= 0 ? 'win' : 'loss';
    default:
      return 'pending';
  }
}

function toneColor(tone: ExitTone): string {
  switch (tone) {
    case 'win':
      return 'var(--color-profit)';
    case 'loss':
      return 'var(--color-loss)';
    case 'runner':
      return 'var(--color-info)';
    case 'pending':
    default:
      return 'var(--text-muted)';
  }
}

function toneTint(tone: ExitTone): string {
  switch (tone) {
    case 'win':
      return 'var(--tint-profit)';
    case 'loss':
      return 'var(--tint-loss)';
    case 'runner':
      return 'var(--tint-info)';
    case 'pending':
    default:
      return 'var(--bg-elevated)';
  }
}

const EXIT_LABEL: Record<NonNullable<TradePosition['exitReason']>, string> = {
  TP_HIT: 'TP hit',
  SL_HIT: 'SL hit',
  RUNNER_CLOSE: 'Runner close',
  MANUAL_CLOSE: 'Manual',
  BACKTEST_END: 'End of run',
};

interface TradePositionRowProps {
  position: TradePosition;
  /** Needed to pick TP prices and orient the leg visually. */
  direction: TradeDirection;
  /** If true, this leg contributes to unrealized P&L — show a pending state. */
  isOpen?: boolean;
  /** Live unrealized P&L for an open leg (optional). */
  liveUnrealizedPnl?: number | null;
  className?: string;
}

/**
 * A single position leg row. Not a table <tr> — rendered as a styled
 * card-row with a left accent edge coloured by the exit outcome. The parent
 * grid is owned by the list container so columns line up across siblings.
 */
export const TradePositionRow = memo(function TradePositionRow({
  position,
  direction,
  isOpen,
  liveUnrealizedPnl,
  className,
}: TradePositionRowProps) {
  const meta = TYPE_META[position.type];
  const Icon = meta.icon;
  const tone = classifyExit(position);
  const accent = toneColor(tone);
  const accentTint = toneTint(tone);

  const statusLabel = isOpen || position.exitTime == null ? 'Open' : 'Closed';
  const StatusIcon = statusLabel === 'Open' ? CircleDot : CheckCircle2;

  const exitReasonLabel = position.exitReason ? EXIT_LABEL[position.exitReason] : null;

  return (
    <div
      className={cn(
        'group relative grid items-center gap-3 rounded-md border border-bd-subtle bg-bg-surface',
        'grid-cols-[44px_minmax(120px,1.1fr)_minmax(100px,0.9fr)_minmax(100px,0.9fr)_minmax(110px,1fr)_minmax(90px,0.7fr)_minmax(110px,1fr)_minmax(130px,1.1fr)_minmax(130px,1.1fr)]',
        'px-3 py-2.5 transition-colors hover:bg-bg-elevated',
        className,
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
      aria-label={`${meta.label} leg · ${statusLabel}`}
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-md"
        style={{ backgroundColor: accentTint, color: accent }}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>

      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] font-semibold tracking-wider text-text-primary">
            {meta.label}
          </span>
          {position.type === 'RUNNER' && (
            <TrendingUp size={10} strokeWidth={2} className="text-info" aria-label="Trailing" />
          )}
          <span className="ml-1 text-[10px] uppercase tracking-wider text-text-muted">
            {direction}
          </span>
        </div>
        <span className="mt-0.5 text-[11px] text-text-muted">{meta.subtle}</span>
      </div>

      <span
        className="inline-flex items-center gap-1 self-start justify-self-start rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
        style={{
          backgroundColor: statusLabel === 'Open' ? 'var(--tint-info)' : 'var(--bg-elevated)',
          color: statusLabel === 'Open' ? 'var(--color-info)' : 'var(--text-secondary)',
        }}
      >
        <StatusIcon size={10} strokeWidth={2} />
        {statusLabel}
      </span>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">Entry</span>
        <PriceCell value={position.entryPrice} decimals={4} />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">Exit</span>
        <PriceCell value={position.exitPrice} decimals={4} />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">Qty</span>
        <span className="font-mono text-[13px] tabular-nums text-text-primary">
          {formatPrice(position.quantity, 4)}
        </span>
      </div>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">P&amp;L</span>
        {isOpen && liveUnrealizedPnl != null ? (
          <PnlCell value={liveUnrealizedPnl} />
        ) : position.exitTime != null ? (
          <PnlCell value={position.realizedPnl} noFlash />
        ) : (
          <StopCircle size={14} strokeWidth={1.5} className="text-text-muted" />
        )}
      </div>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">Exit reason</span>
        {exitReasonLabel ? (
          <span
            className="inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
            style={{ backgroundColor: accentTint, color: accent }}
          >
            {exitReasonLabel}
          </span>
        ) : (
          <span className="text-[12px] text-text-muted">—</span>
        )}
      </div>

      <div className="flex flex-col leading-tight">
        <span className="label-caps mb-0.5">Closed</span>
        <span className="font-mono text-[11px] text-text-muted">
          {position.exitTime != null ? formatDate(position.exitTime) : '—'}
        </span>
      </div>
    </div>
  );
});
