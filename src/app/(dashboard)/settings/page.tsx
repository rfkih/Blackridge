'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  Gauge,
  HelpCircle,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts, useUpdateAccountRiskConfig } from '@/hooks/useAccounts';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/theme/ThemeProvider';
import { usePalette, PALETTE_META, type Palette } from '@/components/theme/PaletteProvider';
import { RotateCredentialsDialog } from '@/components/account/RotateCredentialsDialog';
import { AccountTypeControl } from '@/components/account/AccountTypeControl';
import { ServerIpCard } from '@/components/account/ServerIpCard';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import {
  DISPLAY_CURRENCY_OPTIONS,
  useCurrencyStore,
  type DisplayCurrency,
} from '@/store/currencyStore';
import type { AccountSummary } from '@/types/account';

type SectionKey = string;

const SETTINGS_NAV: { k: string; label: string; icon: React.ElementType }[] = [
  { k: 'profile', label: 'Profile', icon: User },
  { k: 'appearance', label: 'Appearance', icon: Sun },
  { k: 'notifications', label: 'Notifications', icon: Bell },
  { k: 'security', label: 'Security', icon: ShieldCheck },
  { k: 'api', label: 'API & exchanges', icon: Zap },
  { k: 'brokers', label: 'Brokers & wallets', icon: Wallet },
  { k: 'risk', label: 'Risk guardrails', icon: Gauge },
  { k: 'activity', label: 'Recent activity', icon: Activity },
  { k: 'support', label: 'Help & support', icon: HelpCircle },
];

export default function SettingsPage() {
  const [active, setActive] = useState<SectionKey>('profile');

  return (
    <div
      className="br settings-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        gap: 24,
        minHeight: 0,
        flex: 1,
      }}
    >
      {}
      <nav
        aria-label="Settings sections"
        className="self-start sticky top-5"
        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {SETTINGS_NAV.map((it) => {
          const Icon = it.icon;
          const isActive = it.k === active;
          return (
            <button
              type="button"
              key={it.k}
              onClick={() => setActive(it.k)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 500,
                color: isActive ? 'var(--brand-700)' : 'var(--text-secondary)',
                background: isActive ? 'var(--brand-50)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background var(--dur-fast), color var(--dur-fast)',
              }}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                style={{
                  flexShrink: 0,
                  color: isActive ? 'var(--brand-600)' : 'var(--text-muted)',
                }}
              />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      {}
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
        {active === 'appearance' && <AppearanceSection />}
        {active === 'notifications' && <NotificationsSection />}
        {active === 'api' && <ApiSection />}
        {active === 'security' && <SecuritySection />}
        {active === 'activity' && <RecentActivitySection />}
        {active === 'brokers' && <BrokersSection />}
        {active === 'risk' && <RiskGuardrailsSection />}
        {active === 'support' && <SupportSection />}
        {}
        {![
          'profile',
          'appearance',
          'notifications',
          'api',
          'security',
          'activity',
          'brokers',
          'risk',
          'support',
        ].includes(active) && <ProfileSection />}
      </div>
    </div>
  );
}

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
        <p style={{ marginTop: 4, fontSize: 14, color: 'var(--mm-ink-2)' }}>
          Every security-sensitive change to your strategies, accounts, and risk config — newest
          first. Scoped to your own actions.
        </p>
      </div>

      {query.isLoading && events.length === 0 ? (
        <div style={{ padding: 16, fontSize: 14, color: 'var(--mm-ink-2)' }}>Loading activity…</div>
      ) : query.isError ? (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(229,72,77,0.40)',
            background: 'rgba(229,72,77,0.08)',
            fontSize: 14,
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
            border: '1px dashed var(--mm-hair-2)',
            borderRadius: 12,
            fontSize: 14,
            color: 'var(--mm-ink-2)',
          }}
        >
          No activity yet. Strategy creations, kill-switch rearms, and risk-config changes show up
          here once you start using the app.
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
              background: 'var(--mm-hair)',
              borderRadius: 12,
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
              fontSize: 13,
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
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--mm-ink-0)' }}
        >
          {humanAction(event.action)}
        </p>
        <p style={{ fontSize: 13, color: 'var(--mm-ink-2)' }}>
          {event.entityType ?? '—'}
          {event.entityId ? ` · ${event.entityId.slice(0, 8)}…` : ''}
          {event.reason ? ` · ${event.reason}` : ''}
        </p>
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: 12,
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
  const parts = action.split('_');
  if (parts.length === 0) return action;
  const first = parts[0];
  const rest = parts.slice(1);
  return [first.charAt(0) + first.slice(1).toLowerCase(), ...rest.map((p) => p.toLowerCase())].join(
    ' ',
  );
}

