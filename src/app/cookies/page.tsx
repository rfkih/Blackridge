import { LegalPage, H2 } from '@/components/legal/LegalPage';

const EFFECTIVE_DATE = 'Effective 26 April 2026';

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies" subtitle={EFFECTIVE_DATE}>
      <p>
        Blackridge uses a small set of cookies and browser-storage entries. We don&apos;t use
        advertising trackers and don&apos;t share cookie data with third parties.
      </p>

      <H2>Strictly necessary</H2>
      <p>
        <strong>blackheart-session</strong> — first-party signal cookie set by the frontend when you
        sign in. The middleware reads it to know you have an active session before rendering the
        dashboard shell. The real authentication token is a separate HttpOnly cookie set by the API,
        never readable by JavaScript.
      </p>
      <p>
        <strong>cookie-consent (localStorage)</strong> — records your choice on the cookie banner so
        we don&apos;t show it again. Set the first time you click Accept or Decline.
      </p>

      <H2>Functional</H2>
      <p>
        <strong>Theme, currency, dismiss flags (localStorage)</strong> — remember your preferred
        theme, display currency, onboarding-panel dismissal, and last-seen notification timestamp.
        Cleared if you sign out and clear browser storage.
      </p>

      <H2>What we do not use</H2>
      <p>
        We do not run Google Analytics, Meta Pixel, Hotjar, Sentry session replay, or any
        third-party advertising / analytics SDK.
      </p>

      <H2>Managing your preferences</H2>
      <p>
        You can clear all cookies and local-storage entries via your browser&apos;s site-data
        controls. The next visit will then ask for cookie consent again. Signing out also clears the
        session signal cookie.
      </p>
    </LegalPage>
  );
}
