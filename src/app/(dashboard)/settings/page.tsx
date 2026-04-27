'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Loader2, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts, useUpdateAccountRiskConfig } from '@/hooks/useAccounts';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/theme/ThemeProvider';
import { RotateCredentialsDialog } from '@/components/account/RotateCredentialsDialog';
import { ServerIpCard } from '@/components/account/ServerIpCard';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import {
  DISPLAY_CURRENCY_OPTIONS,
  useCurrencyStore,
  type DisplayCurrency,
} from '@/store/currencyStore';
import type { AccountSummary } from '@/types/account';

// `wired` flag: only items backed by real endpoints render in the nav;
// the rest are collected into the "Coming later" group below.
interface NavItem {
  k: string;
  label: string;
  wired: boolean;
}
interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'ACCOUNT',
    items: [
      { k: 'profile', label: 'Profile', wired: true },
      { k: 'security', label: 'Security', wired: true },
      { k: 'activity', label: 'Recent activity', wired: true },
      { k: 'api', label: 'API keys', wired: false },
      { k: 'sessions', label: 'Active sessions', wired: false },
    ],
  },
  {
    group: 'TRADING',
    items: [
      { k: 'risk', label: 'Risk guardrails', wired: true },
      { k: 'brokers', label: 'Brokers & wallets', wired: true },
      { k: 'fees', label: 'Fees & commissions', wired: false },
      { k: 'tax', label: 'Tax preferences', wired: false },
    ],
  },
  {
    group: 'NOTIFY',
    items: [
      { k: 'alerts', label: 'Alerts', wired: false },
      { k: 'reports', label: 'Scheduled reports', wired: false },
    ],
  },
  {
    group: 'BILLING',
    items: [
      { k: 'plan', label: 'Plan', wired: false },
      { k: 'invoices', label: 'Invoices', wired: false },
      { k: 'referrals', label: 'Referrals', wired: false },
    ],
  },
  {
    group: 'HELP',
    items: [{ k: 'support', label: 'Help & support', wired: true }],
  },
];

type SectionKey = string;

