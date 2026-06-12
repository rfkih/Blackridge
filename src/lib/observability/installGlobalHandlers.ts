/**
 * Wire `window.onerror` and `window.onunhandledrejection` to the error
 * reporter. Idempotent — calling twice is safe (we replace prior handlers
 * with our own, and chain to whatever was already there if React/Next set
 * one in dev).
 *
 * Mounted once from the client `Providers` tree. SSR is a no-op.
 */
import { reportException, reportError } from './errorReporter';

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  const priorOnError = window.onerror;
  window.onerror = (eventOrMessage, source, lineno, colno, error) => {
    try {
      if (error) {
        reportException(error, {
          loggerName: 'frontend.window.onerror',
          mdc: {
            ...(source ? { source: String(source) } : {}),
            ...(typeof lineno === 'number' ? { lineno: String(lineno) } : {}),
            ...(typeof colno === 'number' ? { colno: String(colno) } : {}),
          },
        });
      } else {
        const message =
          typeof eventOrMessage === 'string'
            ? eventOrMessage
            : 'window.onerror fired without an Error instance';
        reportError({
          loggerName: 'frontend.window.onerror',
          message,
          mdc: {
            ...(source ? { source: String(source) } : {}),
            ...(typeof lineno === 'number' ? { lineno: String(lineno) } : {}),
            ...(typeof colno === 'number' ? { colno: String(colno) } : {}),
          },
        });
      }
    } catch {}
    if (typeof priorOnError === 'function') {
      try {
        return priorOnError.call(window, eventOrMessage, source, lineno, colno, error);
      } catch {
        return false;
      }
    }
    return false;
  };

  const priorOnUnhandled = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    try {
      const reason = (event as PromiseRejectionEvent).reason;
      reportException(reason, { loggerName: 'frontend.unhandledrejection' });
    } catch {}
    if (typeof priorOnUnhandled === 'function') {
      try {
        return priorOnUnhandled.call(window, event);
      } catch {}
    }
  };
}
