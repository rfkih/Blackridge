'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAllocation } from '@/hooks/useAllocation';

interface AllocationPanelProps {
  accountId: string | undefined;
}

const BTC_COLOR = '#F7931A';
// Canonical neutral track from the global (`br-card`) token set — matches the
// trading panels rather than the `--mm-*` namespace used by the stat cards.
const CASH_COLOR = 'var(--bg-hover)';

/**
 * A band gauge for a HEDGING account: the current BTC weight vs cash weight as
 * a single stacked bar, with a marker at the configured target weight. All
 * numbers come from `useAllocation` (the live balance read + the active
 * binding's target). When the account holds nothing (equity 0) it renders an
 * empty state rather than a misleading 0/0 bar.
 */
export function AllocationPanel({ accountId }: AllocationPanelProps) {
  const { btcWeightPct, cashWeightPct, targetWeightPct, equity } = useAllocation(accountId);

  const btcW = Math.max(0, Math.min(100, btcWeightPct));
  const cashW = Math.max(0, Math.min(100, cashWeightPct));

  return (
    <div className="br-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div
            className="text-[14px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            Allocation
          </div>
          <div className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            {targetWeightPct != null ? (
              <span data-testid="target-label">Target {targetWeightPct.toFixed(0)}% BTC</span>
            ) : (
              <span>no target configured</span>
            )}
          </div>
        </div>
      </div>

      {equity <= 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 16,
            color: 'var(--text-muted)',
            fontSize: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span>No active hedging allocation yet.</span>
          <Link href="/strategies" className="br-btn br-btn-primary br-btn-sm">
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            Add a hedging strategy
          </Link>
        </div>
      ) : (
        <>
          {/* stacked BTC / cash bar with a target marker overlay */}
          <div
            style={{
              position: 'relative',
              height: 28,
              borderRadius: 8,
              overflow: 'hidden',
              background: CASH_COLOR,
              display: 'flex',
            }}
          >
            <div style={{ width: `${btcW}%`, background: BTC_COLOR }} />
            {targetWeightPct != null && (
              <div
                data-testid="target-marker"
                aria-label={`Target ${targetWeightPct.toFixed(0)} percent`}
                style={{
                  position: 'absolute',
                  top: -2,
                  bottom: -2,
                  left: `${Math.max(0, Math.min(100, targetWeightPct))}%`,
                  width: 2,
                  background: 'var(--text-primary)',
                }}
              />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-[14px]">
            <span className="font-mono tabular-nums" style={{ color: BTC_COLOR }}>
              BTC {btcW.toFixed(2)}%
            </span>
            {targetWeightPct != null && (
              <span className="font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                Target {targetWeightPct.toFixed(0)}%
              </span>
            )}
            <span className="font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              Cash {cashW.toFixed(2)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
