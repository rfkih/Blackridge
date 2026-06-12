import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingShell, SectionHead, MarketingCta } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'The Blackridge security model — non-custodial by design, withdrawals disabled at the key level, KMS-sealed API keys, and an append-only audit ledger.',
};

const PRINCIPLES = [
  {
    n: '01',
    title: 'Non-custodial by design',
    body: 'Blackridge never holds a single dollar of your capital. All funds stay in your exchange account; we connect via read-and-trade API keys with withdrawals disabled.',
  },
  {
    n: '02',
    title: 'Keys sealed at the boundary',
    body: 'API keys are encrypted with a KMS-backed envelope in your browser before they hit our servers. Only the trading workers can decrypt — at order-placement time, never at rest.',
  },
  {
    n: '03',
    title: 'Withdrawals always disabled',
    body: 'We validate the connected key’s permissions at registration. If the key has withdrawal scope, the connection is rejected with a clear remediation step.',
  },
  {
    n: '04',
    title: 'Read-only secondary keys',
    body: 'For analytics and accounting integrations, you can attach a separate read-only key per exchange. The trading key never leaks into the dashboard’s viewer scope.',
  },
  {
    n: '05',
    title: 'Immutable audit trail',
    body: 'Every order, fill, parameter change, and rebalance is logged with a timestamp and signed by the writer. Export to CSV in two clicks.',
  },
  {
    n: '06',
    title: 'Infrastructure hygiene',
    body: 'No third-party trackers, no advertising pixels. We only collect what we need to run trading. Postgres rows are at-rest encrypted; backups are encrypted in transit.',
  },
];

const COMPLIANCE = [
  { label: 'SOC 2 Type II', status: 'Planned', detail: 'On the roadmap — not yet under audit.' },
  {
    label: 'GDPR data rights',
    status: 'In progress',
    detail: 'In-app export + delete being built out.',
  },
  { label: 'KYC / AML', status: 'Planned', detail: 'Required before any paid billing goes live.' },
  { label: 'ISO 27001', status: 'Planned', detail: 'Roadmapped after SOC 2 Type II.' },
];

const COMMITMENTS = [
  {
    n: 'I.',
    title: 'Disclosure within 72 hours.',
    body: 'If we discover a security incident affecting your account or data, you’ll hear from us within 72 hours of confirmation — by email and in-app.',
  },
  {
    n: 'II.',
    title: 'No silent permission expansion.',
    body: 'If a new feature needs a permission scope we don’t already have on your API key, we ask before turning it on. No retroactive scope creep.',
  },
  {
    n: 'III.',
    title: 'Auditable code paths.',
    body: 'Order placement and risk-cap enforcement live in a versioned, signed service. Every release is hash-pinned in the audit log next to the trade it produced.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell activeNav="security">
      <section className="qp-hero" style={{ paddingBottom: 56 }}>
        <div className="qp-wrap">
          <div className="qp-hero-eyebrow">
            <span>Security model</span>
            <span className="dot" />
            <span>Non-custodial</span>
          </div>
          <h1 style={{ maxWidth: 720 }}>Your keys, your funds, your audit trail.</h1>
          <p className="lede" style={{ maxWidth: 580 }}>
            Blackridge never custodies a dollar. We connect to your exchange via a read-and-trade
            API key, refuse keys with withdrawal scope, and log every action we take on your behalf
            to an append-only ledger.
          </p>
          <div className="qp-hero-cta">
            <Link href="/onboarding" className="qp-btn-primary lg">
              Open account
            </Link>
            <Link href="/docs" className="qp-btn-textlink">
              Read the documentation&ensp;→
            </Link>
          </div>
          <div className="qp-hero-stats">
            <div>
              <strong>0</strong>
              <span>Funds we custody</span>
            </div>
            <div>
              <strong>&lt; 60 s</strong>
              <span>Balance reconcile</span>
            </div>
            <div>
              <strong>Off</strong>
              <span>Withdrawal scope</span>
            </div>
            <div>
              <strong>KMS</strong>
              <span>Key encryption</span>
            </div>
          </div>
        </div>
      </section>

      <section className="qp-section paper">
        <div className="qp-wrap">
          <SectionHead
            eyebrow="The control set"
            title="Six controls, no exceptions."
            sub="The decisions baked into the codebase — not the marketing copy."
          />
          <div className="qp-disc-grid">
            {PRINCIPLES.slice(0, 3).map((p) => (
              <article key={p.n}>
                <div className="qp-disc-num" style={{ fontStyle: 'normal' }}>
                  {p.n}
                </div>
                <h3>{p.title}</h3>
                <p style={{ marginBottom: 0 }}>{p.body}</p>
              </article>
            ))}
          </div>
          <div className="qp-disc-grid" style={{ borderTop: 0 }}>
            {PRINCIPLES.slice(3).map((p) => (
              <article key={p.n}>
                <div className="qp-disc-num" style={{ fontStyle: 'normal' }}>
                  {p.n}
                </div>
                <h3>{p.title}</h3>
                <p style={{ marginBottom: 0 }}>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="qp-section">
        <div className="qp-wrap" style={{ maxWidth: 1000 }}>
          <SectionHead
            eyebrow="Compliance roadmap"
            title="Stated plainly, not implied."
            sub="None of these are certified yet — this is the roadmap. We'd rather under-promise here than imply a badge we haven't earned."
          />
          <div className="qp-table-wrap">
            <table className="qp-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Framework</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {COMPLIANCE.map((row) => (
                  <tr key={row.label}>
                    <td className="name">{row.label}</td>
                    <td>
                      <span className={`qp-status ${row.status === 'In progress' ? 'ink' : ''}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="qp-section brand">
        <div className="qp-wrap">
          <SectionHead
            eyebrow="Our commitments"
            title="What you can hold us to."
            sub="If we break one of these, write to security@blackridge.com — we'll make it right."
          />
          <div className="qp-risk-grid">
            {COMMITMENTS.map((c) => (
              <article key={c.n}>
                <div className="num">{c.n}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="qp-section paper">
        <div className="qp-wrap qp-contact-grid">
          <div className="qp-contact-copy">
            <div className="qp-section-eye">Responsible disclosure</div>
            <h2>Found a vulnerability?</h2>
            <p>
              We welcome responsible disclosure of vulnerabilities in the production stack. Email a
              reproducible proof-of-concept and we&apos;ll get back to you.
            </p>
            <div className="qp-contact-meta" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <span>Security desk</span>
                <strong>security@blackridge.com</strong>
              </div>
            </div>
          </div>
          <div className="qp-contact-action">
            <Link href="/docs" className="qp-btn-outline lg" style={{ width: '100%' }}>
              Read the documentation
            </Link>
            <span className="qp-contact-note">
              Include reproduction steps and affected endpoints; we confirm receipt within one
              business day.
            </span>
          </div>
        </div>
      </section>

      <MarketingCta />
    </MarketingShell>
  );
}
