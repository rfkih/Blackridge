'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PaperCard } from '@/components/research/papers/PaperCard';
import { listPapers } from '@/lib/api/researchPapers';
import { Skeleton } from '@/components/ui/skeleton';
import { SUPPORTED_SYMBOLS } from '@/lib/symbols';
import type { PaperPage, PaperStatus } from '@/types/papers';

const INTERVAL_OPTIONS = ['5m', '15m', '1h', '4h'] as const;

export default function ResearchPapersPage() {
  const [statusFilter, setStatusFilter] = useState<PaperStatus | ''>('');
  const [strategyCode, setStrategyCode] = useState('');
  const [debouncedStrategyCode, setDebouncedStrategyCode] = useState('');
  const [instrument, setInstrument] = useState('');
  const [intervalName, setIntervalName] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStrategyCode(strategyCode), 400);
    return () => clearTimeout(t);
  }, [strategyCode]);

  const activeFilters = {
    paperStatus: (statusFilter || undefined) as PaperStatus | undefined,
    strategyCode: debouncedStrategyCode.trim().toUpperCase() || undefined,
    instrument: instrument || undefined,
    intervalName: intervalName || undefined,
  };

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery<PaperPage>({
      queryKey: ['papers', activeFilters],
      queryFn: ({ pageParam }) =>
        listPapers({ ...activeFilters, cursor: pageParam as string | undefined }),
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
      initialPageParam: undefined,
      staleTime: 60_000,
    });

  const papers = data?.pages.flatMap((p) => p.items) ?? [];
  const hasFilters = !!(statusFilter || debouncedStrategyCode || instrument || intervalName);

  const clearFilters = () => {
    setStatusFilter('');
    setStrategyCode('');
    setDebouncedStrategyCode('');
    setInstrument('');
    setIntervalName('');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · PAPERS</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Research library
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            Auto-generated research papers for each completed strategy sweep.
          </p>
        </div>
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
        >
          Ops <ChevronRight size={12} />
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaperStatus | '')}
          className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="WORKING_PAPER">Working paper</option>
          <option value="FINALIZED">Finalized</option>
        </select>

        <input
          type="text"
          value={strategyCode}
          onChange={(e) => setStrategyCode(e.target.value)}
          placeholder="Strategy (e.g. TPR)"
          className="w-36 rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] uppercase text-text-primary placeholder:normal-case placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
        />

        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
        >
          <option value="">All symbols</option>
          {SUPPORTED_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={intervalName}
          onChange={(e) => setIntervalName(e.target.value)}
          className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
        >
          <option value="">All intervals</option>
          {INTERVAL_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-text-muted underline hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface p-8 text-center text-[12px] text-text-muted">
          Could not load papers. The research orchestrator may be down.
        </div>
      ) : papers.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((paper) => (
              <PaperCard key={paper.paper_id} paper={paper} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-4 py-2 text-[12px] text-text-secondary hover:bg-bg-hover disabled:opacity-60"
              >
                {isFetchingNextPage && <Loader2 size={12} className="animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-10 text-center">
      <BookOpen size={28} className="mx-auto text-text-muted" />
      <p className="text-[13px] text-text-muted">
        {hasFilters
          ? 'No papers match these filters.'
          : 'No research papers yet. Papers are generated automatically when a sweep reaches COMPLETED or PARKED.'}
      </p>
    </div>
  );
}
