'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useTheme } from '@/components/theme/ThemeProvider';

// ─── Settings nav — mirrors the MONO-MINT design pack's left rail ──────────

interface NavItem {
  k: string;
  label: string;
}
interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'ACCOUNT',
    items: [
      { k: 'profile', label: 'Profile' },
      { k: 'security', label: 'Security · 2FA' },
      { k: 'api', label: 'API keys' },
      { k: 'sessions', label: 'Active sessions' },
    ],
  },
  {
    group: 'TRADING',
    items: [
      { k: 'risk', label: 'Risk guardrails' },
      { k: 'brokers', label: 'Brokers & wallets' },
      { k: 'fees', label: 'Fees & commissions' },
      { k: 'tax', label: 'Tax preferences' },
    ],
  },
  {
    group: 'NOTIFY',
    items: [
      { k: 'alerts', label: 'Alerts' },
      { k: 'reports', label: 'Scheduled reports' },
    ],
  },
  {
    group: 'BILLING',
    items: [
      { k: 'plan', label: 'Plan · Desk Pro' },
      { k: 'invoices', label: 'Invoices' },
      { k: 'referrals', label: 'Referrals' },
    ],
  },
];

type SectionKey = (typeof NAV)[number]['items'][number]['k'];

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
        style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column' }}
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
          ))}
        </div>

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
            PLAN · DESK PRO
          </div>
          <div style={{ color: 'var(--mm-ink-0)', fontWeight: 500, marginTop: 4 }}>
            Renews May 14, 2026
          </div>
          <div style={{ marginTop: 4 }}>$49 / month · annual</div>
        </div>
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
        <ProfileSection />
        <SecuritySection />
        <BrokersSection />
      </div>
    </div>
  );
}

// ─── Profile ────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const handle = useMemo(() => deriveHandle(user?.email ?? user?.name ?? ''), [user]);

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
            }}
          >
            {user?.name || '—'}
          </h2>
          <div style={{ color: 'var(--mm-ink-2)', fontSize: 13, marginTop: 2 }}>
            {user?.email}
            {user?.createdAt && ` · joined ${formatJoinDate(user.createdAt)}`}
          </div>
        </div>
        <button type="button" className="mm-btn">
          Change photo
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--mm-hair)', margin: '24px 0' }} aria-hidden="true" />

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
          />
        </div>
        <div>
          <label htmlFor="settings-handle" className="mm-label">
            Handle
          </label>
          <input id="settings-handle" className="mm-input" value={handle} readOnly />
        </div>
        <div>
          <label htmlFor="settings-email" className="mm-label">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            className="mm-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          />
        </div>
        <div>
          <label htmlFor="settings-currency" className="mm-label">
            Base currency
          </label>
          <input id="settings-currency" className="mm-input" defaultValue="USD" />
        </div>
        <div>
          <label className="mm-label">Theme</label>
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
      </div>
    </section>
  );
}

// ─── Security ───────────────────────────────────────────────────────────────

interface SecurityRow {
  label: string;
  value: string;
  action: string;
  on?: boolean;
}

const SECURITY_ROWS: SecurityRow[] = [
  { label: 'Password', value: 'Last changed 42 days ago', action: 'Change' },
  { label: 'Authenticator app', value: 'Disabled · add a TOTP', action: 'Enable', on: false },
  { label: 'Hardware key', value: 'No keys registered', action: 'Add', on: false },
  { label: 'IP allowlist', value: 'Off · allow any source', action: 'Configure', on: false },
  { label: 'Withdrawal lock', value: '24h delay on new destinations', action: 'Edit', on: true },
];

function SecuritySection() {
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
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: 'var(--mm-up)',
              display: 'inline-block',
            }}
            aria-hidden="true"
          />
          SECURED
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        {SECURITY_ROWS.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 14,
              alignItems: 'center',
              padding: '14px 4px',
              borderBottom: i < SECURITY_ROWS.length - 1 ? '1px solid var(--mm-hair)' : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: 'var(--mm-ink-0)' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--mm-ink-3)', marginTop: 2 }}>{r.value}</div>
            </div>
            {typeof r.on === 'boolean' && <ToggleSwitch on={r.on} aria-label={`${r.label} toggle`} />}
            <button type="button" className="mm-btn mm-btn-ghost" style={{ fontSize: 12 }}>
              {r.action}
            </button>
          </div>
        ))}
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

// ─── Brokers ────────────────────────────────────────────────────────────────

function BrokersSection() {
  const { data: accounts = [] } = useAccounts();

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
        <button
          type="button"
          className="mm-btn mm-btn-mint"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={12} strokeWidth={2} /> Add broker
        </button>
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
            No brokers connected yet. Click <strong style={{ color: 'var(--mm-ink-0)' }}>Add broker</strong> to link your first account.
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
                  gridTemplateColumns: '40px 1fr auto',
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
    const offset = -new Date().getTimezoneOffset() / 60;
    const offsetLabel = offset >= 0 ? `GMT+${offset}` : `GMT${offset}`;
    return `${tz} · ${offsetLabel}`;
  } catch {
    return 'UTC';
  }
}

function formatJoinDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
