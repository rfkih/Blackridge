'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDate, formatDuration, formatPrice, formatRMultiple } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { legHitMap } from '@/lib/backtest/buildTradeMarkers';
import type { BacktestTrade } from '@/types/backtest';
import type { PositionExitReason, PositionType } from '@/types/trading';

interface BacktestTradeTableProps {
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
  /**
   * When changed, the currently selected row is scrolled into view. Used so the
   * chart can nudge the table after a marker click.
   */
  scrollTrigger?: number;
}

const COLUMNS = [
  { key: 'index', label: '#' },
  { key: 'direction', label: 'Side' },
  { key: 'entryTime', label: 'Entry Time' },
  { key: 'entryPrice', label: 'Entry' },
  { key: 'exitTime', label: 'Exit Time' },
  { key: 'exitPrice', label: 'Exit' },
  { key: 'sl', label: 'SL' },
  { key: 'tp1', label: 'TP1' },
  { key: 'tp2', label: 'TP2' },
  { key: 'legs', label: 'Legs' },
  { key: 'pnl', label: 'P&L' },
  { key: 'r', label: 'R' },
  { key: 'duration', label: 'Duration' },
];

// CSS grid template — keeps header + virtualized rows perfectly aligned.
// Total minimum width drives the horizontal scroll for narrower viewports.
const GRID_TEMPLATE =
  '40px 60px 150px 84px 150px 84px 80px 80px 80px 110px 100px 64px 100px';
const ROW_HEIGHT = 36; // matches .py-2 + content baseline; virtualizer needs a stable estimate
const VIEWPORT_MAX_HEIGHT = 480;

