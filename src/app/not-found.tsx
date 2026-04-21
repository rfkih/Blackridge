import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

/**
 * Global 404 — renders inside the root layout, so it gets the dark theme for
 * free. Kept static (no client hooks) so it can stream from the server.
 */
export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <Compass size={18} aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-widest">No such route</span>
      </div>

      <h1
        className="font-display text-[96px] font-semibold leading-none tracking-tighter text-text-primary"
        aria-label="404 — page not found"
      >
        404
      </h1>

      <div>
        <p className="font-display text-[18px] font-semibold text-text-primary">Page not found</p>
        <p className="mt-1 max-w-md text-[13px] text-text-secondary">
          The URL you tried doesn&apos;t map to any page in the dashboard. It may have been renamed,
          moved, or never existed.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2 text-[12px] text-text-primary transition-colors hover:bg-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
      >
        <ArrowLeft size={12} strokeWidth={1.75} aria-hidden="true" />
        Back to dashboard
      </Link>
    </main>
  );
}
