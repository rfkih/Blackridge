'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  Globe2,
  History,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStrategies } from '@/hooks/useStrategies';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/formatters';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { listAlerts, type AlertEvent } from '@/lib/api/alerts';
import { listBacktestRuns } from '@/lib/api/backtest';
import { getServerIpStatus } from '@/lib/api/server';
import { listTradeExecutions, type TradeExecutionEvent } from '@/lib/api/tradeExecutions';
import { useAuthStore } from '@/store/authStore';

type NotificationKind =
  | 'killSwitch'
  | 'ipChange'
  | 'backtestDone'
  | 'systemAlert'
  | 'tradeExecution';

interface Notification {
  id: string;
  kind: NotificationKind;
  /** ISO 8601 — used for sort + display. */
  ts: string;
  title: string;
  body: string;
  href?: string;
  /** Severity drives the leading icon + colour. */
  severity: 'critical' | 'warning' | 'info' | 'success';
  /** When true a × dismiss button is rendered on the row. */
  dismissible?: boolean;
}

// ── Per-user localStorage helpers ─────────────────────────────────────────────
// All keys are scoped to userId so two users sharing a browser never bleed
// "already read" or "dismissed" state into each other.

const readFlagKey = (userId: string) => `blackheart:notifications:lastSeenTs:${userId}`;
const dismissedKey = (userId: string) => `blackheart:notifications:dismissed:${userId}`;

