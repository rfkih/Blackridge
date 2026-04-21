'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Short label shown in the fallback so the user knows which panel failed. */
  label?: string;
  children: ReactNode;
  /** Custom fallback renderer. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Panel-scoped error boundary so a single failing chart or table doesn't take down the
 * whole route. Pair with a clear `label` (e.g. "Equity curve") so the fallback names the
 * area that failed.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      const { label } = this.props;
      // eslint-disable-next-line no-console -- dev-only panel trace
      console.error('[panel error]', label ?? '(unlabeled)', error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback, label } = this.props;
    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center"
      >
        <AlertTriangle size={20} className="text-[var(--color-loss)]" aria-hidden="true" />
        <div>
          <p className="text-sm text-[var(--text-primary)]">
            {label ? `${label} failed to render` : 'Something broke here'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-1 max-w-md truncate font-mono text-xs text-[var(--text-muted)]">
              {error.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="flex items-center gap-1.5 rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <RefreshCw size={12} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
}
