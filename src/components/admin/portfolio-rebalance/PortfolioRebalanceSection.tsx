'use client';

import { useState } from 'react';
import { ShieldAlert, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveAccount } from '@/hooks/useAccounts';
import { WeightsTable } from './WeightsTable';
import { RebalanceDialog } from './RebalanceDialog';

/**
 * Embeddable wrapper for the portfolio-rebalance surface (scorecard
 * #10 Phase A, V109). Currently lives on {@code /admin/strategies}
 * next to {@code <SymbolApprovalsSection />}; will also be embedded on
 * the per-user {@code /portfolio} page once Phase A.6 lands.
 *
 * <p>Rebalance is scoped to a single account (multi-tenancy boundary
 * landed 2026-05-20): the button is enabled only when a specific
 * account is active. In "All accounts" mode the table still renders
 * across every account so the admin can audit, but the optimiser
 * cannot fire -- the operator must pick which account to rebalance.
 *
 * <p>Anchor target {@code #portfolio-rebalance} so deep links scroll
 * directly here.
 */
export function PortfolioRebalanceSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { scopedAccountId, isAll, isLoading } = useActiveAccount();

  const canRebalance = !isLoading && !isAll && scopedAccountId !== undefined;

  return (
    <section id="portfolio-rebalance" className="scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-tighter text-text-primary">
            Portfolio rebalance
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] text-text-secondary">
            Cross-strategy allocation knob. Multiplies into live sizing alongside Kelly:{' '}
            <span className="font-mono">
              effective_capital = capital_allocation_pct &times; kelly_multiplier &times;
              portfolio_weight
            </span>
            . The optimiser reads recent backtest daily returns of the protected book and writes a
            new <span className="font-mono">portfolio_weight</span>
            per row. Rows tagged <span className="font-mono">MANUAL</span> are skipped.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!canRebalance}
          className="gap-1.5"
          title={canRebalance ? undefined : 'Switch to a specific account to rebalance'}
        >
          <TrendingUp size={14} strokeWidth={2} />
          Rebalance
        </Button>
      </div>

      <div
        className="flex items-start gap-2.5 rounded-md border px-3 py-2.5"
        style={{
          borderColor: 'rgba(59,130,246,0.35)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <ShieldAlert
          size={14}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-[var(--color-info)]"
          aria-hidden="true"
        />
        <div className="text-[12px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Per-account</span> &mdash; rebalance
          targets only the active account. Switch the account selector in the top bar to rebalance a
          different book. <span className="font-semibold text-text-primary">Two-step apply</span>{' '}
          &mdash; Preview always runs first (dry-run, no writes) so the operator sees proposed
          weights and clamp diagnostics before committing. Apply UPDATEs the live rows and journals
          a <span className="font-mono">CROSS_STRATEGY_FINDING</span> row atomically.
        </div>
      </div>

      <WeightsTable accountId={scopedAccountId} />

      {canRebalance && scopedAccountId && (
        <RebalanceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accountId={scopedAccountId}
        />
      )}
    </section>
  );
}
