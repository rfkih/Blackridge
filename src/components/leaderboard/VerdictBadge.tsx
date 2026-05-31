import { cn } from '@/lib/utils';

/**
 * Small pill rendering a walk-forward / statistical verdict. Green for ROBUST,
 * red for explicit failure verdicts, neutral otherwise. Shared by the Backtest
 * and Research-paper leaderboard tabs.
 */
const ROBUST = new Set(['ROBUST', 'PASS', 'GRADUATE', 'CONSISTENT']);
const NEGATIVE = new Set(['FALSIFIED', 'FAIL', 'INCONSISTENT', 'REJECT', 'INSUFFICIENT_EVIDENCE']);

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: string | null | undefined;
  className?: string;
}) {
  const label = verdict ?? 'NO WALK-FWD';
  const upper = (verdict ?? '').toUpperCase();
  const tone = ROBUST.has(upper) ? 'profit' : NEGATIVE.has(upper) ? 'loss' : 'muted';

  const style =
    tone === 'profit'
      ? { color: 'var(--color-profit)', backgroundColor: 'rgba(22,179,100,0.12)' }
      : tone === 'loss'
        ? { color: 'var(--color-loss)', backgroundColor: 'rgba(229,72,77,0.12)' }
        : { color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]',
        className,
      )}
      style={style}
      title="Latest walk-forward / statistical verdict"
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}
