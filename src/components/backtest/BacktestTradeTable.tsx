'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronsUpDown, ChevronUp, X } from 'lucide-react';
import { formatDate, formatDuration, formatPrice, formatRMultiple } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  deriveTradeOutcome,
  legHitMap,
  type OutcomeTone,
  type TradeOutcome,
} from '@/lib/backtest/buildTradeMarkers';
import { isHedging } from '@/lib/strategyKind';
import type { BacktestTrade } from '@/types/backtest';
import type { PositionExitReason, PositionType } from '@/types/trading';

interface BacktestTradeTableProps {
  trades: BacktestTrade[];
  selectedTradeId: string | null;
  onTradeSelect: (tradeId: string | null) => void;
  /** Tick to scroll the selected row into view (chart → table sync). */
  scrollTrigger?: number;
  /** Emit filtered trades so the chart can mirror the same set of markers. */
  onFilteredTradesChange?: (filtered: BacktestTrade[]) => void;
  /** Strategy kind from the run object. When "HEDGING", SL / TP / R-multiple
   *  columns are hidden and the "Side" column is re-labelled as "Switch" to
   *  frame trades as BTC↔cash allocation switches. */
  strategyKind?: string | null;
}

/**
 * Sortable trade keys. `legs` is categorical (three hit-states per leg) and
 * doesn't have a meaningful linear ordering, so it's deliberately excluded
 * from the sort cycle. Everything else maps to a numeric / string extractor
 * in {@link SORT_EXTRACTORS} below.
 */
type SortKey =
  | 'index'
  | 'strategy'
  | 'interval'
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

