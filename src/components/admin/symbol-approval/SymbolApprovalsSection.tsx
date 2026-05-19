'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { ThresholdChips } from './ThresholdChips';
import { ApprovalsTable } from './ApprovalsTable';
import { NewApprovalDialog } from './NewApprovalDialog';
import { RevokeApprovalDialog } from './RevokeApprovalDialog';
import { EditThresholdsDialog } from './EditThresholdsDialog';
import { useAdminSymbolApprovals } from '@/hooks/useSymbolApprovals';
import type { SymbolApproval, SymbolApprovalThreshold } from '@/types/symbolApproval';

/**
 * Embeddable wrapper for the symbol-strategy approval admin surface.
 *
 * <p>Per operator decision (2026-05-19), this lives as a section on the
 * existing {@code /admin/strategies} page rather than its own page — keeps
 * the admin nav lean. Anchor target is {@code #approvals} so the
 * empty-state "Manage approvals →" link in {@code NewStrategyDialog} can
 * scroll the operator straight to it. Also reads
 * {@code ?symbol=BTCUSDT} from the URL to auto-open the per-symbol
 * approve dialog.
 */
export function SymbolApprovalsSection() {
  const searchParams = useSearchParams();
  const symbolFromUrl = searchParams?.get('symbol') ?? null;

  const [newOpen, setNewOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [attachRow, setAttachRow] = useState<SymbolApproval | null>(null);
  const [revokeRow, setRevokeRow] = useState<SymbolApproval | null>(null);
  const [editThreshold, setEditThreshold] = useState<SymbolApprovalThreshold | null>(null);

  const { data: approvals = [] } = useAdminSymbolApprovals(false);

  // Auto-launch new-approval dialog if ?symbol= is present.
  useEffect(() => {
    if (!symbolFromUrl) return;
    setNewSymbol(symbolFromUrl);
    setAttachRow(null);
    setNewOpen(true);
  }, [symbolFromUrl]);

  const alreadyApprovedCodes = useMemo(
    () =>
      newSymbol
        ? approvals
            .filter((a) => a.symbol === newSymbol && a.status !== 'revoked')
            .map((a) => a.strategyCode)
        : [],
    [approvals, newSymbol],
  );

  function handleAddForSymbol(symbol: string) {
    setAttachRow(null);
    setNewSymbol(symbol);
    setNewOpen(true);
  }

  function handleAttachEvidence(row: SymbolApproval) {
    setAttachRow(row);
    setNewSymbol(null);
    setNewOpen(true);
  }

  return (
    <section id="approvals" className="space-y-4 scroll-mt-20">
      <div>
        <h2 className="font-display text-[18px] font-semibold tracking-tighter text-text-primary">
          Symbol approvals
        </h2>
        <p className="mt-1 max-w-2xl text-[12px] text-text-secondary">
          Gate-enforced allowlist of <span className="font-mono">(symbol, strategy)</span> pairs
          permitted in the New Strategy picker. Approvals require a backtest run that clears the
          per-symbol thresholds — the backend re-checks every submission.
        </p>
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
          <span className="font-semibold text-text-primary">Gate semantics</span> — approvals are a
          UI gate only, not a live-execution gate. Existing live strategies keep running through a
          revoke; the gate just hides the pair from new pickers.
        </div>
      </div>

      <ThresholdChips
        onAddForSymbol={handleAddForSymbol}
        onEditThresholds={setEditThreshold}
      />

      <ApprovalsTable
        onAttachEvidence={handleAttachEvidence}
        onRevoke={setRevokeRow}
      />

      <NewApprovalDialog
        open={newOpen}
        onOpenChange={(v) => {
          setNewOpen(v);
          if (!v) {
            setAttachRow(null);
            setNewSymbol(null);
          }
        }}
        attachToRow={attachRow}
        presetSymbol={newSymbol}
        alreadyApprovedCodes={alreadyApprovedCodes}
      />

      <RevokeApprovalDialog
        open={revokeRow != null}
        onOpenChange={(v) => !v && setRevokeRow(null)}
        approval={revokeRow}
      />

      <EditThresholdsDialog
        open={editThreshold != null}
        onOpenChange={(v) => !v && setEditThreshold(null)}
        threshold={editThreshold}
      />
    </section>
  );
}