export default function SettingsPage() {
  const [active, setActive] = useState<SectionKey>('profile');

  return (
    <div
      className="mm settings-grid"
      style={{
        display: 'grid',
        // Two-column on tablet+, stack vertically on phones. The
        // tailwind-friendly approach would be `md:grid-cols-[260px_1fr]`,
        // but the existing layout uses inline styles — we flip them via
        // a container query class defined in globals.css.
        gridTemplateColumns: '260px 1fr',
        gap: 20,
        minHeight: 0,
        flex: 1,
      }}
    >
      {/* ── Left settings nav ── */}
      <aside
        className="mm-card"
        style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', minHeight: 540 }}
      >
        <div className="mm-kicker" style={{ padding: '0 8px', marginBottom: 8 }}>
          SETTINGS
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {NAV.map((group) => {
            // Filter to only the items we actually ship today. Empty groups
            // disappear entirely — better than rendering a header followed
            // by zero buttons.
            const wired = group.items.filter((it) => it.wired);
            if (wired.length === 0) return null;
            return (
              <div key={group.group}>
                <div
                  className="mm-kicker"
                  style={{
                    padding: '0 8px',
                    marginBottom: 6,
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    color: 'var(--mm-ink-3)',
                  }}
                >
                  {group.group}
                </div>
                {wired.map((it) => {
                  const isActive = it.k === active;
                  return (
                    <button
                      type="button"
                      key={it.k}
                      onClick={() => setActive(it.k)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: isActive ? 'var(--mm-ink-0)' : 'var(--mm-ink-1)',
                        background: isActive ? 'var(--mm-surface-2)' : 'transparent',
                        borderLeft: isActive
                          ? '2px solid var(--mm-mint)'
                          : '2px solid transparent',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                        transition: 'background 120ms, color 120ms',
                      }}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <ComingLaterGroup nav={NAV} />
        </div>

        <PlanCard />
      </aside>

      {/* ── Right content ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 2,
        }}
      >
        {active === 'profile' && <ProfileSection />}
        {active === 'security' && <SecuritySection />}
        {active === 'activity' && <RecentActivitySection />}
        {active === 'brokers' && <BrokersSection />}
        {active === 'risk' && <RiskGuardrailsSection />}
        {active === 'support' && <SupportSection />}
        {/* Profile view is the landing one — when there's no match we fall
            back to it rather than showing an empty canvas. */}
        {!['profile', 'security', 'activity', 'brokers', 'risk', 'support'].includes(active) && (
          <ProfileSection />
        )}
      </div>
    </div>
  );
}

// Collapsed bucket of every {wired: false} nav item — one click to peek
// at the roadmap, never in the way.
function ComingLaterGroup({ nav }: { nav: NavGroup[] }) {
  const upcoming = nav.flatMap((g) => g.items.filter((i) => !i.wired));
  const [open, setOpen] = useState(false);
  if (upcoming.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mm-kicker"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '4px 8px',
          marginBottom: 6,
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--mm-ink-3)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        aria-expanded={open}
      >
        <span>COMING LATER · {upcoming.length}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {upcoming.map((it) => (
            <li
              key={it.k}
              style={{
                padding: '7px 10px',
                fontSize: 12,
                color: 'var(--mm-ink-3)',
                fontFamily: 'var(--font-body)',
              }}
              title="Not implemented yet — backend endpoint pending"
            >
              {it.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Plan card (bottom of nav) ──────────────────────────────────────────────

function PlanCard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const planLabel = isAdmin ? 'ADMIN · UNLIMITED' : 'PLAN · DESK PRO';
  const planName = isAdmin ? 'Full access' : 'Desk Pro';

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          padding: '12px 10px',
          borderRadius: 12,
          background: 'var(--mm-surface-2)',
          fontSize: 11,
          color: 'var(--mm-ink-2)',
          lineHeight: 1.5,
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--mm-ink-3)' }}
        >
          {planLabel}
        </div>
        <div style={{ color: 'var(--mm-ink-0)', fontWeight: 500, marginTop: 4 }}>{planName}</div>
        <div style={{ marginTop: 4 }}>{user?.email ?? '—'}</div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '0 10px',
          fontSize: 10,
          color: 'var(--mm-ink-3)',
        }}
      >
        <Link href="/privacy" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
          Privacy
        </Link>
        <Link href="/terms" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
          Terms
        </Link>
        <Link href="/cookies" style={{ color: 'var(--mm-ink-2)', textDecoration: 'none' }}>
          Cookies
        </Link>
      </div>
    </div>
  );
}

// Audit trail for the caller — strategy mutations, kill-switch rearms,
// risk-config changes. Server-side scoped; no admin-wide visibility here.
function RecentActivitySection() {
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['audit-events', page, PAGE_SIZE],
    queryFn: () =>
      import('@/lib/api/auditEvents').then((m) => m.listMyAuditEvents(page, PAGE_SIZE)),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const data = query.data;
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const events = data?.content ?? [];

  return (
    <section
      className="mm-card"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--mm-ink-0)' }}>
          Recent activity
        </h2>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--mm-ink-2)' }}>
          Every security-sensitive change to your strategies, accounts, and risk config —
          newest first. Scoped to your own actions.
        </p>
      </div>

      {query.isLoading && events.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--mm-ink-2)' }}>
          Loading activity…
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(255,77,106,0.40)',
            background: 'rgba(255,77,106,0.08)',
            fontSize: 12,
            color: 'var(--color-loss)',
          }}
        >
          Could not load activity. Try again in a moment.
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            border: '1px dashed var(--mm-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--mm-ink-2)',
          }}
        >
          No activity yet. Strategy creations, kill-switch rearms, and risk-config changes
          show up here once you start using the app.
        </div>
      ) : (
        <>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: 'var(--mm-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {events.map((e) => (
              <ActivityRow key={e.auditEventId} event={e} />
            ))}
          </ul>

          <footer
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--mm-ink-2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>
              {events.length === 0
                ? 'No results'
                : `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + events.length} of ${total}`}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="mm-btn"
                disabled={page === 0 || query.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="mm-btn"
                disabled={page + 1 >= totalPages || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

function ActivityRow({ event }: { event: import('@/lib/api/auditEvents').AuditEvent }) {
  const ts = event.createdAt ? new Date(event.createdAt).getTime() : null;
  const tone = ACTION_TONE[event.action] ?? 'neutral';
  const colour = ACTIVITY_TONE_COLOURS[tone];
  return (
    <li
      style={{
        background: 'var(--mm-surface)',
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: colour,
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <p
          className="font-mono"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--mm-ink-0)' }}
        >
          {humanAction(event.action)}
        </p>
        <p style={{ fontSize: 11, color: 'var(--mm-ink-2)' }}>
          {event.entityType ?? '—'}
          {event.entityId ? ` · ${event.entityId.slice(0, 8)}…` : ''}
          {event.reason ? ` · ${event.reason}` : ''}
        </p>
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: 'var(--mm-ink-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {ts ? formatDate(ts) : '—'}
      </span>
    </li>
  );
}

type ActivityTone = 'positive' | 'negative' | 'warning' | 'neutral';

const ACTIVITY_TONE_COLOURS: Record<ActivityTone, string> = {
  positive: 'var(--color-profit)',
  negative: 'var(--color-loss)',
  warning: 'var(--color-warning)',
  neutral: 'var(--color-info)',
};

const ACTION_TONE: Record<string, ActivityTone> = {
  STRATEGY_CREATED: 'positive',
  STRATEGY_ACTIVATED: 'positive',
  STRATEGY_DEACTIVATED: 'warning',
  STRATEGY_DELETED: 'negative',
  STRATEGY_UPDATED: 'neutral',
  KILL_SWITCH_REARMED: 'warning',
  ACCOUNT_RISK_UPDATED: 'neutral',
};

function humanAction(action: string): string {
  // Split SNAKE_CASE into Title Case: STRATEGY_CREATED → "Strategy created".
  const parts = action.split('_');
  if (parts.length === 0) return action;
  const first = parts[0];
  const rest = parts.slice(1);
  return [
    first.charAt(0) + first.slice(1).toLowerCase(),
    ...rest.map((p) => p.toLowerCase()),
  ].join(' ');
}

// Posts to POST /api/v1/support; admins read it on /admin/inbox. The
// `diagnostic` snapshot never includes JWT or secrets.
function SupportSection() {
  const { user } = useAuth();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeDiagnostic, setIncludeDiagnostic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Note: never include JWT or any secret here.
  const diagnostic = useMemo(() => {
    const lines = [
      `Time: ${new Date().toISOString()}`,
      `App version: ${appVersion}`,
      `User ID: ${user?.id ?? 'unknown'}`,
      `Email: ${user?.email ?? 'unknown'}`,
      `Role: ${user?.role ?? 'unknown'}`,
      `User-Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
      `Page: ${typeof window !== 'undefined' ? window.location.pathname + window.location.search : 'n/a'}`,
    ];
    return lines.join('\n');
  }, [user, appVersion]);

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  const valid = trimmedSubject.length > 0 && trimmedBody.length >= 10;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const { submitSupportMessage } = await import('@/lib/api/support');
      const result = await submitSupportMessage({
        subject: trimmedSubject,
        body: trimmedBody,
        diagnostic: includeDiagnostic ? diagnostic : undefined,
      });
      setSubmittedId(result.supportMessageId);
      setSubject('');
      setBody('');
      toast.success({ title: 'Message sent', description: 'We\u2019ll get back to you soon.' });
    } catch (err) {
      toast.error({ title: 'Could not send', description: normalizeError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="mm-card"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--mm-ink-0)' }}>
          Help &amp; support
        </h2>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--mm-ink-2)' }}>
          Hit a bug or have a question? Send us a message — it lands in the team inbox and we
          reply by email. The diagnostic snapshot helps us reproduce issues without you needing
          to dig for the version or page.
        </p>
      </div>

      {submittedId && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,200,150,0.32)',
            background: 'rgba(0,200,150,0.08)',
            fontSize: 12,
            color: 'var(--mm-ink-1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>
            <strong style={{ color: 'var(--color-profit)' }}>Message sent.</strong> Reference{' '}
            <span className="font-mono">{submittedId.slice(0, 8)}</span>.
          </span>
          <button
            type="button"
            className="mm-btn mm-btn-ghost"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setSubmittedId(null)}
          >
            Send another
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="support-subject" className="mm-label">
            Subject
          </label>
          <input
            id="support-subject"
            className="mm-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Briefly: e.g. Backtest fails to load equity curve"
            maxLength={200}
            disabled={submitting}
            required
          />
        </div>

        <div>
          <label htmlFor="support-body" className="mm-label">
            Message
          </label>
          <textarea
            id="support-body"
            className="mm-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What were you trying to do, and what happened? Steps to reproduce help us a lot."
            maxLength={5000}
            rows={6}
            disabled={submitting}
            required
            style={{ resize: 'vertical', minHeight: 120, fontFamily: 'var(--font-body)' }}
          />
          <div
            className="font-mono"
            style={{
              marginTop: 4,
              fontSize: 10,
              color: trimmedBody.length < 10 ? 'var(--mm-ink-3)' : 'var(--mm-ink-2)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {trimmedBody.length < 10
                ? `Need at least 10 characters (${trimmedBody.length}/10)`
                : 'Looks good'}
            </span>
            <span>{body.length}/5000</span>
          </div>
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--mm-ink-1)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={includeDiagnostic}
            onChange={(e) => setIncludeDiagnostic(e.target.checked)}
            disabled={submitting}
          />
          Attach diagnostic snapshot (no token, no secrets)
        </label>

        {includeDiagnostic && (
          <details className="mm-card" style={{ padding: 12 }}>
            <summary
              className="mm-kicker"
              style={{ cursor: 'pointer', fontSize: 9, letterSpacing: '0.18em', color: 'var(--mm-ink-3)' }}
            >
              PREVIEW DIAGNOSTIC
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--mm-surface-2)',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--mm-ink-1)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {diagnostic}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="submit"
            className="mm-btn mm-btn-mint"
            disabled={!valid || submitting}
            style={{
              opacity: !valid || submitting ? 0.6 : 1,
              cursor: !valid || submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
            {submitting ? 'Sending\u2026' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ─── Profile — wired to PATCH /api/v1/users/me ──────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const update = useUpdateMyProfile();

  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const handle = useMemo(() => deriveHandle(user?.email ?? user?.name ?? ''), [user]);

  // Rehydrate local draft when the server-side user changes (e.g. after a
  // successful save the auth store flips, and we want the inputs to reflect it).
  useEffect(() => {
    setDisplayName(user?.name ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
  }, [user?.name, user?.phoneNumber]);

  const initials = useMemo(
    () =>
      (user?.name ?? user?.email ?? 'U')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'U',
    [user],
  );

  const dirty =
    (displayName.trim() || '') !== (user?.name ?? '') ||
    (phoneNumber.trim() || '') !== (user?.phoneNumber ?? '');

  const onSave = async () => {
    if (!dirty) return;
    try {
      await update.mutateAsync({
        fullName: displayName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });
      toast.success({ title: 'Profile saved' });
    } catch (err) {
      toast.error({ title: 'Save failed', description: normalizeError(err) });
    }
  };

  return (
    <section className="mm-card" style={{ padding: '26px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          className="font-display"
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: 'linear-gradient(135deg, var(--mm-mint) 0%, var(--mm-ink-0) 100%)',
            color: 'var(--mm-bg)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mm-kicker">PROFILE</div>
          <h2
            className="font-display"
            style={{
              fontSize: 28,
              marginTop: 4,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.name || '—'}
          </h2>
          <div
            style={{
              color: 'var(--mm-ink-2)',
              fontSize: 13,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
            {user?.createdAt && ` · joined ${formatJoinDate(user.createdAt)}`}
          </div>
        </div>
        <button type="button" className="mm-btn" disabled title="Avatar upload coming soon">
          Change photo
        </button>
      </div>

      <div
        style={{ height: 1, background: 'var(--mm-hair)', margin: '24px 0' }}
        aria-hidden="true"
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <div>
          <label htmlFor="settings-displayName" className="mm-label">
            Display name
          </label>
          <input
            id="settings-displayName"
            className="mm-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={update.isPending}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="settings-handle" className="mm-label">
            Handle
          </label>
          <input
            id="settings-handle"
            className="mm-input"
            value={handle}
            readOnly
            style={{ opacity: 0.75, cursor: 'not-allowed' }}
          />
        </div>
        <div>
          <label htmlFor="settings-email" className="mm-label">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            className="mm-input"
            value={user?.email ?? ''}
            readOnly
            style={{ opacity: 0.75, cursor: 'not-allowed' }}
          />
        </div>
        <div>
          <label htmlFor="settings-phone" className="mm-label">
            Phone
          </label>
          <input
            id="settings-phone"
            type="tel"
            className="mm-input"
            placeholder="+1 (555) 555-0123"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div>
          <label htmlFor="settings-tz" className="mm-label">
            Timezone
          </label>
          <input
            id="settings-tz"
            className="mm-input"
            value={deriveTimezone()}
            readOnly
            style={{ opacity: 0.75, cursor: 'not-allowed' }}
          />
        </div>
        <div>
          <div className="mm-label">Theme</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {(['dark', 'light'] as const).map((t) => {
              const isActive = theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={isActive ? 'mm-pill mm-pill-mint' : 'mm-pill'}
                  style={{
                    padding: '7px 14px',
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <DisplayCurrencyPicker />
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'flex-end',
        }}
      >
        {update.isError && (
          <span style={{ fontSize: 12, color: 'var(--color-loss)' }}>
            {normalizeError(update.error)}
          </span>
        )}
        <button
          type="button"
          className="mm-btn mm-btn-mint"
          onClick={onSave}
          disabled={!dirty || update.isPending}
          style={{
            opacity: !dirty || update.isPending ? 0.6 : 1,
            cursor: !dirty || update.isPending ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {update.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
          {update.isPending ? 'Saving' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}

// ─── Display currency picker ───────────────────────────────────────────────
//
// Lives inside the Profile form so it sits next to the other display-level
// preferences (theme, handle, timezone). Persisted through the zustand store;
// there's nothing to save to the backend — all conversions happen client-side
// off the `/api/v1/market/rates` feed.

function DisplayCurrencyPicker() {
  const current = useCurrencyStore((s) => s.displayCurrency);
  const setCurrency = useCurrencyStore((s) => s.setDisplayCurrency);
  const activeOption = DISPLAY_CURRENCY_OPTIONS.find((o) => o.value === current);

  return (
    <div>
      <div className="mm-label">Display currency</div>
      <div
        role="radiogroup"
        aria-label="Display currency"
        style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}
      >
        {DISPLAY_CURRENCY_OPTIONS.map((opt) => {
          const isActive = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={opt.hint}
              onClick={() => setCurrency(opt.value as DisplayCurrency)}
              className={isActive ? 'mm-pill mm-pill-mint' : 'mm-pill'}
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {activeOption && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--mm-ink-3)' }}>
          {activeOption.hint}
        </div>
      )}
    </div>
  );
}

// ─── Security — reflects what we actually ship ──────────────────────────────
//
// The design pack shows 2FA + hardware key + IP allowlist + withdrawal lock.
// We don't ship any of those yet — the actual security posture of this
// install is HttpOnly session cookie + backend rate limiter + sidebar
// sign-out. This card reports that truthfully so users aren't misled.

function SecuritySection() {
  const { logout } = useAuth();

  const rows = [
    {
      label: 'Sign-in cookie',
      value: 'HttpOnly, SameSite=Lax · JS cannot read the token',
      action: null,
      on: true,
    },
    {
      label: 'Rate limiting',
      value: 'Login + register gated by IP-level bucket (Bucket4j)',
      action: null,
      on: true,
    },
    {
      label: 'Password',
      value: 'BCrypt at rest · complexity enforced on register',
      action: 'Change',
      on: undefined,
      disabled: true,
      disabledHint: 'Coming soon',
    },
    {
      label: 'Authenticator app (TOTP)',
      value: 'Not yet available',
      action: 'Enable',
      on: false,
      disabled: true,
      disabledHint: 'Coming soon',
    },
    {
      label: 'Hardware key',
      value: 'Not yet available',
      action: 'Add',
      on: false,
      disabled: true,
      disabledHint: 'Coming soon',
    },
  ];

  return (
    <section className="mm-card" style={{ padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="mm-kicker">SECURITY</div>
          <h2
            className="font-display"
            style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}
          >
            Sign-in & 2FA
          </h2>
        </div>
        <span
          className="mm-chip"
          style={{
            background: 'var(--mm-up-soft)',
            color: 'var(--mm-up)',
            padding: '4px 10px',
            fontSize: 11,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <ShieldCheck size={11} strokeWidth={2} />
          BASELINE
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 14,
              alignItems: 'center',
              padding: '14px 4px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--mm-hair)' : 'none',
              opacity: r.disabled ? 0.55 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: 'var(--mm-ink-0)' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--mm-ink-3)', marginTop: 2 }}>{r.value}</div>
            </div>
            {typeof r.on === 'boolean' && (
              <ToggleSwitch on={r.on} aria-label={`${r.label} toggle`} />
            )}
            {!r.action ? (
              <span />
            ) : (
              <button
                type="button"
                className="mm-btn mm-btn-ghost"
                style={{ fontSize: 12, opacity: r.disabled ? 0.7 : 1 }}
                disabled={r.disabled}
                title={r.disabled ? r.disabledHint : undefined}
              >
                {r.action}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Danger zone — real sign-out button. Lives under security because
          that's where users look for it. */}
      <div
        style={{
          marginTop: 24,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid rgba(255,122,122,0.32)',
          background: 'rgba(255,122,122,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="mm-kicker" style={{ color: 'var(--color-loss)' }}>
            DANGER ZONE
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: 'var(--mm-ink-0)' }}>
            Sign out of this session
          </div>
          <div style={{ fontSize: 12, color: 'var(--mm-ink-3)', marginTop: 2 }}>
            Clears the HttpOnly auth cookie and drops you at the login screen.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="mm-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--color-loss)',
            borderColor: 'rgba(255,122,122,0.4)',
          }}
        >
          <LogOut size={12} strokeWidth={2} /> Sign out
        </button>
      </div>
    </section>
  );
}

function ToggleSwitch({ on, ...aria }: { on: boolean; 'aria-label'?: string }) {
  return (
    <div
      role="img"
      {...aria}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        background: on ? 'var(--mm-mint)' : 'var(--mm-hair-2)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: 'var(--mm-bg)',
          transition: 'left 140ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Risk guardrails — Phase 2a + 2b ────────────────────────────────────────

function RiskGuardrailsSection() {
  const { data: accounts = [] } = useAccounts();

  return (
    <section className="mm-card" style={{ padding: '22px 26px' }}>
      <div className="mm-kicker">RISK POLICY</div>
      <h2
        className="font-display"
        style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}
      >
        Risk guardrails
      </h2>
      <p
        style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--mm-ink-2, var(--text-secondary))',
        }}
      >
        Per-account safeties applied before every entry: concurrency caps
        block correlated double-ups; vol-targeting scales position size so
        realized strategy volatility hits the target.
      </p>
      {accounts.length === 0 ? (
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Connect a broker first — risk policy is configured per account.
        </p>
      ) : (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {accounts.map((a) => (
            <RiskPolicyCard key={a.id} account={a} />
          ))}
        </div>
      )}
    </section>
  );
}

function RiskPolicyCard({ account }: { account: AccountSummary }) {
  const mut = useUpdateAccountRiskConfig();
  const [longCap, setLongCap] = useState(String(account.maxConcurrentLongs));
  const [shortCap, setShortCap] = useState(String(account.maxConcurrentShorts));
  const [volEnabled, setVolEnabled] = useState(account.volTargetingEnabled);
  const [volTarget, setVolTarget] = useState(String(account.bookVolTargetPct));

  const save = async () => {
    try {
      await mut.mutateAsync({
        accountId: account.id,
        payload: {
          maxConcurrentLongs: Number(longCap),
          maxConcurrentShorts: Number(shortCap),
          volTargetingEnabled: volEnabled,
          bookVolTargetPct: Number(volTarget) || 15,
        },
      });
      toast.success({ title: 'Risk policy saved', description: account.label });
    } catch (err) {
      toast.error({ title: 'Could not save', description: normalizeError(err) });
    }
  };

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--mm-hair, var(--border-subtle))',
        background: 'var(--mm-surface-2, var(--bg-elevated))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {account.label}
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            {account.exchange}
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={mut.isPending}
          className="mm-btn mm-btn-ghost"
          style={{ fontSize: 11, padding: '6px 12px' }}
        >
          {mut.isPending ? 'Saving…' : 'Save policy'}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        <RiskField label="Max concurrent longs">
          <input
            type="number"
            min={0}
            max={20}
            step={1}
            className="mm-input"
            value={longCap}
            onChange={(e) => setLongCap(e.target.value)}
          />
        </RiskField>
        <RiskField label="Max concurrent shorts">
          <input
            type="number"
            min={0}
            max={20}
            step={1}
            className="mm-input"
            value={shortCap}
            onChange={(e) => setShortCap(e.target.value)}
          />
        </RiskField>
        <RiskField label="Vol-targeting">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={volEnabled}
              onChange={(e) => setVolEnabled(e.target.checked)}
            />
            {volEnabled ? 'On — sizes scaled to target' : 'Off — legacy sizing'}
          </label>
        </RiskField>
        <RiskField label="Annualized vol target (%)">
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            className="mm-input"
            value={volTarget}
            disabled={!volEnabled}
            onChange={(e) => setVolTarget(e.target.value)}
          />
        </RiskField>
      </div>
    </div>
  );
}

function RiskField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Brokers — live from useAccounts ────────────────────────────────────────

function BrokersSection() {
  const { data: accounts = [] } = useAccounts();
  const [rotateTarget, setRotateTarget] = useState<AccountSummary | null>(null);

  return (
    <section className="mm-card" style={{ padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="mm-kicker">CONNECTED</div>
          <h2
            className="font-display"
            style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}
          >
            Brokers & wallets
          </h2>
        </div>
        <Link
          href="/portfolio"
          className="mm-btn mm-btn-mint"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          <Plus size={12} strokeWidth={2} /> Add broker
        </Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <ServerIpCard />
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {accounts.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '40px 20px',
              borderRadius: 12,
              background: 'var(--mm-surface-2)',
              color: 'var(--mm-ink-2)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            No brokers connected yet. Click{' '}
            <strong style={{ color: 'var(--mm-ink-0)' }}>Add broker</strong> to link your first
            account.
          </div>
        ) : (
          accounts.map((a) => {
            const name = (a.label ?? a.exchange ?? 'Broker').trim();
            const isLive = a.active;
            return (
              <div
                key={a.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'var(--mm-surface-2)',
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div
                  className="font-display"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--mm-surface-3)',
                    color: 'var(--mm-ink-0)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                  aria-hidden="true"
                >
                  {name[0]?.toUpperCase() ?? '·'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--mm-ink-3)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(a.exchange ?? 'exchange').toLowerCase()} · {a.id.slice(0, 8)}…
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRotateTarget(a)}
                  className="mm-btn mm-btn-ghost"
                  title="Rotate API key"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    padding: '6px 10px',
                  }}
                >
                  <KeyRound size={11} strokeWidth={2} /> Rotate key
                </button>
                <span
                  className="font-mono"
                  style={{
                    padding: '3px 9px',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    background: isLive ? 'var(--mm-up-soft)' : 'var(--mm-surface-3)',
                    color: isLive ? 'var(--mm-up)' : 'var(--mm-ink-3)',
                    borderRadius: 999,
                  }}
                >
                  {isLive ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            );
          })
        )}
      </div>

      <RotateCredentialsDialog
        account={rotateTarget}
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null);
        }}
      />
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveHandle(source: string): string {
  const base = source.split('@')[0] ?? source;
  const clean = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean ? `@${clean}` : '';
}

function deriveTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMin = -new Date().getTimezoneOffset();
    const hours = offsetMin / 60;
    const sign = hours >= 0 ? '+' : '';
    return `${tz} · GMT${sign}${hours}`;
  } catch {
    return 'UTC';
  }
}

function formatJoinDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
