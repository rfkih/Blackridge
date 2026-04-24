import type { ReactNode } from 'react';

/**
 * Shared shell for `/login` and `/register`. Previously this layout centred
 * the children on a decorated backdrop; under the MONO-MINT redesign each
 * auth page owns its own 1fr/1fr two-pane layout (hero + form), so this
 * layout now just establishes the `.mm` token scope + full-viewport fill.
 *
 * Kept as a server component — no hooks, no client-only APIs needed here.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
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