function readLastSeenTs(userId: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = window.localStorage.getItem(readFlagKey(userId));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenTs(userId: string, ts: number) {
  if (typeof window === 'undefined') return;
  // Guard: never persist NaN — a corrupt value makes the badge permanently stuck.
  if (!Number.isFinite(ts)) return;
  try {
    window.localStorage.setItem(readFlagKey(userId), String(ts));
  } catch {}
}

function readDismissed(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const v = window.localStorage.getItem(dismissedKey(userId));
    const arr = v ? (JSON.parse(v) as unknown) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(userId: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(dismissedKey(userId), JSON.stringify(Array.from(ids)));
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPanel() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const isAdmin = useIsAdmin();
  const { data: strategies = [] } = useStrategies();

  // IP status — admin only; regular users don't manage the VPS/Binance whitelist.
  const ipStatus = useQuery({
    queryKey: ['server', 'ip-status'],
    queryFn: getServerIpStatus,
    staleTime: 60_000,
    retry: 0,
    enabled: isAdmin,
  });

  // Direct useQuery (not via useBacktestRuns) so we can add refetchInterval.
  // useBacktestRuns never polls a COMPLETED-only list — its refetchInterval
  // callback always returns false when no PENDING/RUNNING rows are present,
  // meaning new completions never surface during a session without this.
  const recentBacktests = useQuery({
    queryKey: ['backtest-runs', 'COMPLETED', null, null, null, null, null, 'createdAt', 'DESC', 0, 3, null],
    queryFn: () => listBacktestRuns({ status: 'COMPLETED', size: 3 }),
    staleTime: 2_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const recentAlerts = useQuery({
    queryKey: ['alerts', 'recent-popover'],
    queryFn: () => listAlerts({ size: 5, includeSuppressed: false }),
    staleTime: 30_000,
    enabled: isAdmin,
    retry: 0,
    refetchOnWindowFocus: true,
  });

  // Per-user execution feed — every real trade outcome (entries, SL/TP
  // closes, failures) for the user's own accounts. Polls so an execution
  // that fires mid-session surfaces without a reload; available to every
  // authenticated user, unlike the admin-only system alerts above.
  const recentExecutions = useQuery({
    queryKey: ['trade-executions', 'recent-popover'],
    queryFn: () => listTradeExecutions({ size: 8 }),
    staleTime: 2_000,
    retry: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Dismissed notification IDs — persisted per user so sticky warnings
  // (e.g. IP change) can be manually cleared after the user has acted on them.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (userId) setDismissedIds(readDismissed(userId));
  }, [userId]);

  const dismiss = useCallback(
    (id: string) => {
      if (!userId) return;
      setDismissedIds((prev) => {
        const next = new Set(prev).add(id);
        writeDismissed(userId, next);
        return next;
      });
    },
    [userId],
  );

  const notifications = useMemo<Notification[]>(() => {
    const out: Notification[] = [];

    for (const s of strategies) {
      if (s.isKillSwitchTripped && s.killSwitchTrippedAt) {
        out.push({
          id: `kill-${s.id}`,
          kind: 'killSwitch',
          ts: s.killSwitchTrippedAt,
          title: `Kill-switch tripped on ${s.strategyCode}`,
          body: s.killSwitchReason
            ? `${s.presetName} · ${s.killSwitchReason}`
            : `${s.presetName} — open for review.`,
          href: `/strategies/${s.id}`,
          severity: 'critical',
        });
      }
    }

    // IP change is admin-only — guard here too in case the query fires before
    // isAdmin hydrates from the store.
    if (isAdmin && ipStatus.data?.event === 'CHANGED' && ipStatus.data.recordedAt) {
      out.push({
        id: `ip-${ipStatus.data.recordedAt}`,
        kind: 'ipChange',
        ts: ipStatus.data.recordedAt,
        title: 'Server IP changed',
        body: `Now ${ipStatus.data.currentIp ?? 'unknown'} (was ${ipStatus.data.previousIp ?? '—'}). Update your Binance whitelist.`,
        href: '/settings',
        severity: 'warning',
        dismissible: true,
      });
    }

    for (const r of recentBacktests.data?.content ?? []) {
      if (!r.completedAt) continue;
      out.push({
        id: `bt-${r.id}`,
        kind: 'backtestDone',
        ts: r.completedAt,
        title: `Backtest finished — ${r.strategyCode || r.strategyName || 'Backtest'}`,
        body:
          r.metrics?.totalReturnPct != null
            ? `${r.symbol ?? '—'} ${r.interval ?? '—'} · ${r.metrics.totalReturnPct.toFixed(2)}% return`
            : `${r.symbol ?? '—'} ${r.interval ?? '—'}`,
        href: `/backtest/${r.id}`,
        severity: 'success',
      });
    }

    for (const a of recentAlerts.data?.content ?? []) {
      if (!a.createdAt) continue;
      out.push({
        id: `alert-${a.alertEventId}`,
        kind: 'systemAlert',
        ts: a.createdAt,
        title: alertTitle(a),
        body: a.message,
        href: '/admin/alerts',
        severity: alertSeverity(a),
      });
    }

    for (const e of recentExecutions.data?.content ?? []) {
      if (!e.executedAt) continue;
      out.push({
        id: `exec-${e.id}`,
        kind: 'tradeExecution',
        ts: e.executedAt,
        title: executionTitle(e),
        body: executionBody(e),
        href: '/trades',
        severity: e.status === 'FAILED' ? 'warning' : 'success',
      });
    }

    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    // Remove items the user has already dismissed.
    return out.filter((n) => !dismissedIds.has(n.id));
  }, [
    strategies,
    ipStatus.data,
    recentBacktests.data,
    recentAlerts.data,
    recentExecutions.data,
    dismissedIds,
    isAdmin,
  ]);

  // Load per-user last-seen timestamp. Re-runs on user switch.
  const [lastSeenTs, setLastSeenTs] = useState<number>(0);
  useEffect(() => {
    if (userId) setLastSeenTs(readLastSeenTs(userId));
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => new Date(n.ts).getTime() > lastSeenTs).length,
    [notifications, lastSeenTs],
  );

  const [open, setOpen] = useState(false);

  // Mark as read on CLOSE, not open — ensures the badge only clears after the
  // user has had the chance to scroll through the list. Also stamps whatever
  // is newest at the moment of closing, so a notification that arrived while
  // the panel was open is captured correctly rather than being auto-read on
  // the next render (the old open-time effect bug).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && userId) {
        const newestTs = notifications[0]?.ts;
        if (newestTs) {
          const ms = new Date(newestTs).getTime();
          if (Number.isFinite(ms)) {
            setLastSeenTs(ms);
            writeLastSeenTs(userId, ms);
          }
        }
      }
    },
    [notifications, userId],
  );

  // True while the first-load fetches are still in flight — prevents the
  // "Nothing to flag" empty state from flashing before data arrives.
  const isLoading =
    recentBacktests.isLoading || recentExecutions.isLoading || (isAdmin && recentAlerts.isLoading);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mm-pill"
          style={{ padding: '9px 14px', fontSize: 14, position: 'relative' }}
          aria-label={unreadCount > 0 ? `Alerts — ${unreadCount} unread` : 'Alerts'}
        >
          <Bell size={14} strokeWidth={1.7} />
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 5,
                right: 8,
                minWidth: 14,
                height: 14,
                padding: '0 4px',
                borderRadius: 999,
                background: 'var(--color-loss)',
                color: 'var(--text-inverse)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
      >
        <header className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-text-primary">Alerts</h3>
          <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
            {isLoading
              ? 'loading…'
              : notifications.length === 0
                ? 'all clear'
                : `${notifications.length} item${notifications.length === 1 ? '' : 's'}`}
          </span>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[14px]">Loading alerts…</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CheckCircle2 size={20} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-[14px] text-text-secondary">Nothing to flag.</p>
            <p className="text-[12px] text-text-muted">
              Trade executions, kill-switch trips, IP changes, and finished backtests show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y divide-bd-subtle overflow-y-auto">
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onClose={() => handleOpenChange(false)}
                onDismiss={n.dismissible ? () => dismiss(n.id) : undefined}
              />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function NotificationRow({
  n,
  onClose,
  onDismiss,
}: {
  n: Notification;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const Icon = iconFor(n);
  const colour = colourFor(n.severity);

  const body = (
    <div className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-bg-hover">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
        style={{ background: colour.bg, color: colour.fg }}
      >
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text-primary">{n.title}</p>
        <p className="line-clamp-2 text-[13px] text-text-secondary">{n.body}</p>
        <p className="mt-1 font-mono text-[12px] text-text-muted">
          {formatDate(new Date(n.ts).getTime())}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-40 transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );

  if (n.href) {
    return (
      <li>
        <Link href={n.href} onClick={onClose} className="block">
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function iconFor(n: Notification): React.ElementType {
  switch (n.kind) {
    case 'killSwitch':
      return ShieldAlert;
    case 'ipChange':
      return Globe2;
    case 'backtestDone':
      return History;
    case 'systemAlert':
      return AlertTriangle;
    case 'tradeExecution':
      return ArrowRightLeft;
    default:
      return AlertTriangle;
  }
}

// ── Trade-execution formatting ────────────────────────────────────────────────

// Maps raw exit/entry reason codes to compact human labels. Reasons that are
// free-form strategy sentences (e.g. "DCB long: donchian breakout + …") fall
// through and are shown as-is in the body.
const EXECUTION_REASON_LABEL: Record<string, string> = {
  STOP_LOSS: 'stop loss',
  SL_HIT: 'stop loss',
  TAKE_PROFIT: 'take profit',
  TP_HIT: 'take profit',
  RUNNER_CLOSE: 'runner close',
  MANUAL_CLOSE: 'manual close',
  SIGNAL_EXIT: 'signal exit',
  EMABAND_EXIT: 'signal exit',
};

function reasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return EXECUTION_REASON_LABEL[reason.trim().toUpperCase()] ?? null;
}

// Exported for unit tests — pure formatting, no component state.
export function executionTitle(e: TradeExecutionEvent): string {
  const side = e.side ? ` ${e.side}` : '';
  const asset = e.asset ?? '—';
  if (e.status === 'FAILED') {
    return e.executionType === 'OPEN'
      ? `Trade entry failed —${side} ${asset}`
      : `Trade close failed —${side} ${asset}`;
  }
  if (e.executionType === 'OPEN') {
    return `Trade opened —${side} ${asset}`;
  }
  const label = reasonLabel(e.executionReason);
  return label ? `Trade closed (${label}) —${side} ${asset}` : `Trade closed —${side} ${asset}`;
}

// Exported for unit tests — pure formatting, no component state.
export function executionBody(e: TradeExecutionEvent): string {
  const prefix = e.strategyName ? `${e.strategyName} · ` : '';
  if (e.status === 'FAILED' && e.errorMessage) {
    return `${prefix}${e.errorMessage}`;
  }
  // For successes the reason is the entry/exit rationale; mapped codes are
  // already surfaced in the title, so only free-form reasons add information.
  if (e.executionReason && !reasonLabel(e.executionReason)) {
    return `${prefix}${e.executionReason}`;
  }
  return prefix ? prefix.slice(0, -3) : 'Execution recorded.';
}

// Maps backend kind strings to human-readable labels.
// Falls back to title-casing the raw string so unknown future kinds are legible.
const ALERT_KIND_LABEL: Record<string, string> = {
  kill_switch_tripped: 'Kill-switch tripped',
  ingest_stall: 'Ingest stalled',
  ml_signal_stale: 'ML signal stale',
  ml_signal_missing: 'ML signal missing',
  ip_changed: 'Server IP changed',
  backtest_failed: 'Backtest failed',
  strategy_error: 'Strategy error',
  db_connection_lost: 'Database connection lost',
  ws_disconnect: 'WebSocket disconnected',
};

function alertTitle(a: AlertEvent): string {
  const label = ALERT_KIND_LABEL[a.kind];
  if (label) return label;
  return a.kind.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function alertSeverity(a: AlertEvent): Notification['severity'] {
  switch (a.severity) {
    case 'CRITICAL':
      return 'critical';
    case 'WARN':
      return 'warning';
    case 'INFO':
    default:
      return 'info';
  }
}

function colourFor(s: Notification['severity']): { bg: string; fg: string } {
  switch (s) {
    case 'critical':
      return { bg: 'rgba(229,72,77,0.15)', fg: 'var(--color-loss)' };
    case 'warning':
      return { bg: 'rgba(245,166,35,0.15)', fg: 'var(--color-warning)' };
    case 'success':
      return { bg: 'rgba(22,179,100,0.15)', fg: 'var(--color-profit)' };
    case 'info':
    default:
      return { bg: 'rgba(59,130,246,0.15)', fg: 'var(--color-info)' };
  }
}
