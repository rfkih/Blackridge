'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { formatDate, formatDuration, formatPrice, formatRMultiple } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  deriveTradeOutcome,
  legHitMap,
  type OutcomeTone,
  type TradeOutcome,
} from '@/lib/backtest/buildTradeMarkers';
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

/**
 * Sortable trade keys. `legs` is categorical (three hit-states per leg) and
 * doesn't have a meaningful linear ordering, so it's deliberately excluded
 * from the sort cycle. Everything else maps to a numeric / string extractor
 * in {@link SORT_EXTRACTORS} below.
 */
type SortKey =
  | 'index'
  | 'direction'
  | 'entryTime'
  | 'entryPrice'
  | 'exitTime'
  | 'exitPrice'
  | 'sl'
  | 'tp1'
  | 'tp2'
  | 'outcome'
  | 'pnl'
  | 'r'
  | 'duration';

type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey | 'legs'; label: string; sortable: boolean }> = [
  { key: 'index', label: '#', sortable: true },
  { key: 'direction', label: 'Side', sortable: true },
  { key: 'entryTime', label: 'Entry Time', sortable: true },
  { key: 'entryPrice', label: 'Entry', sortable: true },
  { key: 'exitTime', label: 'Exit Time', sortable: true },
  { key: 'exitPrice', label: 'Exit', sortable: true },
  { key: 'sl', label: 'SL', sortable: true },
  { key: 'tp1', label: 'TP1', sortable: true },
  { key: 'tp2', label: 'TP2', sortable: true },
  { key: 'legs', label: 'Legs', sortable: false },
  { key: 'outcome', label: 'Outcome', sortable: true },
  { key: 'pnl', label: 'P&L', sortable: true },
  { key: 'r', label: 'R', sortable: true },
  { key: 'duration', label: 'Duration', sortable: true },
];

/**
 * Pulls a comparable value out of a trade for each sort key. Returning
 * {@code null} pushes the row to the bottom regardless of direction —
 * users rarely want "N/A" cells pretending to be the smallest or largest
 * value in the column.
 */
const SORT_EXTRACTORS: Record<SortKey, (t: BacktestTrade) => number | string | null> = {
  index: (t) => t.entryTime, // # mirrors chronological order
  direction: (t) => t.direction,
  entryTime: (t) => t.entryTime,
  entryPrice: (t) => t.entryPrice,
  exitTime: (t) => t.exitTime,
  exitPrice: (t) => t.exitPrice,
  sl: (t) => t.stopLossPrice,
  tp1: (t) => t.tp1Price,
  tp2: (t) => t.tp2Price,
  outcome: (t) => deriveTradeOutcome(t.positions).label,
  pnl: (t) => t.realizedPnl,
  r: (t) => t.rMultiple,
  duration: (t) => (t.exitTime != null ? t.exitTime - t.entryTime : null),
};

// CSS grid template — keeps header + virtualized rows perfectly aligned.
// Total minimum width drives the horizontal scroll for narrower viewports.
const GRID_TEMPLATE =
  '40px 60px 150px 84px 150px 84px 80px 80px 80px 110px 92px 100px 64px 100px';
const ROW_HEIGHT = 36; // matches .py-2 + content baseline; virtualizer needs a stable estimate
const VIEWPORT_MAX_HEIGHT = 480;

export function BacktestTradeTable({
  trades,
  selectedTradeId,
  onTradeSelect,
  scrollTrigger,
}: BacktestTradeTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default view = chronological entry. Clicking a header cycles asc → desc →
  // back to the default; see handleSort below.
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const ordered = useMemo(() => {
    const extractor = SORT_EXTRACTORS[sortKey];
    const copy = [...trades];
    copy.sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      // Null always trails, regardless of direction. Keeps "no exit yet"
      // rows at the bottom when sorting on exitTime/exitPrice/duration.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      if (cmp === 0) {
        // Deterministic tiebreaker — entryTime, then id — so React/virtualizer
        // keys stay stable across equal sort values.
        cmp = a.entryTime - b.entryTime;
        if (cmp === 0) cmp = a.id.localeCompare(b.id);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortKey((prevKey) => {
        if (prevKey !== key) {
          // New column — start at asc for natural order; but default sort
          // (pnl, r, duration, exit*) feels more useful descending.
          const preferDesc: SortKey[] = ['pnl', 'r', 'duration', 'exitTime', 'entryTime'];
          setSortDir(preferDesc.includes(key) ? 'desc' : 'asc');
          return key;
        }
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      });
    },
    [],
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
        <div style={{ minWidth: 1200 }}>
          <div
            role="row"
            className="border-b border-bd-subtle bg-bg-surface"
            style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map((col) => {
              const isActive = col.sortable && col.key === sortKey;
              const ariaSort = isActive
                ? sortDir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none';
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  aria-sort={col.sortable ? ariaSort : undefined}
                  className="label-caps whitespace-nowrap px-3 py-2.5 text-left"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key as SortKey)}
                      className={cn(
                        'group inline-flex items-center gap-1 transition-colors duration-fast',
                        'focus:outline-none focus-visible:text-[var(--accent-primary)]',
                        isActive
                          ? 'text-[var(--accent-primary)]'
                          : 'text-text-muted hover:text-text-primary',
                      )}
                    >
                      <span>{col.label}</span>
                      <SortGlyph active={isActive} dir={sortDir} />
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </div>
              );
            })}
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

// ─── Sort glyph ───────────────────────────────────────────────────────────────

function SortGlyph({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    // Subtle double-chevron hint that the column is clickable. Keeps header
    // chrome consistent across all sortable columns without screaming.
    return (
      <ChevronsUpDown
        size={11}
        strokeWidth={2}
        className="opacity-40 transition-opacity group-hover:opacity-90"
        aria-hidden="true"
      />
    );
  }
  return dir === 'asc' ? (
    <ChevronUp size={12} strokeWidth={2.25} aria-hidden="true" />
  ) : (
    <ChevronDown size={12} strokeWidth={2.25} aria-hidden="true" />
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
  const outcome = deriveTradeOutcome(trade.positions);

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
        <OutcomePill outcome={outcome} />
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

/**
 * Colored pill summarizing how the trade ended (SL / TP / Trail / mix).
 * The hook is purely visual; sort keys + derivation live in the table logic.
 */
function OutcomePill({ outcome }: { outcome: TradeOutcome }) {
  const { bg, fg } = outcomePillColors(outcome.tone);
  return (
    <span
      className="font-mono text-[10px] font-semibold tracking-wider"
      title={outcome.description}
      aria-label={outcome.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      {outcome.label}
    </span>
  );
}

function outcomePillColors(tone: OutcomeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'profit':
      return { bg: 'rgba(0,200,150,0.15)', fg: 'var(--color-profit)' };
    case 'loss':
      return { bg: 'rgba(255,77,106,0.15)', fg: 'var(--color-loss)' };
    case 'warning':
      return { bg: 'rgba(245,166,35,0.15)', fg: 'var(--color-warning)' };
    case 'info':
      return { bg: 'rgba(78,158,255,0.15)', fg: 'var(--color-info)' };
    default:
      return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' };
  }
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
