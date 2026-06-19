'use client';

import Link from 'next/link';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';

/**
 * Surfaces a count + summary of strategies whose drawdown kill-switch has
 * tripped. Renders nothing when no strategy is tripped — the dashboard
 * stays quiet on the happy path. When at least one is tripped, shows a red
 * alert chip with the count and links to /strategies where the per-card
 * Re-arm button lives.
 *
 * Why a banner and not a toast: kill-switch trips persist until the user
 * acks them. A toast would dismiss after a few seconds and the user could
 * miss it; the banner stays until the underlying flag clears server-side.
 */
export function KillSwitchBanner() {
  const { data: strategies = [] } = useStrategies();
  const { scopedAccountId } = useActiveAccount();

  const visible = scopedAccountId
    ? strategies.filter((s) => s.accountId === scopedAccountId)
    : strategies;

  const tripped = visible.filter((s) => s.isKillSwitchTripped);
  if (tripped.length === 0) return null;

  const sample = tripped[0];
  const summary =
    tripped.length === 1
      ? `${sample.strategyCode} · ${sample.symbol} ${sample.interval}`
      : `${sample.strategyCode} +${tripped.length - 1} more`;

  return (
    <Link
      href="/strategies"
      className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:-translate-y-px hover:shadow-glow-loss"
      style={{
        borderColor: 'rgba(229,72,77,0.32)',
        background: 'rgba(229,72,77,0.08)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      role="alert"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: 'rgba(229,72,77,0.16)',
          color: 'var(--color-loss)',
        }}
      >
        <ShieldAlert size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--color-loss)' }}
        >
          Kill-switch tripped · {tripped.length}
        </span>
        <span className="truncate text-xs text-[var(--text-secondary)]">
          {summary} — new entries blocked until manually re-armed.
        </span>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--color-loss)' }} />
    </Link>
  );
}