/** Full trading column set. */
const TRADING_COLUMNS: Array<{ key: SortKey | 'legs'; label: string; sortable: boolean }> = [
  { key: 'index', label: '#', sortable: true },
  { key: 'strategy', label: 'Strategy', sortable: true },
  { key: 'interval', label: 'TF', sortable: true },
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
 * Hedging column set: SL / TP1 / TP2 / Legs / R are hidden because hedging
 * strategies do not use stop-loss, take-profit, or R-multiples. "Side" is
 * re-labelled "Switch" to frame each row as a BTC↔cash allocation change.
 */
const HEDGING_COLUMNS: Array<{ key: SortKey | 'legs'; label: string; sortable: boolean }> = [
  { key: 'index', label: '#', sortable: true },
  { key: 'strategy', label: 'Strategy', sortable: true },
  { key: 'interval', label: 'TF', sortable: true },
  { key: 'direction', label: 'Switch', sortable: true },
  { key: 'entryTime', label: 'Entry Time', sortable: true },
  { key: 'entryPrice', label: 'Entry', sortable: true },
  { key: 'exitTime', label: 'Exit Time', sortable: true },
  { key: 'exitPrice', label: 'Exit', sortable: true },
  { key: 'outcome', label: 'Outcome', sortable: true },
  { key: 'pnl', label: 'P&L', sortable: true },
  { key: 'duration', label: 'Duration', sortable: true },
];

/**
 * Pulls a comparable value out of a trade for each sort key. Returning
 * {@code null} pushes the row to the bottom regardless of direction —
 * users rarely want "N/A" cells pretending to be the smallest or largest
 * value in the column.
 */
const SORT_EXTRACTORS: Record<SortKey, (t: BacktestTrade) => number | string | null> = {
  index: (t) => t.entryTime,
  strategy: (t) => t.strategyCode ?? t.strategyName ?? '',
  interval: (t) => t.interval ?? '',
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

const TRADING_GRID_TEMPLATE =
  '40px 92px 56px 60px 150px 84px 150px 84px 80px 80px 80px 110px 92px 100px 64px 100px';
/** Narrower template matching HEDGING_COLUMNS (no SL/TP/Legs/R). */
const HEDGING_GRID_TEMPLATE =
  '40px 92px 56px 72px 150px 84px 150px 84px 92px 100px 100px';

const ROW_HEIGHT = 36;
const VIEWPORT_MAX_HEIGHT = 480;

type PnlSign = 'all' | 'profit' | 'loss' | 'breakeven';

interface FilterState {
  strategies: Set<string>;
  directions: Set<'LONG' | 'SHORT'>;
  outcomes: Set<string>;
  intervals: Set<string>;
  pnlSign: PnlSign;
}

const EMPTY_FILTERS: FilterState = {
  strategies: new Set(),
  directions: new Set(),
  outcomes: new Set(),
  intervals: new Set(),
  pnlSign: 'all',
};

function isFilterActive(f: FilterState): boolean {
  return (
    f.strategies.size > 0 ||
    f.directions.size > 0 ||
    f.outcomes.size > 0 ||
    f.intervals.size > 0 ||
    f.pnlSign !== 'all'
  );
}

function tradeStrategyKey(t: BacktestTrade): string {
  return t.strategyCode ?? t.strategyName ?? 'UNKNOWN';
}

function applyFilters(trades: BacktestTrade[], f: FilterState): BacktestTrade[] {
  if (!isFilterActive(f)) return trades;
  return trades.filter((t) => {
    if (f.strategies.size > 0 && !f.strategies.has(tradeStrategyKey(t))) return false;
    if (f.directions.size > 0 && !f.directions.has(t.direction)) return false;
    if (f.intervals.size > 0 && !f.intervals.has(t.interval ?? '—')) return false;
    if (f.outcomes.size > 0) {
      const label = deriveTradeOutcome(t.positions).label;
      if (!f.outcomes.has(label)) return false;
    }
    if (f.pnlSign !== 'all') {
      const pnl = t.realizedPnl;
      if (f.pnlSign === 'profit' && pnl <= 0) return false;
      if (f.pnlSign === 'loss' && pnl >= 0) return false;
      if (f.pnlSign === 'breakeven' && Math.abs(pnl) > 0.0001) return false;
    }
    return true;
  });
}

export function BacktestTradeTable({
  trades,
  selectedTradeId,
  onTradeSelect,
  scrollTrigger,
  onFilteredTradesChange,
  strategyKind,
}: BacktestTradeTableProps) {
  const hedging = isHedging(strategyKind);
  const COLUMNS = hedging ? HEDGING_COLUMNS : TRADING_COLUMNS;
  const GRID_TEMPLATE = hedging ? HEDGING_GRID_TEMPLATE : TRADING_GRID_TEMPLATE;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const filterOptions = useMemo(() => {
    const strategies = new Set<string>();
    const intervals = new Set<string>();
    const outcomes = new Set<string>();
    let hasLong = false;
    let hasShort = false;
    for (const t of trades) {
      strategies.add(tradeStrategyKey(t));
      intervals.add(t.interval ?? '—');
      outcomes.add(deriveTradeOutcome(t.positions).label);
      if (t.direction === 'LONG') hasLong = true;
      if (t.direction === 'SHORT') hasShort = true;
    }
    return {
      strategies: Array.from(strategies).sort(),
      intervals: Array.from(intervals).sort(),
      outcomes: Array.from(outcomes).sort(),
      directions: [hasLong && 'LONG', hasShort && 'SHORT'].filter(Boolean) as Array<
        'LONG' | 'SHORT'
      >,
    };
  }, [trades]);

  const filtered = useMemo(() => applyFilters(trades, filters), [trades, filters]);

  useEffect(() => {
    onFilteredTradesChange?.(filtered);
  }, [filtered, onFilteredTradesChange]);

  const ordered = useMemo(() => {
    const extractor = SORT_EXTRACTORS[sortKey];
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);

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
        cmp = a.entryTime - b.entryTime;
        if (cmp === 0) cmp = a.id.localeCompare(b.id);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        const preferDesc: SortKey[] = ['pnl', 'r', 'duration', 'exitTime', 'entryTime'];
        setSortDir(preferDesc.includes(key) ? 'desc' : 'asc');
        return key;
      }
      setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  }, []);

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

  if (!trades.length) {
    return (
      <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
        No trades were produced by this backtest.
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const filtersActive = isFilterActive(filters);

  return (
    <div className="space-y-2">
      <BacktestTradeFilters
        options={filterOptions}
        filters={filters}
        onChange={setFilters}
        totalCount={trades.length}
        visibleCount={ordered.length}
      />
      {ordered.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
          {filtersActive
            ? 'No trades match the active filters.'
            : 'No trades were produced by this backtest.'}
        </div>
      ) : (
    <div
      role="table"
      aria-rowcount={ordered.length + 1}
      className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface"
    >
      {}
      <div className="overflow-x-auto">
        <div style={{ minWidth: hedging ? 900 : 1348 }}>
          <div
            role="row"
            className="border-b border-bd-subtle bg-bg-surface"
            style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map((col) => {
              const isActive = col.sortable && col.key === sortKey;
              const ariaSort = isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
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

          {}
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
                    gridTemplate={GRID_TEMPLATE}
                    hedging={hedging}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}

interface FilterOptions {
  strategies: string[];
  intervals: string[];
  outcomes: string[];
  directions: Array<'LONG' | 'SHORT'>;
}

interface BacktestTradeFiltersProps {
  options: FilterOptions;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  totalCount: number;
  visibleCount: number;
}

function BacktestTradeFilters({
  options,
  filters,
  onChange,
  totalCount,
  visibleCount,
}: BacktestTradeFiltersProps) {
  const toggleSet = <T extends string>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handleStrategy = (s: string) =>
    onChange({ ...filters, strategies: toggleSet(filters.strategies, s) });
  const handleInterval = (i: string) =>
    onChange({ ...filters, intervals: toggleSet(filters.intervals, i) });
  const handleDirection = (d: 'LONG' | 'SHORT') =>
    onChange({ ...filters, directions: toggleSet(filters.directions, d) });
  const handleOutcome = (o: string) =>
    onChange({ ...filters, outcomes: toggleSet(filters.outcomes, o) });
  const handlePnlSign = (s: PnlSign) =>
    onChange({ ...filters, pnlSign: filters.pnlSign === s ? 'all' : s });
  const reset = () => onChange(EMPTY_FILTERS);

  const active = isFilterActive(filters);
  const hasMultiStrategy = options.strategies.length > 1;
  const hasMultiInterval = options.intervals.length > 1;
  const hasBothDirections = options.directions.length > 1;
  const hasMultiOutcome = options.outcomes.length > 1;

  return (
    <div className="rounded-xl border border-bd-subtle bg-bg-surface p-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        {hasMultiStrategy && (
          <FilterDimension label="Strategy">
            {options.strategies.map((s) => (
              <FilterPill
                key={s}
                active={filters.strategies.has(s)}
                onClick={() => handleStrategy(s)}
              >
                {s}
              </FilterPill>
            ))}
          </FilterDimension>
        )}

        {hasBothDirections && (
          <FilterDimension label="Side">
            {options.directions.map((d) => (
              <FilterPill
                key={d}
                active={filters.directions.has(d)}
                onClick={() => handleDirection(d)}
                tone={d === 'LONG' ? 'profit' : 'loss'}
              >
                {d}
              </FilterPill>
            ))}
          </FilterDimension>
        )}

        <FilterDimension label="P&amp;L">
          <FilterPill
            active={filters.pnlSign === 'profit'}
            onClick={() => handlePnlSign('profit')}
            tone="profit"
          >
            Winners
          </FilterPill>
          <FilterPill
            active={filters.pnlSign === 'loss'}
            onClick={() => handlePnlSign('loss')}
            tone="loss"
          >
            Losers
          </FilterPill>
          <FilterPill
            active={filters.pnlSign === 'breakeven'}
            onClick={() => handlePnlSign('breakeven')}
          >
            Breakeven
          </FilterPill>
        </FilterDimension>

        {hasMultiOutcome && (
          <FilterDimension label="Outcome">
            {options.outcomes.map((o) => (
              <FilterPill
                key={o}
                active={filters.outcomes.has(o)}
                onClick={() => handleOutcome(o)}
              >
                {o}
              </FilterPill>
            ))}
          </FilterDimension>
        )}

        {hasMultiInterval && (
          <FilterDimension label="TF">
            {options.intervals.map((i) => (
              <FilterPill
                key={i}
                active={filters.intervals.has(i)}
                onClick={() => handleInterval(i)}
              >
                {i}
              </FilterPill>
            ))}
          </FilterDimension>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {visibleCount === totalCount
              ? `${totalCount.toLocaleString()} trades`
              : `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()}`}
          </span>
          {active && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <X size={10} strokeWidth={2} /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterDimension({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: 'profit' | 'loss';
  children: React.ReactNode;
}) {
  const activeBg =
    tone === 'profit'
      ? 'var(--tint-profit)'
      : tone === 'loss'
        ? 'var(--tint-loss)'
        : 'var(--accent-glow)';
  const activeFg =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--accent-primary)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider transition-colors duration-fast',
        active
          ? 'border-transparent'
          : 'border-bd-subtle text-text-muted hover:border-bd-default hover:text-text-primary',
      )}
      style={
        active
          ? { background: activeBg, color: activeFg, borderColor: activeFg }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function SortGlyph({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
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

interface VirtualRowProps {
  trade: BacktestTrade;
  index: number;
  isSelected: boolean;
  top: number;
  onClick: () => void;
  gridTemplate: string;
  /** When true, SL / TP / R-multiple / Legs cells are omitted. */
  hedging: boolean;
}

function VirtualRow({ trade, index, isSelected, top, onClick, gridTemplate, hedging }: VirtualRowProps) {
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
        'hover:bg-bg-hover',
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
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
      }}
    >
      <Cell muted>{`#${index}`}</Cell>
      <Cell>
        {trade.strategyCode || trade.strategyName ? (
          <span
            className="rounded-sm border border-bd-subtle bg-bg-base px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-text-primary"
            title={trade.strategyName ?? trade.strategyCode ?? ''}
          >
            {trade.strategyCode ?? trade.strategyName}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </Cell>
      <Cell muted>{trade.interval ?? '—'}</Cell>
      <Cell>
        {hedging ? (
          // A hedging tilt is long/flat: each row is a BTC-holding episode that
          // exits to cash. Frame the "Switch" as the allocation held, not LONG/SHORT.
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
            style={{ background: 'var(--tint-btc)', color: 'var(--color-btc)' }}
            title="Allocated to BTC for this period, then switched back to cash on exit"
          >
            {isLong ? '→ BTC' : '→ Cash'}
          </span>
        ) : (
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
            style={{
              background: isLong ? 'var(--tint-profit)' : 'var(--tint-loss)',
              color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
            }}
          >
            {trade.direction}
          </span>
        )}
      </Cell>
      <Cell secondary size="sm">
        {formatDate(trade.entryTime)}
      </Cell>
      <Cell>{formatPrice(trade.entryPrice)}</Cell>
      <Cell secondary size="sm">
        {trade.exitTime != null ? formatDate(trade.exitTime) : '—'}
      </Cell>
      <Cell>{formatPrice(trade.exitPrice)}</Cell>
      {!hedging && <Cell muted>{formatPrice(trade.stopLossPrice)}</Cell>}
      {!hedging && <Cell muted>{formatPrice(trade.tp1Price)}</Cell>}
      {!hedging && <Cell muted>{formatPrice(trade.tp2Price)}</Cell>}
      {!hedging && (
        <Cell>
          <LegDots hits={hits} />
        </Cell>
      )}
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
      {!hedging && (
        <Cell>
          <span
            className="num text-[11px]"
            style={{ color: trade.rMultiple >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
          >
            {formatRMultiple(trade.rMultiple)}
          </span>
        </Cell>
      )}
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
      return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)' };
    case 'loss':
      return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)' };
    case 'warning':
      return { bg: 'rgba(245,166,35,0.15)', fg: 'var(--color-warning)' };
    case 'info':
      return { bg: 'rgba(59,130,246,0.15)', fg: 'var(--color-info)' };
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
