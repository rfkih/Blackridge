import { LegalPage, H2 } from '@/components/legal/LegalPage';

const EFFECTIVE_DATE = 'Effective 26 April 2026';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" subtitle={EFFECTIVE_DATE}>
      <p>Use of Blackridge is governed by these terms. By signing in you agree to them.</p>

      <H2>Trading risk</H2>
      <p>
        Algorithmic trading carries the risk of substantial loss. Past performance, including
        backtest results, is not indicative of future returns. You are solely responsible for the
        strategies you deploy, the capital you allocate, and the losses any trade incurs. Blackridge
        provides software; we do not provide investment advice and we are not a broker, dealer, or
        fiduciary.
      </p>

      <H2>Your responsibilities</H2>
      <p>
        Keep your password and exchange API credentials confidential. Configure exchange API keys
        with the minimum permissions required (we recommend disabling withdrawals). You are
        responsible for ensuring your use complies with the laws of your jurisdiction and the terms
        of any exchange you connect.
      </p>

      <H2>Acceptable use</H2>
      <p>
        Don&apos;t attempt to disrupt the service, scrape it at scale, abuse it to attack the
        connected exchange, or run it on behalf of users not properly onboarded. We may suspend
        accounts engaged in any of the above without prior notice.
      </p>

      <H2>Service availability</H2>
      <p>
        We aim for high uptime but make no SLA guarantees during the current phase. Open positions
        are reconciled with the exchange of record on every reconnect; the exchange is the source of
        truth for fills, balances, and order state. If the platform is unavailable, your positions
        still exist on the exchange and can be managed there.
      </p>

      <H2>Limitation of liability</H2>
      <p>
        To the extent permitted by law, Blackridge is not liable for losses arising from market
        movement, strategy behavior, exchange downtime, or your own configuration choices. Our
        maximum liability for any claim is limited to the fees you have paid us in the prior 12
        months.
      </p>

      <H2>Changes</H2>
      <p>
        We may update these terms; material changes will be announced in-app and by email. Continued
        use after a change constitutes acceptance.
      </p>
    </LegalPage>
  );
}
