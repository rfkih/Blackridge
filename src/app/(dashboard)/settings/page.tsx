'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useUpdateMyProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/theme/ThemeProvider';
import { RotateCredentialsDialog } from '@/components/account/RotateCredentialsDialog';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import {
  DISPLAY_CURRENCY_OPTIONS,
  useCurrencyStore,
  type DisplayCurrency,
} from '@/store/currencyStore';
import type { AccountSummary } from '@/types/account';

// ─── Settings nav — mirrors the MONO-MINT design pack's left rail ───────────
//
// Each nav item carries a `wired` flag so we can visually match the design
// pack (showing every section the product will eventually expose) while being
// honest about what works today — everything not-yet-backed by backend
// endpoints dims and disables its click target rather than routing to a
// placeholder.

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
      { k: 'api', label: 'API keys', wired: false },
      { k: 'sessions', label: 'Active sessions', wired: false },
    ],
  },
  {
    group: 'TRADING',
    items: [
      { k: 'risk', label: 'Risk guardrails', wired: false },
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
];

type SectionKey = string;

export default function SettingsPage() {
  const [active, setActive] = useState<SectionKey>('profile');

  return (
    <div
      className="mm"
      style={{
        display: 'grid',
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
          {NAV.map((group) => (
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
              {group.items.map((it) => {
                const isActive = it.k === active;
                return (
                  <button
                    type="button"
                    key={it.k}
                    onClick={() => it.wired && setActive(it.k)}
                    disabled={!it.wired}
                    title={it.wired ? undefined : 'Coming soon'}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      color: isActive
                        ? 'var(--mm-ink-0)'
                        : it.wired
                          ? 'var(--mm-ink-1)'
                          : 'var(--mm-ink-3)',
                      background: isActive ? 'var(--mm-surface-2)' : 'transparent',
                      borderLeft: isActive
                        ? '2px solid var(--mm-mint)'
                        : '2px solid transparent',
                      cursor: it.wired ? 'pointer' : 'not-allowed',
                      fontFamily: 'var(--font-body)',
                      transition: 'background 120ms, color 120ms',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: it.wired ? 1 : 0.6,
                    }}
                  >
                    <span>{it.label}</span>
                    {!it.wired && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 8,
                          letterSpacing: '0.16em',
                          color: 'var(--mm-ink-3)',
                          textTransform: 'uppercase',
                        }}
                      >
                        soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
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
        {active === 'brokers' && <BrokersSection />}
        {/* Profile view is the landing one — when there's no match we fall
            back to it rather than showing an empty canvas. */}
        {!['profile', 'security', 'brokers'].includes(active) && <ProfileSection />}
      </div>
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
    <div
      style={{
        padding: '12px 10px',
        borderRadius: 12,
        background: 'var(--mm-surface-2)',
        fontSize: 11,
        color: 'var(--mm-ink-2)',
        lineHeight: 1.5,
        marginTop: 12,
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
