'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function TradeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error('[trade detail error]', error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center"
      style={{ minHeight: 320 }}
    >
      <p className="font-display text-lg text-[var(--text-primary)]">Could not load trade</p>
      <p className="text-sm text-[var(--text-muted)]">
        {error.message || 'The trade may not exist or you may not have access.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Try again
        </button>
        <Link
          href="/trades"
          className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Back to journal
        </Link>
      </div>
    </div>
  );
}
