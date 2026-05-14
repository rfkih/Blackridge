/**
 * Public (unauthenticated) route group — marketing + onboarding. No app
 * chrome (sidebar/topbar); each page provides its own layout shell.
 * Auth middleware whitelists `/welcome` and `/onboarding` so this group
 * is reachable without a session cookie.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="br min-h-screen">{children}</div>;
}
