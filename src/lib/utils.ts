import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns `path` only if it is a same-origin path safe for `window.location.assign`.
 * Blocks protocol-relative (`//evil.com`), backslash tricks (`/\evil.com`),
 * and absolute URLs. Falls back to `/`.
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path) return '/';
  if (path[0] !== '/') return '/';
  if (path.startsWith('//') || path.startsWith('/\\')) return '/';
  return path;
}