function SupportSection() {
  const { user } = useAuth();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeDiagnostic, setIncludeDiagnostic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

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

  const onSubmit = async () => {
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
        <p style={{ marginTop: 4, fontSize: 14, color: 'var(--mm-ink-2)' }}>
          Hit a bug or have a question? Send us a message — it lands in the team inbox and we reply
          by email. The diagnostic snapshot helps us reproduce issues without you needing to dig for
          the version or page.
        </p>
      </div>

      {submittedId && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(22,179,100,0.32)',
            background: 'rgba(22,179,100,0.08)',
            fontSize: 14,
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
            style={{ fontSize: 13, padding: '4px 10px' }}
            onClick={() => setSubmittedId(null)}
          >
            Send another
          </button>
        </div>
      )}

      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              void onSubmit();
            }
          }
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
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
              fontSize: 12,
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
            fontSize: 14,
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
              style={{
                cursor: 'pointer',
                fontSize: 12,
                letterSpacing: '0.18em',
                color: 'var(--mm-ink-3)',
              }}
            >
              PREVIEW DIAGNOSTIC
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--mm-surface-2)',
                borderRadius: 6,
                fontSize: 13,
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
            type="button"
            onClick={() => void onSubmit()}
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
      </div>
    </section>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const update = useUpdateMyProfile();

  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const handle = useMemo(() => deriveHandle(user?.email ?? user?.name ?? ''), [user]);

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
            background: 'linear-gradient(135deg, var(--brand-500) 0%, var(--brand-800) 100%)',
            color: '#fff',
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
              fontSize: 14,
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
                    fontSize: 14,
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
          <span style={{ fontSize: 14, color: 'var(--color-loss)' }}>
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
              style={{ padding: '7px 14px', fontSize: 14 }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {activeOption && (
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--mm-ink-3)' }}>
          {activeOption.hint}
        </div>
      )}
    </div>
  );
}

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
            fontSize: 13,
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
              <div style={{ fontSize: 15, color: 'var(--mm-ink-0)' }}>{r.label}</div>
              <div style={{ fontSize: 14, color: 'var(--mm-ink-3)', marginTop: 2 }}>{r.value}</div>
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
                style={{ fontSize: 14, opacity: r.disabled ? 0.7 : 1 }}
                disabled={r.disabled}
                title={r.disabled ? r.disabledHint : undefined}
              >
                {r.action}
              </button>
            )}
          </div>
        ))}
      </div>

      {}
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
          <div style={{ fontSize: 14, marginTop: 4, color: 'var(--mm-ink-0)' }}>
            Sign out of this session
          </div>
          <div style={{ fontSize: 14, color: 'var(--mm-ink-3)', marginTop: 2 }}>
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
        background: on ? 'var(--brand-500)' : 'var(--mm-hair-2)',
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

