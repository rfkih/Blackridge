'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PriceCell } from '@/components/shared/PriceCell';
import { usePositionStore } from '@/store/positionStore';
import { formatPnl, formatPercent, formatAge } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { LivePosition } from '@/types/trading';

// ─── Live P&L cell with background flash on update ──────────────────────────

interface LivePnlCellProps {
  tradeId: string;
  basePnl: number | null | undefined;
  basePct: number | null | undefined;
}

function LivePnlCell({ tradeId, basePnl, basePct }: LivePnlCellProps) {
  const pnlMap = usePositionStore((s) => s.pnlMap);
  const livePnl = pnlMap[tradeId] ?? basePnl ?? 0;
  const [flash, setFlash] = useState<'profit' | 'loss' | null>(null);
  const prevRef = useRef(livePnl);

  useEffect(() => {
    if (livePnl === prevRef.current) return;
    const next: 'profit' | 'loss' = livePnl > prevRef.current ? 'profit' : 'loss';
    prevRef.current = livePnl;
    setFlash(next);
    const t = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(t);
  }, [livePnl]);

  const isProfit = livePnl >= 0;

  return (
    <span
      className={cn(
        '-mx-1 rounded px-1 font-mono tabular-nums text-sm transition-[background-color] duration-300',
        isProfit ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]',
      )}
      style={{
        backgroundColor:
          flash === 'profit'
            ? 'rgba(0,200,150,0.15)'
            : flash === 'loss'
              ? 'rgba(255,77,106,0.15)'
              : 'transparent',
      }}
    >
      {formatPnl(livePnl)}
      <span className="ml-1.5 text-xs opacity-60">{formatPercent(basePct)}</span>
    </span>
  );
}

// ─── Direction badge ─────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: 'LONG' | 'SHORT' }) {
  const isLong = direction === 'LONG';
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
      style={{
        backgroundColor: isLong ? 'rgba(0,200,150,0.1)' : 'rgba(255,77,106,0.1)',
        color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
        border: `1px solid ${isLong ? 'rgba(0,200,150,0.25)' : 'rgba(255,77,106,0.25)'}`,
      }}
    >
      {direction}
    </span>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function PositionRow({ position }: { position: LivePosition }) {
  return (
    <tr className="group border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)]">
      <td className="px-4 py-2.5">
        <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
          {position.symbol}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <DirectionBadge direction={position.direction} />
      </td>
      <td className="px-4 py-2.5">
        <PriceCell value={position.entryPrice} />
      </td>
      <td className="px-4 py-2.5">
        <PriceCell value={position.markPrice} />
      </td>
      <td className="px-4 py-2.5">
        <LivePnlCell
          tradeId={position.tradeId}
          basePnl={position.unrealizedPnl}
          basePct={position.unrealizedPnlPct}
        />
      </td>
      <td className="px-4 py-2.5">
        <span className="font-mono tabular-nums text-xs text-[var(--text-muted)]">
          {formatAge(position.openedAt)}
        </span>
      </td>
    </tr>
  );
}

// ─── Skeleton rows ───────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--border-subtle)]">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

const COLUMNS = ['Symbol', 'Direction', 'Entry Price', 'Mark Price', 'Unreal. P&L', 'Duration'];

interface OpenPositionsPanelProps {
  positions: LivePosition[];
  isLoading: boolean;
  className?: string;
}

export function OpenPositionsPanel({ positions, isLoading, className }: OpenPositionsPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Open Positions
          </h2>
          {!isLoading && (
            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              {positions.length}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
          <span className="inline-block size-1.5 rounded-full bg-[var(--color-profit)] [animation:pulse_2s_ease-in-out_infinite]" />
          LIVE
        </span>
      </div>

      {/* Table — flex-1 so it fills remaining panel height and scrolls */}
      {positions.length === 0 && !isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Activity}
            title="No open positions"
            description="Active trades will appear here in real time."
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[640px]">
            <thead className="sticky top-0 bg-[var(--bg-surface)]">
              <tr className="border-b border-[var(--border-subtle)]">
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : (
                positions.map((pos) => <PositionRow key={pos.tradeId} position={pos} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
