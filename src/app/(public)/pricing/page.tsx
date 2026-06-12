import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Blackridge fee schedule — free during early access. No subscription, no performance fee, no custody. We announce pricing before we ever charge.',
};

// What's actually available today. No invented tiers, SLAs, or seat counts.
const INCLUDED = [
  'Trading and hedging accounts (switch any time)',
  'Full strategy library — trading + spot hedging',
  'Spot BTC hedge with full-balance management',
  'Idle-cash yield via Binance Simple Earn',
  'Backtesting: walk-forward + Monte-Carlo, up to 9 years of history',
  'Paper trading against live market data',
  'Per-account risk caps + drawdown kill-switch',
  'Connect your own Binance account (spot & USDⓈ-M futures)',
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does it cost right now?',
    a: 'Nothing. Blackridge is in early access and free to use. There is no subscription and no card on file. We will announce pricing well before we ever charge, and early users will keep a founder rate.',
  },
  {
    q: 'Do you take a cut of my profits?',
    a: 'No. We never touch your funds and have no performance fee. When paid plans arrive they will be a flat subscription for the software — never a slice of your returns.',
  },
  {
    q: 'How does paper trading work?',
    a: 'Strategies execute against live market data with realistic slippage and fee modeling, but no real orders hit the exchange. Use it to get comfortable before you connect a live account.',
  },
  {
    q: 'What exchanges do you support?',
    a: 'Binance today — spot and USDⓈ-M futures. The connection uses a read-and-trade API key with withdrawals disabled. More venues are on the roadmap.',
  },
  {
    q: 'Is my data and are my keys safe?',
    a: 'API keys are sealed with KMS-backed encryption before they leave your browser; only the trading workers can decrypt at order-placement time. We never hold a single dollar of your capital. See the Security page for the full model.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell activeNav="pricing">
      <section className="qp-hero" style={{ paddingBottom: 56 }}>
        <div className="qp-wrap">
          <div className="qp-hero-eyebrow">
            <span>Fee schedule</span>
            <span className="dot" />
            <span>Early access</span>
          </div>
          <h1 style={{ maxWidth: 700 }}>No fee today. No performance fee, ever.</h1>
          <p className="lede" style={{ maxWidth: 600 }}>
            Blackridge is in early access and free to use: connect your Binance account, run trading
            and hedging strategies, and backtest without limit. No subscription, no card on file,
            and never a share of your returns. Pricing will be announced before we ever charge.
          </p>
        </div>
      </section>

      <section style={{ padding: '0 0 88px' }}>
        <div className="qp-wrap" style={{ maxWidth: 1000 }}>
          <div className="qp-plan-grid">
            <div className="qp-plan">
              <div className="tag">01 — Early access · available now</div>
              <div className="price">$0</div>
              <div className="terms">no card · no subscription · founder rate later</div>
              <p>
                The full platform: every strategy in the library, both account types, unlimited
                backtesting, paper trading, and live execution on your own Binance account.
              </p>
              <div className="foot">
                <Link href="/onboarding" className="qp-btn-primary lg" style={{ width: '100%' }}>
                  Open account
                </Link>
              </div>
            </div>
            <div className="qp-plan">
              <div className="tag">02 — Desk &amp; teams</div>
              <div className="price">Enquire</div>
              <div className="terms">multiple accounts · custom risk policies</div>
              <p>
                Running real size, several accounts, or a mandate with specific risk constraints?
                Speak with the desk about a configuration that fits.
              </p>
              <div className="foot">
                <Link href="/product" className="qp-btn-outline lg" style={{ width: '100%' }}>
                  Contact the desk
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="qp-section paper">
        <div className="qp-wrap" style={{ maxWidth: 1000 }}>
          <SectionHead
            eyebrow="What's included"
            title="Everything below is live today."
            sub="No asterisks, no upsell gates — the early-access plan is the whole product."
          />
          <ul className="qp-list-ruled">
            {INCLUDED.map((item, i) => (
              <li key={item}>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="qp-section">
        <div className="qp-wrap" style={{ maxWidth: 1000 }}>
          <SectionHead eyebrow="Questions" title="Asked, answered." />
          <div className="qp-faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>
                  <span>{item.q}</span>
                  <span className="marker" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="body">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        title="Free to start. Nothing to lose."
        sub="Open an account, run it in paper, connect Binance when you're ready."
      />
    </MarketingShell>
  );
}
