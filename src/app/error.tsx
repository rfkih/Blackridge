'use client';

// SLICE: Route error boundary — in development, show full stack (Spring-Boot-style trace) + reset.
import { useEffect } from 'react';

export default function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!isDev) return;
    // eslint-disable-next-line no-console -- dev-only: mirror UI stack in console
    console.error('[app error]', error.message, error);
    if (error.stack) {
      // eslint-disable-next-line no-console
      console.error(error.stack);
    }
  }, [error, isDev]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-3xl rounded-md border border-bd-subtle bg-bg-surface p-8 shadow-panel">
        <h1 className="font-display text-lg font-semibold tracking-wide text-loss">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {isDev && error.digest && (
          <p className="mt-3 font-mono text-xs text-text-muted">Next.js digest: {error.digest}</p>
        )}
        {isDev && error.stack && (
          <pre className="mt-6 max-h-[min(420px,50vh)] overflow-auto rounded-sm border border-bd-subtle bg-bg-base p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
            {error.stack}
          </pre>
        )}
        {!isDev && (
          <p className="mt-4 text-xs text-text-muted">
            Check the browser console or server logs for details.
          </p>
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
  );
}