export function BacktestTradeTable({
  trades,
  selectedTradeId,
  onTradeSelect,
  scrollTrigger,
}: BacktestTradeTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort chronologically for a natural read order.
  const ordered = useMemo(
    () => [...trades].sort((a, b) => a.entryTime - b.entryTime),
    [trades],
  );

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < ordered.length; i++) m.set(ordered[i].id, i);
    return m;
  }, [ordered]);

  const virtualizer = useVirtualizer({
    count: ordered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // Scroll the selected row into view when the chart asks for it. With
  // virtualization there are no row DOM refs to .scrollIntoView() — the
  // virtualizer's scrollToIndex is the equivalent primitive.
  useEffect(() => {
    if (!scrollTrigger || !selectedTradeId) return;
    const idx = indexById.get(selectedTradeId);
    if (idx == null) return;
    virtualizer.scrollToIndex(idx, { align: 'center' });
  }, [scrollTrigger, selectedTradeId, indexById, virtualizer]);

  const handleRowClick = useCallback(
    (tradeId: string) => {
      onTradeSelect(tradeId === selectedTradeId ? null : tradeId);
    },
    [onTradeSelect, selectedTradeId],
  );

  if (!ordered.length) {
    return (
      <div className="rounded-md border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
        No trades were produced by this backtest.
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      role="table"
      aria-rowcount={ordered.length + 1}
      className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface"
    >
      {/* Horizontal scroll wrapper so narrow viewports don't squash columns. */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 1100 }}>
          <div
            role="row"
            className="border-b border-bd-subtle bg-bg-surface"
            style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                role="columnheader"
                className="label-caps whitespace-nowrap px-3 py-2.5 text-left"
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Vertical scroll viewport — only the row in view is rendered. */}
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ maxHeight: VIEWPORT_MAX_HEIGHT }}
          >
            <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
              {items.map((vi) => {
                const trade = ordered[vi.index];
                const isSelected = trade.id === selectedTradeId;
                return (
                  <VirtualRow
                    key={trade.id}
                    trade={trade}
                    index={vi.index + 1}
                    isSelected={isSelected}
                    top={vi.start}
                    onClick={() => handleRowClick(trade.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface VirtualRowProps {
  trade: BacktestTrade;
  index: number;
  isSelected: boolean;
  top: number;
  onClick: () => void;
}

function VirtualRow({ trade, index, isSelected, top, onClick }: VirtualRowProps) {
  const duration = trade.exitTime != null ? trade.exitTime - trade.entryTime : null;
  const pnlUp = trade.realizedPnl >= 0;
  const isLong = trade.direction === 'LONG';
  const hits = legHitMap(trade.positions);

  return (
    <div
      role="row"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      className={cn(
        'cursor-pointer border-b border-bd-subtle transition-colors duration-fast',
        'hover:bg-bg-elevated',
        isSelected && 'border-l-2 border-l-[var(--accent-primary)] bg-[var(--bg-hover)]',
      )}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: ROW_HEIGHT,
        transform: `translateY(${top}px)`,
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: 'center',
      }}
    >
      <Cell muted>{`#${index}`}</Cell>
      <Cell>
        <span
          className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
          style={{
            background: isLong ? 'rgba(0,200,150,0.15)' : 'rgba(255,77,106,0.15)',
            color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
          }}
        >
          {trade.direction}
        </span>
      </Cell>
      <Cell secondary size="sm">
        {formatDate(trade.entryTime)}
      </Cell>
      <Cell>{formatPrice(trade.entryPrice)}</Cell>
      <Cell secondary size="sm">
        {trade.exitTime != null ? formatDate(trade.exitTime) : '—'}
      </Cell>
      <Cell>{formatPrice(trade.exitPrice)}</Cell>
      <Cell muted>{formatPrice(trade.stopLossPrice)}</Cell>
      <Cell muted>{formatPrice(trade.tp1Price)}</Cell>
      <Cell muted>{formatPrice(trade.tp2Price)}</Cell>
      <Cell>
        <LegDots hits={hits} />
      </Cell>
      <Cell>
        <span
          className="num text-[12px] font-semibold"
          style={{ color: pnlUp ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {pnlUp ? '+' : ''}
          {formatPrice(trade.realizedPnl)}
        </span>
      </Cell>
      <Cell>
        <span
          className="num text-[11px]"
          style={{ color: trade.rMultiple >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {formatRMultiple(trade.rMultiple)}
        </span>
      </Cell>
      <Cell muted size="sm">
        {duration != null ? formatDuration(duration) : '—'}
      </Cell>
    </div>
  );
}

interface CellProps {
  children: React.ReactNode;
  muted?: boolean;
  secondary?: boolean;
  size?: 'sm';
}

function Cell({ children, muted, secondary, size }: CellProps) {
  return (
    <div
      role="cell"
      className={cn(
        'num truncate whitespace-nowrap px-3',
        size === 'sm' ? 'text-[11px]' : 'text-[12px]',
        muted ? 'text-text-muted' : secondary ? 'text-text-secondary' : 'text-text-primary',
      )}
    >
      {children}
    </div>
  );
}

const LEG_ORDER: PositionType[] = ['TP1', 'TP2', 'RUNNER'];

function LegDots({ hits }: { hits: Partial<Record<PositionType, PositionExitReason | null>> }) {
  return (
    <div className="flex items-center gap-1">
      {LEG_ORDER.map((type) => {
        const reason = hits[type];
        const color = legDotColor(reason);
        const tooltip = reason ? `${type}: ${reason}` : `${type}: not reached`;
        return (
          <span
            key={type}
            aria-label={tooltip}
            title={tooltip}
            className="flex items-center gap-0.5"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: color }}
            />
            <span className="font-mono text-[9px] uppercase text-text-muted">
              {type === 'RUNNER' ? 'R' : type.replace('TP', 'T')}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function legDotColor(reason: PositionExitReason | null | undefined): string {
  switch (reason) {
    case 'TP_HIT':
      return 'var(--color-profit)';
    case 'RUNNER_CLOSE':
      return 'var(--color-info)';
    case 'SL_HIT':
      return 'var(--color-loss)';
    case 'MANUAL_CLOSE':
    case 'BACKTEST_END':
      return 'var(--color-warning)';
    default:
      return 'var(--text-muted)';
  }
}
