'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { resolvePageTitle } from '@/lib/pageTitles';

/**
 * Shared shell for `/login` / `/register` and the password-reset / email-
 * verify flow. Each auth page owns its own 1fr/1fr two-pane layout; this
 * shell just establishes the `.mm` token scope + full-viewport fill, plus
 * sets the document title from the pathname so the tab reads "Sign in —
 * Meridian Edge" etc.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useDocumentTitle(resolvePageTitle(pathname));

  return (
    <main
      className="mm"
      data-theme="dark"
      style={{
        minHeight: '100vh',
        background: 'var(--mm-bg, var(--bg-base))',
        color: 'var(--mm-ink-0, var(--text-primary))',
      }}
    >
      {children}
    </main>
  );
}
