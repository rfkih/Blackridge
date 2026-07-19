'use client';

import { StatCard } from '@/components/shared/StatCard';
import { parseIsoUtc } from '@/lib/formatters';
import type { PortfolioBook, SleeveTarget } from '@/types/equity';

const STATUS_TOKEN: Record<string, string> = {
  PAPER: 'bg-[var(--tint-info)] text-[var(--color-info)]',
  LIVE: 'bg-[var(--tint-profit)] text-[var(--color-profit)]',
  CANDIDATE: 'text-[var(--text-secondary)] border border-[var(--border-default)]',
  RETIRED: 'text-[var(--text-muted)] border border-[var(--border-subtle)]',
};

interface BookCardProps {
  book: PortfolioBook;
  targets: SleeveTarget[];
  selected: boolean;
  onSelect: () => void;
}

export function BookCard({ book, targets, selected, onSelect }: BookCardProps) {
  const gross = targets.reduce((s, t) => s + Math.abs(t.targetNotional), 0);
  const frozen = book.frozenAt ? new Date(parseIsoUtc(book.frozenAt)).toLocaleDateString() : '—';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-[var(--text-primary)]">{book.bookCode}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TOKEN[book.status] ?? ''}`}
        >
          {book.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label="Sleeves" value={String(targets.length)} valueColor="neutral" />
        <StatCard label="Gross notional" value={`$${gross.toLocaleString()}`} valueColor="info" />
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        v{book.version} · frozen {frozen}
      </p>
    </button>
  );
}
