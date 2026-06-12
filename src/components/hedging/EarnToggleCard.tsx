'use client';

import { Switch } from '@/components/ui/switch';
import { useActiveAccount, useUpdateAccountEarnConfig } from '@/hooks/useAccounts';
import { useEarnPosition } from '@/hooks/useEarnPosition';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';

/**
 * Per-account opt-in for idle-cash Simple Earn yield. HEDGING accounts only.
 * The toggle reflects the account's own preference (account.earnEnabled); the
 * feature also needs the deploy-level master switch to actually run, so when the
 * user opts in but the platform feature isn't live yet we say so.
 */
export function EarnToggleCard() {
  const { activeAccount } = useActiveAccount();
  const mutation = useUpdateAccountEarnConfig();
  // Same account source as the toggle, so the hint and the switch never diverge.
  const earn = useEarnPosition(activeAccount?.id);

  // Earn is a hedging-only feature.
  if (!activeAccount || activeAccount.accountType !== 'HEDGING') return null;

  // Optimistic display: while the toggle is in flight, show the requested value
  // (reverts automatically to the cached value if the mutation errors).
  const shown = mutation.isPending
    ? (mutation.variables?.enabled ?? activeAccount.earnEnabled)
    : activeAccount.earnEnabled;
  const runningPlatformWide = earn.data?.enabled ?? false;

  const onToggle = (next: boolean) => {
    mutation.mutate(
      { accountId: activeAccount.id, enabled: next },
      {
        onError: (e) =>
          toast.error({ title: 'Could not update Earn setting', description: normalizeError(e) }),
      },
    );
  };

  return (
    <div className="mm-card" style={{ padding: '20px 22px' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mm-kicker">Idle-cash yield</div>
          <h3
            className="font-display"
            style={{ fontSize: 18, marginTop: 4, letterSpacing: '-0.02em' }}
          >
            Earn on idle USDT
          </h3>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--mm-ink-2)', maxWidth: 520 }}>
            Park idle USDT in Binance Flexible Simple Earn while the hedge is in cash; it&apos;s
            redeemed automatically before the strategy buys BTC. Roughly +1–2%/yr on the cash leg,
            with no added market risk.
          </p>
          {shown && !runningPlatformWide && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--mm-ink-3)' }}>
              On for this account — activates once the platform&apos;s Earn feature is enabled.
            </p>
          )}
        </div>
        <Switch
          checked={shown}
          onCheckedChange={onToggle}
          disabled={mutation.isPending}
          aria-label="Toggle idle-cash Simple Earn"
        />
      </div>
    </div>
  );
}
