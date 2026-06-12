import { Newsreader } from 'next/font/google';

/**
 * Public (unauthenticated) route group — marketing + onboarding. No app
 * chrome (sidebar/topbar); each page provides its own layout shell.
 * Auth middleware whitelists `/welcome` and `/onboarding` so this group
 * is reachable without a session cookie.
 *
 * Newsreader is the marketing-only editorial serif (`--qp-serif` in
 * globals.css). It is loaded here — not in the root layout — so the
 * authenticated dashboard never pays for it.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  // Next 14.2 has no built-in fallback metrics for Newsreader — disable the
  // automatic size-adjust and fall back to Georgia explicitly.
  adjustFontFallback: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className={`br min-h-screen ${newsreader.variable}`}>{children}</div>;
}
