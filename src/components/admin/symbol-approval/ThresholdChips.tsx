'use client';

import { Plus, Settings2 } from 'lucide-react';
import { useApprovalThresholds } from '@/hooks/useApprovalThresholds';
import type { SymbolApprovalThreshold } from '@/types/symbolApproval';

/**
 * Per-symbol threshold chip strip rendered above the approvals table. Each
 * chip is the launch point for "Approve a strategy for this symbol" — there
 * is no global new-approval button, which eliminates the empty
 * Symbol-dropdown state and keeps the operator focused on one symbol at a
 * time.
 */
interface ThresholdChipsProps {
  onAddForSymbol: (symbol: string) => void;
  onEditThresholds: (threshold: SymbolApprovalThreshold) => void;
}

export function ThresholdChips({ onAddForSymbol, onEditThresholds }: ThresholdChipsProps) {
  const { data: thresholds = [], isLoading } = useApprovalThresholds();

  if (isLoading) {
    return (
      <div className="font-mono text-[11px] text-text-muted">Loading thresholds…</div>
    );
  }

  if (thresholds.length === 0) {
    return (
      <div className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2 font-mono text-[11px] text-text-muted">
        No threshold rows seeded yet. The V102 migration seeds one per live symbol — verify the
        backend has migrated.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {thresholds.map((t) => (
        <ThresholdChip
          key={t.symbol}
          threshold={t}
          onAdd={() => onAddForSymbol(t.symbol)}
          onEdit={() => onEditThresholds(t)}
        />
      ))}
    </div>
  );
}

function ThresholdChip({
  threshold,
  onAdd,
  onEdit,
}: {
  threshold: SymbolApprovalThreshold;
  onAdd: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5">
      <span className="font-mono text-[12px] font-semibold text-text-primary">
        {threshold.symbol}
      </span>
      <span className="font-mono text-[10px] text-text-secondary">
        CAGR ≥ {threshold.minCagrPct}% · cap ≥ ${threshold.minInitialCapitalUsd} · win ≥{' '}
        {threshold.minWindowDays}d · tr ≥ {threshold.minTrades}
      </span>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-0.5 rounded-sm border border-bd-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
      >
        <Plus size={10} /> Approve
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-0.5 rounded-sm border border-bd-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        aria-label={`Edit thresholds for ${threshold.symbol}`}
      >
        <Settings2 size={10} /> Edit
      </button>
    </div>
  );
}
