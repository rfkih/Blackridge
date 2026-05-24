import { cn } from '@/lib/utils';

/**
 * 7-segment 7-day coverage indicator. Each segment is one day. Colour
 * encodes coverage of that day's expected fires:
 *   green = ≥ 90%, amber = 50–90%, red = < 50%.
 *
 * Phase 1 input is just the rolling ratio (no per-day breakdown yet) —
 * we fill the bar uniformly to the ratio. Phase 2's per-day endpoint
 * (`/signals/{id}/daily-counts`) gives the real per-segment colouring.
 */
const SEGMENTS = 7;

export function CoverageBar({ ratio, className }: { ratio: number | null; className?: string }) {
  if (ratio === null) {
    return (
      <span
        aria-label="coverage unknown"
        className={cn('inline-flex h-2 w-24 rounded bg-zinc-700/30', className)}
      />
    );
  }
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * SEGMENTS);
  const fillColour =
    ratio >= 0.9 ? 'bg-emerald-400/80' : ratio >= 0.5 ? 'bg-amber-400/80' : 'bg-rose-400/80';
  return (
    <span
      aria-label={`coverage ${(ratio * 100).toFixed(0)}%`}
      className={cn('inline-flex h-2 items-stretch gap-0.5', className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn('w-3 rounded-sm', i < filled ? fillColour : 'bg-zinc-700/40')}
        />
      ))}
    </span>
  );
}
