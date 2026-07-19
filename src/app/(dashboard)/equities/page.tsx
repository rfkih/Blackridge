'use client';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useBooks, useBookTargets } from '@/hooks/useBooks';
import { BookCard } from '@/components/equities/BookCard';
import { AllocationBar } from '@/components/equities/AllocationBar';
import { SleeveTargetsTable } from '@/components/equities/SleeveTargetsTable';
import { Skeleton } from '@/components/ui/skeleton';

function BooksLoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

function SelectedBookPanel({ bookCode }: { bookCode: string }) {
  const { data: targets = [], isLoading, isError, refetch } = useBookTargets(bookCode);

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Allocation bar */}
      {!isLoading && !isError && targets.length > 0 && <AllocationBar targets={targets} />}

      {/* Targets table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Sleeve targets — {bookCode}
        </h2>
        <SleeveTargetsTable
          targets={targets}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
        />
      </div>
    </div>
  );
}

export default function EquitiesBooksPage() {
  const { data: books = [], isLoading, isError, refetch } = useBooks();
  const [selectedBookCode, setSelectedBookCode] = useState<string | undefined>(undefined);

  // Default to first book once loaded
  useEffect(() => {
    if (!selectedBookCode && books.length > 0) {
      setSelectedBookCode(books[0].bookCode);
    }
  }, [books, selectedBookCode]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Book Authority
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Frozen portfolio books and per-sleeve target positions.
        </p>
      </div>

      {/* Books grid */}
      {isLoading ? (
        <BooksLoadingSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--color-loss)]">Failed to load books</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Check trading JVM connectivity and try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
          >
            Retry
          </button>
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
          <BookOpen
            size={32}
            strokeWidth={1.25}
            className="mx-auto mb-3 text-[var(--text-muted)]"
          />
          <p className="text-sm font-medium text-[var(--text-primary)]">No books found</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Deploy and seed the Book Authority (portfolio-books table) to see books here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.bookCode}
              book={book}
              targets={[]}
              selected={selectedBookCode === book.bookCode}
              onSelect={() => setSelectedBookCode(book.bookCode)}
            />
          ))}
        </div>
      )}

      {/* Selected book detail panel */}
      {selectedBookCode && !isLoading && !isError && books.length > 0 && (
        <SelectedBookPanel bookCode={selectedBookCode} />
      )}
    </div>
  );
}
