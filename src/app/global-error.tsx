'use client';

// SLICE: Root error boundary — must define html/body; shows stack in development when the root layout fails.
import './globals.css';
import { useEffect, useRef } from 'react';
import { reportException } from '@/lib/observability/errorReporter';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  // Boundary-level dedup so reset → re-throw doesn't re-fire (the
  // reporter's 60s latch is a backstop, this avoids touching it).
  const reportedRef = useRef<Error | null>(null);

  // Root-layout crashes are the highest-severity browser events we can
  // capture — always ship them. Boundary fires before any provider tree
  // is mounted, but the reporter only needs `window`, not React context.
  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;
    reportException(error, {
      loggerName: 'frontend.boundary.global',
      mdc: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        className="antialiased"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
      >
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
          <div className="w-full max-w-3xl rounded-xl border border-bd-subtle bg-bg-surface p-8 shadow-panel">
            <h1 className="font-display text-lg font-semibold tracking-wide text-loss">
              Application error
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              {error.message || 'The root layout failed to render.'}
            </p>
            {isDev && error.digest && (
              <p className="mt-3 font-mono text-xs text-text-muted">
                Next.js digest: {error.digest}
              </p>
            )}
            {isDev && error.stack && (
              <pre className="mt-6 max-h-[min(420px,50vh)] overflow-auto rounded-sm border border-bd-subtle bg-bg-base p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
                {error.stack}
              </pre>
            )}
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
