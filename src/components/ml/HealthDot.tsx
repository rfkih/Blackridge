import { cn } from '@/lib/utils';
import type { HealthVerdict } from '@/types/ml';

const DOT_STYLES: Record<HealthVerdict, string> = {
  green: 'bg-emerald-400 ring-emerald-500/40',
  amber: 'bg-amber-400 ring-amber-500/40',
  red: 'bg-rose-400 ring-rose-500/40',
};

const LABEL: Record<HealthVerdict, string> = {
  green: 'healthy',
  amber: 'warn',
  red: 'broken',
};

/**
 * Three-state health indicator dot. The frontend never renders the raw
 * `health` string — always through this component so the colour grammar
 * stays consistent with the existing strategy status pills.
 */
export function HealthDot({
  health,
  reason,
  className,
}: {
  health: HealthVerdict;
  reason?: string | null;
  className?: string;
}) {
  const titleText = reason ? `${LABEL[health]}: ${reason}` : LABEL[health];
  return (
    <span
      aria-label={titleText}
      title={titleText}
      className={cn(
        'inline-block h-2 w-2 rounded-full ring-2 ring-offset-0',
        DOT_STYLES[health],
        className,
      )}
    />
  );
}
