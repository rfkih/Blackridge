'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { StrategyParamPresetsPanel } from '@/components/strategy/StrategyParamPresetsPanel';

interface PageProps {
  params: { accountStrategyId: string };
}

/**
 * Saved-preset management for one account_strategy. Strictly additive — the
 * existing per-strategy edit form (LSR/VCB/VBO) on the strategy detail page
 * keeps writing into the active preset row. This page just exposes the list +
 * activate/deactivate/delete + create controls that V29's 1:N model unlocks.
 */
export default function StrategyParamPresetsPage({ params }: PageProps) {
  const { accountStrategyId } = params;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link
          href={`/strategies/${accountStrategyId}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} />
          Strategy detail
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="font-display text-2xl text-text-primary">Strategy param presets</h1>
        <p className="text-sm text-text-secondary">
          Manage named override sets for this strategy. The active preset is what live trading
          uses; backtests can pin any preset by ID for reproducibility.
        </p>
      </header>

      <StrategyParamPresetsPanel accountStrategyId={accountStrategyId} />
    </div>
  );
}