function RiskGuardrailsSection() {
  const { data: accounts = [] } = useAccounts();

  return (
    <section className="mm-card" style={{ padding: '22px 26px' }}>
      <div className="mm-kicker">RISK POLICY</div>
      <h2 className="font-display" style={{ fontSize: 20, marginTop: 4, letterSpacing: '-0.02em' }}>
        Risk guardrails
      </h2>
      <p
        style={{
          marginTop: 8,
          fontSize: 14,
          color: 'var(--mm-ink-2, var(--text-secondary))',
        }}
      >
        Per-account safeties applied before every entry: concurrency caps block correlated
        double-ups; vol-targeting scales position size so realized strategy volatility hits the
        target.
      </p>
      {accounts.length === 0 ? (
        <p
          style={{
            marginTop: 16,
            fontSize: 14,
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
  // HEDGING accounts are spot-allocation books — the trading concurrency caps
  // and vol-targeting controls below are meaningless for them. There is no
  // account-level hedging risk field in the API today (hedging risk —
  // target allocation, rebalance deadband, cash yield — lives in each hedging
  // strategy's per-strategy param overrides), so we render an honest pointer
  // instead of inventing a fake control. TRADING renders exactly as before.
  if (account.accountType === 'HEDGING') {
    return <HedgingRiskCard account={account} />;
  }
  return <TradingRiskPolicyCard account={account} />;
}

function HedgingRiskCard({ account }: { account: AccountSummary }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--mm-hair, var(--border-subtle))',
        background: 'var(--mm-surface-2, var(--bg-elevated))',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <div>
          <div className="font-mono" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            {account.label}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
            }}
          >
            {account.exchange}
          </div>
        </div>
        <AccountTypeControl account={account} />
      </div>

      <p
        data-testid="hedging-risk-note"
        style={{ marginTop: 12, fontSize: 14, lineHeight: 1.55, color: 'var(--mm-ink-2, var(--text-secondary))' }}
      >
        Hedging risk — target allocation, rebalance deadband, and cash yield — is configured{' '}
        <strong style={{ color: 'var(--text-primary)' }}>per-strategy</strong> on each hedging
        strategy&rsquo;s params, not at the account level. Open the{' '}
        <Link href="/strategies" style={{ color: 'var(--brand-600, var(--accent-primary))', textDecoration: 'underline' }}>
          strategies page
        </Link>{' '}
        and edit a bound hedging strategy to adjust its allocation band and rebalance guard.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px dashed var(--mm-hair-2, var(--border-default))',
          fontSize: 13,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          Coming soon
        </span>
        <span>
          Account-level hedging guardrails (book-wide max drawdown breaker) are not yet available.
        </span>
      </div>
    </div>
  );
}

function TradingRiskPolicyCard({ account }: { account: AccountSummary }) {
  const mut = useUpdateAccountRiskConfig();
  const [longCap, setLongCap] = useState(String(account.maxConcurrentLongs));
  const [shortCap, setShortCap] = useState(String(account.maxConcurrentShorts));
  const [tradesCap, setTradesCap] = useState(
    account.maxConcurrentTrades == null ? '' : String(account.maxConcurrentTrades),
  );
  const [volEnabled, setVolEnabled] = useState(account.volTargetingEnabled);
  const [volTarget, setVolTarget] = useState(String(account.bookVolTargetPct));

  const save = async () => {
    try {
      await mut.mutateAsync({
        accountId: account.id,
        payload: {
          maxConcurrentLongs: Number(longCap),
          maxConcurrentShorts: Number(shortCap),
          // blank or <1 clears the total cap (backend stores it as null = no limit)
          maxConcurrentTrades: tradesCap.trim() === '' ? 0 : Number(tradesCap),
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
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <div>
          <div className="font-mono" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            {account.label}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
            }}
          >
            {account.exchange}
          </div>
          <div style={{ marginTop: 8 }}>
            <AccountTypeControl account={account} />
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={mut.isPending}
          className="mm-btn mm-btn-ghost"
          style={{ fontSize: 13, padding: '6px 12px' }}
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
        <RiskField label="Max concurrent trades (total)">
          <input
            type="number"
            min={0}
            max={20}
            step={1}
            className="mm-input"
            placeholder="No cap"
            value={tradesCap}
            onChange={(e) => setTradesCap(e.target.value)}
          />
        </RiskField>
        <RiskField label="Vol-targeting">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
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
          fontSize: 12,
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
              fontSize: 14,
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
                      fontSize: 14,
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
                      fontSize: 13,
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
                    fontSize: 13,
                    padding: '6px 10px',
                  }}
                >
                  <KeyRound size={11} strokeWidth={2} /> Rotate key
                </button>
                <span
                  className="font-mono"
                  style={{
                    padding: '3px 9px',
                    fontSize: 12,
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

const PALETTE_ORDER: Palette[] = ['midnight', 'slate', 'oxford'];
const NUMBER_FORMATS = [
  { v: 'en-US', l: '1,234.56' },
  { v: 'de-DE', l: '1.234,56' },
  { v: 'fr-FR', l: '1 234,56' },
];

const MODE_PREVIEWS: Record<
  'light' | 'dark',
  { label: string; desc: string; bg: string; card: string }
> = {
  light: {
    label: 'Light',
    desc: 'Default. Generous whitespace.',
    bg: '#FFFFFF',
    card: '#F4F6F9',
  },
  dark: {
    label: 'Dark',
    desc: 'Soft dark — not pure black.',
    bg: '#0E1116',
    card: '#171B22',
  },
};

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [density, setDensity] = useState<'cozy' | 'compact'>('cozy');
  const [numberFmt, setNumberFmt] = useState<string>('en-US');

  return (
    <section className="br flex flex-col gap-4">
      {}
      <SettingCard
        title="Mode"
        desc="Light is friendlier for daytime. Dark is easier on the eyes for late-night sessions."
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {(['light', 'dark'] as const).map((id) => {
            const m = MODE_PREVIEWS[id];
            const on = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className="flex flex-col gap-3 rounded-2xl p-4 text-left transition-colors"
                style={{
                  border: `1.5px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
                  background: on ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                }}
              >
                <ModePreview bg={m.bg} card={m.card} />
                <div>
                  <div className="flex items-center gap-2">
                    {id === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                    <span
                      className="text-[15px] font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {m.label}
                    </span>
                    {on && (
                      <span className="br-chip br-chip-brand ml-auto text-[12px]">Active</span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                    {m.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingCard>

      {}
      <SettingCard
        title="Theme"
        desc="The accent color across every screen. Profit-green and loss-red stay fixed regardless of palette."
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {PALETTE_ORDER.map((id) => {
            const meta = PALETTE_META[id];
            const on = palette === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPalette(id)}
                className="flex flex-col gap-2.5 rounded-2xl p-4 text-left transition-colors"
                style={{
                  border: `1.5px solid ${on ? meta.swatch : 'var(--border-default)'}`,
                  background: on
                    ? 'color-mix(in srgb, ' + meta.swatch + ' 8%, var(--bg-elevated))'
                    : 'var(--bg-elevated)',
                }}
              >
                <div
                  className="relative h-[72px] overflow-hidden rounded-[10px]"
                  style={{
                    background: `linear-gradient(135deg, ${meta.swatch}, ${meta.accent})`,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: -16,
                      top: -16,
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.14)',
                    }}
                  />
                  <div
                    className="absolute bottom-2.5 left-3 text-[13px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: '#fff', opacity: 0.9 }}
                  >
                    Balance
                  </div>
                  <div
                    className="absolute bottom-[22px] left-3 font-display"
                    style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}
                  >
                    $124,460
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="block rounded-full"
                      style={{ width: 16, height: 16, background: meta.swatch }}
                    />
                    <span
                      className="text-[15px] font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {meta.label}
                    </span>
                    {on && (
                      <span className="br-chip br-chip-brand ml-auto text-[12px]">Active</span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                    {meta.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingCard>

      <SettingCard title="Density" desc="How tightly the dashboard packs information.">
        <Segmented
          value={density}
          onChange={(v) => setDensity(v as 'cozy' | 'compact')}
          options={[
            { v: 'cozy', l: 'Cozy' },
            { v: 'compact', l: 'Compact' },
          ]}
        />
      </SettingCard>

      <SettingCard title="Number format" desc="How prices and quantities are displayed.">
        <Segmented value={numberFmt} onChange={setNumberFmt} options={NUMBER_FORMATS} />
      </SettingCard>
    </section>
  );
}

function ModePreview({ bg, card }: { bg: string; card: string }) {
  return (
    <div
      className="flex gap-2 rounded-[10px] p-2.5"
      style={{
        height: 96,
        background: bg,
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="rounded-md" style={{ width: 28, background: card }} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="rounded" style={{ height: 8, width: '60%', background: card }} />
        <div className="rounded-md" style={{ height: 28, background: card }} />
        <div className="rounded" style={{ height: 6, width: '40%', background: card }} />
        <div className="rounded" style={{ height: 6, width: '50%', background: card }} />
      </div>
    </div>
  );
}

function SettingCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="br-card" style={{ padding: 24 }}>
      <div className="mb-4">
        <h2
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
        {desc && (
          <p className="m-0 mt-1.5 text-[15px]" style={{ color: 'var(--text-muted)' }}>
            {desc}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-[10px] p-1"
      style={{ background: 'var(--bg-hover)' }}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className="rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors"
          style={{
            background: value === o.v ? 'var(--bg-elevated)' : 'transparent',
            color: value === o.v ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: value === o.v ? 'var(--shadow-panel)' : 'none',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function NotificationsSection() {
  const [notif, setNotif] = useState({
    fills: true,
    dailyDigest: true,
    drawdown: true,
    news: false,
    productUpdates: false,
  });
  const flip = (k: keyof typeof notif) => setNotif((n) => ({ ...n, [k]: !n[k] }));

  return (
    <section className="br flex flex-col gap-4">
      <SettingCard title="Notifications" desc="How and when we ping you.">
        <ToggleRow
          on={notif.fills}
          onChange={() => flip('fills')}
          title="Order fills"
          sub="Email + push when an order fills, partials included."
        />
        <ToggleRow
          on={notif.dailyDigest}
          onChange={() => flip('dailyDigest')}
          title="Daily P&L digest"
          sub="One email per day at 23:00 SGT with realized & unrealized P&L."
        />
        <ToggleRow
          on={notif.drawdown}
          onChange={() => flip('drawdown')}
          title="Drawdown alert"
          sub="Push notification when any strategy hits −3% intraday."
          badge="Recommended"
        />
        <ToggleRow
          on={notif.news}
          onChange={() => flip('news')}
          title="Market news"
          sub="Curated headlines for symbols you trade."
        />
        <ToggleRow
          on={notif.productUpdates}
          onChange={() => flip('productUpdates')}
          title="Product updates"
          sub="New strategies, features, and changelog."
        />
      </SettingCard>
    </section>
  );
}

const EXCHANGE_ROWS = [
  { ex: 'Binance Futures', label: 'Production · BR-Main', status: 'live', lastUsed: '3s ago' },
  { ex: 'Binance Spot', label: 'Production · BR-Cash', status: 'live', lastUsed: '4m ago' },
  { ex: 'OKX', label: 'Paper trading', status: 'paper', lastUsed: '2d ago' },
] as const;

function ApiSection() {
  return (
    <section className="br flex flex-col gap-4">
      <SettingCard
        title="Connected exchanges"
        desc="API keys live encrypted in our vault. Withdrawals must be disabled."
      >
        {EXCHANGE_ROWS.map((k, i) => (
          <div
            key={k.ex}
            className="flex items-center gap-3.5 py-3.5"
            style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}
          >
            <div
              className="font-display grid place-items-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'var(--bg-hover)',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--text-primary)',
              }}
            >
              {k.ex.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {k.ex}
              </div>
              <div className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
                {k.label} · last used {k.lastUsed}
              </div>
            </div>
            <span className={`br-chip ${k.status === 'live' ? 'br-chip-profit' : 'br-chip-info'}`}>
              {k.status === 'live' ? 'LIVE' : 'PAPER'}
            </span>
            <button type="button" className="br-btn br-btn-ghost br-btn-sm">
              Manage
            </button>
          </div>
        ))}
        <button type="button" className="br-btn br-btn-secondary mt-3.5">
          <Plus size={14} /> Add exchange
        </button>
      </SettingCard>
    </section>
  );
}

function ToggleRow({
  on,
  onChange,
  title,
  sub,
  badge,
}: {
  on: boolean;
  onChange: () => void;
  title: string;
  sub: string;
  badge?: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 py-3.5"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          {badge && <span className="br-chip br-chip-brand text-[12px]">{badge}</span>}
        </div>
        <div className="mt-0.5 text-[14px]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className="relative shrink-0 transition-colors"
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: on ? 'var(--brand-500)' : 'var(--border-default)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left var(--dur-fast)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  );
}
