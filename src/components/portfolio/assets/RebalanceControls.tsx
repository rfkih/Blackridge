'use client';

import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useUpsertAssetTargets } from '@/hooks/useAssetAllocation';
import { buildProportionalTargets } from '@/lib/assetAllocation/proportionalTargets';
import type { AssetRebalancePolicy } from '@/types/assetAllocation';
import type { PortfolioAsset } from '@/types/portfolio';
import { RebalanceNowDialog } from './RebalanceNowDialog';

/**
 * Two fast paths into the shared rebalance dialog:
 *  A. "Rebalance now" — preview + execute against the account's saved targets.
 *  B. "target USDT %"  — set targets (USDT at the chosen pct, the rest split
 *     proportional to current holdings) then open the same dialog.
 * Additive to the existing power-user targets/policy/plan editors below it.
 */
export function RebalanceControls({
  accountId,
  policy,
  currentAssets,
}: {
  accountId: string;
  policy: AssetRebalancePolicy | undefined;
  currentAssets: PortfolioAsset[];
}) {
  const [open, setOpen] = useState(false);
  const [usdtPct, setUsdtPct] = useState('50');
  const [presetError, setPresetError] = useState<string | null>(null);
  const upsertTargets = useUpsertAssetTargets();

  const setAndRebalance = async () => {
    setPresetError(null);
    const pct = Number.parseFloat(usdtPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setPresetError('Enter a USDT % between 0 and 100.');
      return;
    }
    try {
      const items = buildProportionalTargets(pct, currentAssets);
      await upsertTargets.mutateAsync({ accountId, items });
      setOpen(true);
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : 'Failed to set targets.');
    }
  };

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4 shadow-panel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="mr-auto">
          <h2 className="font-display text-[14px] font-semibold text-text-primary">
            Quick rebalance
          </h2>
          <p className="text-[11px] text-text-muted">
            Preview and execute in one step — no manual generate/execute needed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold"
          style={{ background: 'var(--color-loss)', color: 'var(--text-inverse)' }}
        >
          <Rocket size={12} /> Rebalance now
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Target USDT %
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={usdtPct}
            onChange={(e) => setUsdtPct(e.target.value)}
            aria-label="target-usdt-pct"
            className="focus:border-bd-focus w-20 rounded border border-bd-subtle bg-bg-base px-2 py-1 text-right font-mono text-[12px] tabular-nums text-text-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={setAndRebalance}
            disabled={upsertTargets.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-bd-subtle bg-bg-base px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-hover disabled:opacity-60"
          >
            Set &amp; rebalance
          </button>
        </div>
      </div>

      {presetError && <p className="mt-2 text-[11px] text-[var(--color-loss)]">{presetError}</p>}

      <RebalanceNowDialog
        open={open}
        onOpenChange={setOpen}
        accountId={accountId}
        policy={policy}
      />
    </section>
  );
}
