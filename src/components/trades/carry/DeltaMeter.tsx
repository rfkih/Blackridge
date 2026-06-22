import { cn } from '@/lib/utils';

interface DeltaMeterProps {
  spotQty: number;
  perpQty: number;
  /** Rebalance band as a fraction (0.02 = 2%). Beyond it the meter reads "drifted". */
  bandPct?: number;
  className?: string;
}

// ±10% residual delta saturates the meter to a full half-track.
const SATURATE = 0.1;

/**
 * Hedge-balance meter for a delta-neutral carry pair. Track centre = perfectly
 * hedged (spotQty == perpQty). The fill extends right (net long) or left (net
 * short) in proportion to the residual delta — teal while inside the rebalance
 * band, amber once it drifts beyond. This is the read a generic trades table
 * structurally can't give: "is this pair still market-neutral?"
 */
export function DeltaMeter({ spotQty, perpQty, bandPct = 0.02, className }: DeltaMeterProps) {
  const base = Math.max(Math.abs(spotQty), Math.abs(perpQty), 1e-12);
  const deltaPct = (spotQty - perpQty) / base; // + net long, - net short
  const drifted = Math.abs(deltaPct) > bandPct;
  const frac = Math.max(-1, Math.min(1, deltaPct / SATURATE));
  const fillPct = Math.abs(frac) * 50;
  const fillLeft = frac >= 0 ? 50 : 50 - fillPct;
  const accent = drifted ? 'var(--color-warning)' : 'var(--color-profit)';
  const label = `${deltaPct >= 0 ? '+' : ''}${(deltaPct * 100).toFixed(1)}%`;
  const title = drifted
    ? `Hedge drifted ${label} — beyond the ±${(bandPct * 100).toFixed(0)}% rebalance band`
    : `Hedged (Δ ${label})`;

  return (
    <div className={cn('flex items-center gap-2', className)} title={title}>
      <div className="relative h-1.5 w-16 shrink-0 rounded-full border border-bd-subtle bg-bg-base">
        {/* perfectly-hedged centre tick */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-text-muted opacity-50" />
        {/* residual-delta fill from centre */}
        <div
          className="absolute inset-y-0 rounded-full transition-[width,left] duration-300"
          style={{
            left: `${fillLeft}%`,
            width: `${Math.max(fillPct, deltaPct === 0 ? 0 : 1.5)}%`,
            background: accent,
          }}
        />
      </div>
      <span
        className="font-mono text-[11px] tabular-nums text-text-secondary"
        style={drifted ? { color: 'var(--color-warning)' } : undefined}
      >
        {label}
      </span>
    </div>
  );
}
