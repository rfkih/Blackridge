import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Shield,
  Lock,
  KeyRound,
  ScrollText,
  Eye,
  ServerCog,
} from 'lucide-react';
import { MarketingShell, SectionHead } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How Blackridge protects your keys, your funds, and your audit trail. SOC 2 in progress, non-custodial by design, withdrawals always disabled.',
};

const PRINCIPLES = [
  {
    icon: <Shield />,
    title: 'Non-custodial by design',
    body:
      'Blackridge never holds a single dollar of your capital. All funds stay in your exchange account; we connect via read-and-trade API keys with withdrawals disabled.',
  },
  {
    icon: <Lock />,
    title: 'Keys sealed at the boundary',
    body:
      'API keys are encrypted with a KMS-backed envelope in your browser before they hit our servers. Only the trading workers can decrypt — at order-placement time, never at rest.',
  },
  {
    icon: <KeyRound />,
    title: 'Withdrawals always disabled',
    body:
      'We validate the connected key’s permissions at registration. If the key has withdrawal scope, the connection is rejected with a clear remediation step.',
  },
  {
    icon: <Eye />,
    title: 'Read-only secondary keys',
    body:
      'For analytics and accounting integrations, you can attach a separate read-only key per exchange. The trading key never leaks into the dashboard’s viewer scope.',
  },
  {
    icon: <ScrollText />,
    title: 'Immutable audit trail',
    body:
      'Every order, fill, parameter change, and rebalance is logged with a timestamp and signed by the writer. Export to CSV in two clicks.',
  },
  {
    icon: <ServerCog />,
    title: 'Infrastructure hygiene',
    body:
      'No third-party trackers, no advertising pixels. We only collect what we need to run trading. Postgres rows are at-rest encrypted; backups are encrypted in transit.',
  },
];

const COMPLIANCE = [
  { label: 'SOC 2 Type II', status: 'In progress', detail: 'Audit window opens Q1 2026.' },
  { label: 'GDPR', status: 'Compliant', detail: 'EU residents can export + delete in-app.' },
  { label: 'KYC / AML', status: 'Coming H2 2026', detail: 'Required before USD-denominated billing.' },
  { label: 'ISO 27001', status: 'Planned 2027', detail: 'Roadmapped after SOC 2 Type II.' },
];

const COMMITMENTS = [
  {
    title: 'Disclosure within 72 hours.',
    body:
      'If we discover a security incident affecting your account or data, you’ll hear from us within 72 hours of confirmation — by email and in-app.',
  },
  {
    title: 'No silent permission expansion.',
    body:
      'If a new feature needs a permission scope we don’t already have on your API key, we ask before turning it on. No retroactive scope creep.',
  },
  {
    title: 'Auditable code paths.',
    body:
      'Order placement and risk-cap enforcement live in a versioned, signed service. Every release is hash-pinned in the audit log next to the trade it produced.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell activeNav="security">
      {}
      <section style={{ padding: '72px 0 32px' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_1fr]">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
              >
                <Shield size={14} /> Security
              </span>
              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(36px, 6vw, 56px)",
                  lineHeight: 1.05,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  margin: '18px 0 18px',
                  color: 'var(--text-primary)',
                }}
              >
                Your keys, your funds, your audit trail.
              </h1>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                  maxWidth: 520,
                  margin: '0 0 24px',
                }}
              >
                Blackridge never custodies a dollar. We connect to your exchange via a
                read-and-trade API key, refuse keys with withdrawal scope, and log every action
                we take on your behalf.
              </p>
              <div className="flex items-center gap-3">
                <Link href="/onboarding" className="br-btn br-btn-primary br-btn-lg">
                  Open account <ArrowRight size={16} />
                </Link>
                <Link href="/docs" className="br-btn br-btn-secondary br-btn-lg">
                  Read the spec
                </Link>
              </div>
            </div>

            {}
            <div className="br-trust-band" style={{ padding: 32 }}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <TrustStat value="0" label="Funds custodied" />
                <TrustStat value="99.97%" label="Order success rate" />
                <TrustStat value="SOC 2" label="Type II in progress" />
                <TrustStat value="24/7" label="Engineer on-call" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="How we protect you"
            title="Six principles, no exceptions."
            sub="The decisions baked into the codebase — not the marketing copy."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="br-card" style={{ borderRadius: 24, padding: 28 }}>
                <div
                  className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                >
                  {p.icon}
                </div>
                <h3
                  className="font-display"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    margin: '0 0 8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[820px] px-5 sm:px-8">
          <SectionHead
            eyebrow="Compliance"
            title="Where we stand."
            sub="A live snapshot — updated as audits progress."
          />
          <div className="br-card" style={{ padding: 0, overflow: 'hidden' }}>
            {COMPLIANCE.map((row, i) => (
              <div
                key={row.label}
                className="flex items-center gap-4 px-6 py-4"
                style={{
                  borderTop: i ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div className="flex-1">
                  <div
                    className="text-[15px] font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {row.label}
                  </div>
                  <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {row.detail}
                  </div>
                </div>
                <span
                  className={`br-chip ${
                    row.status === 'Compliant'
                      ? 'br-chip-profit'
                      : row.status === 'In progress'
                        ? 'br-chip-brand'
                        : 'br-chip-info'
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '80px 0' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionHead
            eyebrow="Our promises"
            title="What you can hold us to."
            sub="If we break one of these, write to security@blackridge.com — we’ll make it right."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {COMMITMENTS.map((c) => (
              <div
                key={c.title}
                className="br-card"
                style={{
                  borderRadius: 24,
                  padding: 28,
                  borderLeft: '3px solid var(--brand-500)',
                }}
              >
                <h3
                  className="font-display"
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    margin: '0 0 10px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {c.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: '64px 0', background: 'var(--bg-surface)' }}>
        <div className="mx-auto max-w-[820px] px-5 sm:px-8 text-center">
          <h2
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
              color: 'var(--text-primary)',
            }}
          >
            Found a vulnerability?
          </h2>
          <p
            className="mx-auto"
            style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              maxWidth: 520,
              margin: '0 auto 20px',
            }}
          >
            We pay bug bounties for valid reports against the production stack. Email{' '}
            <span style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
              security@blackridge.com
            </span>{' '}
            with a reproducible PoC. We reply within one business day.
          </p>
          <Link href="/docs" className="br-btn br-btn-secondary">
            Disclosure policy <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {label}
      </div>
    </div>
  );
}
