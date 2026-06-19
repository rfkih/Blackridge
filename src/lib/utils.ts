import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns `path` only if it is a same-origin path safe for `window.location.assign`.
 * Blocks protocol-relative (`//evil.com`), backslash tricks (`/\evil.com`),
 * absolute URLs, and tab/newline-injection bypasses. Falls back to `/`.
 *
 * Browsers strip ASCII tab (\t), newline (\n) and carriage-return (\r) while
 * parsing a URL, so a value like `/<TAB>/evil.com` (reachable via `?next=/%09/evil.com`,
 * which `URLSearchParams.get` decodes to a literal tab) would slip past a naive
 * `startsWith('//')` check yet resolve to `//evil.com` once assigned — a
 * protocol-relative open redirect. We strip those characters first and return the
 * *cleaned* string so `window.location.assign` cannot re-introduce the bypass.
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path) return '/';
  const cleaned = path.replace(/[\t\n\r]/g, '');
  if (cleaned[0] !== '/') return '/';
  if (cleaned.startsWith('//') || cleaned.startsWith('/\\')) return '/';
  return cleaned;
}
