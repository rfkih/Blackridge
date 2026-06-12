'use client';

import { useMemo, useState } from 'react';
import { Link2, RotateCcw, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { useAdminSymbolApprovals } from '@/hooks/useSymbolApprovals';
import { format } from 'date-fns';
import type { ApprovalStatus, SymbolApproval } from '@/types/symbolApproval';

/**
 * Flat sortable/filterable table of symbol-strategy approvals. Mirrors the
 * {@code StrategyTable} on {@code /admin/strategies} so the page reads as
 * one cohesive surface. Show-revoked toggle reuses the existing
 * {@code includeRevoked} query param.
 */
interface ApprovalsTableProps {
  /** Open the attach-evidence dialog for a grandfathered row. */
  onAttachEvidence: (approval: SymbolApproval) => void;
  /** Open the revoke confirm dialog. */
  onRevoke: (approval: SymbolApproval) => void;
}

export function ApprovalsTable({ onAttachEvidence, onRevoke }: ApprovalsTableProps) {
  const [showRevoked, setShowRevoked] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | ''>('');

  const { data: approvals = [], isLoading } = useAdminSymbolApprovals(showRevoked);

  const symbols = useMemo(
    () => Array.from(new Set(approvals.map((a) => a.symbol))).sort(),
    [approvals],
  );

  const rows = useMemo(() => {
    return approvals
      .filter((a) => !symbolFilter || a.symbol === symbolFilter)
      .filter((a) => !statusFilter || a.status === statusFilter);
  }, [approvals, symbolFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-bd-subtle bg-bg-surface p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">
          Approvals
          <span className="ml-2 font-mono text-[11px] text-text-muted">{rows.length}</span>
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[11px] text-text-primary"
          >
            <option value="">All symbols</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | '')}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[11px] text-text-primary"
          >
            <option value="">All statuses</option>
            <option value="approved">approved</option>
            <option value="grandfathered">grandfathered</option>
            <option value="stale">stale</option>
            {showRevoked && <option value="revoked">revoked</option>}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="size-3"
            />
            Show revoked
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle">
              {['Symbol', 'Code', 'Status', 'CAGR', 'Trades', 'Run', 'By', ''].map((col) => (
                <th
                  key={col || 'actions'}
                  className="label-caps whitespace-nowrap px-4 py-2.5 text-left"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[12px] text-text-muted">
                  No approvals match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ApprovalRow
                  key={row.id}
                  row={row}
                  onAttachEvidence={onAttachEvidence}
                  onRevoke={onRevoke}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ApprovalRow({
  row,
  onAttachEvidence,
  onRevoke,
}: {
  row: SymbolApproval;
  onAttachEvidence: (approval: SymbolApproval) => void;
  onRevoke: (approval: SymbolApproval) => void;
}) {
  const revoked = row.status === 'revoked';
  return (
    <tr className="group border-b border-bd-subtle last:border-b-0 hover:bg-bg-hover">
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[12px] text-text-primary">
        {row.symbol}
      </td>
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[12px] text-text-primary">
        {row.strategyCode}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <ApprovalStatusBadge
          status={row.status}
          title={
            row.status === 'grandfathered'
              ? 'Re-approve with a real backtest run to remove this badge.'
              : undefined
          }
        />
      </td>
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[11px] text-text-secondary">
        {row.evidenceCagrPct != null ? `${row.evidenceCagrPct.toFixed(2)}%` : '—'}
      </td>
      <td className="num whitespace-nowrap px-4 py-3 font-mono text-[11px] text-text-secondary">
        {row.evidenceTrades ?? '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-text-secondary">
        {row.backtestRunId ? (
          <a
            href={`/backtest/${row.backtestRunId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-text-primary hover:underline"
          >
            <Link2 size={10} />
            {row.backtestRunId.slice(0, 8)}
          </a>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-text-muted">
        <div className="flex flex-col">
          <span>{row.createdBy ?? '—'}</span>
          {row.createdTime && (
            <span className="text-[9px]">{format(new Date(row.createdTime), 'yyyy-MM-dd')}</span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
          {row.status === 'grandfathered' && (
            <button
              type="button"
              onClick={() => onAttachEvidence(row)}
              className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
            >
              <RotateCcw size={11} /> Attach evidence
            </button>
          )}
          {!revoked && (
            <button
              type="button"
              onClick={() => onRevoke(row)}
              className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 text-[11px] text-[var(--color-loss)] transition-colors hover:bg-[rgba(229,72,77,0.12)]"
            >
              <X size={11} /> Revoke
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
