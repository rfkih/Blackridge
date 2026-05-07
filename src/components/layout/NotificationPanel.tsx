'use client';

// In-app event feed shown in the TopNav alerts popover. Today this is composed
// from existing API surfaces — kill-switch trips on AccountStrategy, IP changes
// from ServerIpLog, and recent COMPLETED backtests — rather than a dedicated
// notification feed (no backend table for that yet). When the backend grows a
// real /api/v1/notifications endpoint with read/unread state, swap the
// composition below for a single fetch + change the unread-count source.

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Globe2,
  History,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useStrategies } from '@/hooks/useStrategies';
import { useBacktestRuns } from '@/hooks/useBacktest';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/formatters';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { listAlerts, type AlertEvent } from '@/lib/api/alerts';

interface ServerIpStatus {
  currentIp?: string | null;
  previousIp?: string | null;
  event?: string | null; // 'INITIAL' | 'UNCHANGED' | 'CHANGED'
  recordedAt?: string | null;
}

type NotificationKind = 'killSwitch' | 'ipChange' | 'backtestDone' | 'systemAlert';

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
}

const READ_FLAG_KEY = 'blackheart:notifications:lastSeenTs';

function readLastSeenTs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = window.localStorage.getItem(READ_FLAG_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenTs(ts: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(READ_FLAG_KEY, String(ts));
  } catch {
    /* no-op */
  }
}

export function NotificationPanel() {
  const { data: strategies = [] } = useStrategies();
  const ipStatus = useQuery<ServerIpStatus>({
    queryKey: ['server', 'ip-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<ServerIpStatus>('/api/v1/server/ip/status');
      return data;
    },
    staleTime: 60_000,
    retry: 0,
  });
  const recentBacktests = useBacktestRuns({ status: 'COMPLETED', size: 5 });

  // Admin-only feed of operational alerts (kill-switch trips, ingest stalls,
  // P&L deviation, verdict drift). 403 for non-admins is fine — `enabled`
  // guards against firing it at all.
  const isAdmin = useIsAdmin();
  const recentAlerts = useQuery({
    queryKey: ['alerts', 'recent-popover'],
    queryFn: () => listAlerts({ size: 10, includeSuppressed: false }),
    staleTime: 30_000,
    enabled: isAdmin,
    retry: 0,
  });

  const notifications = useMemo<Notification[]>(() => {
    const out: Notification[] = [];

    // 1. Kill-switch trips — strategy-level, very high priority.
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

    // 2. IP whitelist change — affects every account simultaneously.
    if (ipStatus.data?.event === 'CHANGED' && ipStatus.data.recordedAt) {
      out.push({
        id: `ip-${ipStatus.data.recordedAt}`,
        kind: 'ipChange',
        ts: ipStatus.data.recordedAt,
        title: 'Server IP changed',
        body: `Now ${ipStatus.data.currentIp ?? 'unknown'} (was ${ipStatus.data.previousIp ?? '—'}). Update your Binance whitelist.`,
        href: '/settings',
        severity: 'warning',
      });
    }

    // 3. Recent backtest completions — useful for "I kicked off a sweep, did
    //    it finish?" without having to navigate to the runs list.
    const runs = recentBacktests.data?.content ?? [];
    for (const r of runs.slice(0, 3)) {
      if (!r.completedAt) continue;
      out.push({
        id: `bt-${r.id}`,
        kind: 'backtestDone',
        ts: r.completedAt,
        title: `Backtest finished — ${r.strategyCode || r.strategyName}`,
        body:
          r.metrics?.totalReturnPct != null
            ? `${r.symbol} ${r.interval} · ${r.metrics.totalReturnPct.toFixed(2)}% return`
            : `${r.symbol} ${r.interval}`,
        href: `/backtest/${r.id}`,
        severity: 'success',
      });
    }

    // 4. Operational alerts (admin only) — Phase 7 system signals.
    const alerts = recentAlerts.data?.content ?? [];
    for (const a of alerts.slice(0, 5)) {
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

    // Newest first — the panel is about "what just happened".
    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return out;
  }, [strategies, ipStatus.data, recentBacktests.data, recentAlerts.data]);

  // Unread = notifications produced after the last time the user opened the
  // panel. We don't track per-item read state because composing from multiple
  // ephemeral sources doesn't have stable IDs across reloads — a watermark
  // is good enough for "you have new things" UX.
  const [lastSeenTs, setLastSeenTs] = useState<number>(() => readLastSeenTs());
  const newestTs = notifications[0]?.ts ?? null;
  const unreadCount = useMemo(() => {
    if (!newestTs) return 0;
    return notifications.filter((n) => new Date(n.ts).getTime() > lastSeenTs).length;
  }, [notifications, newestTs, lastSeenTs]);

  const [open, setOpen] = useState(false);

  // When the panel opens, mark everything currently visible as seen.
  useEffect(() => {
    if (open && newestTs) {
      const ms = new Date(newestTs).getTime();
      setLastSeenTs(ms);
      writeLastSeenTs(ms);
    }
  }, [open, newestTs]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mm-pill"
          style={{ padding: '9px 14px', fontSize: 13, position: 'relative' }}
          aria-label={
            unreadCount > 0
              ? `Alerts — ${unreadCount} unread`
              : 'Alerts'
          }
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
                fontSize: 9,
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {notifications.length === 0 ? 'all clear' : `${notifications.length} item${notifications.length === 1 ? '' : 's'}`}
          </span>
        </header>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CheckCircle2 size={20} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-[12px] text-text-secondary">Nothing to flag.</p>
            <p className="text-[10px] text-text-muted">
              Kill-switch trips, IP changes, and finished backtests show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y divide-bd-subtle overflow-y-auto">
            {notifications.map((n) => (
              <NotificationRow key={n.id} n={n} onClose={() => setOpen(false)} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ n, onClose }: { n: Notification; onClose: () => void }) {
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
        <p className="truncate text-[12px] font-semibold text-text-primary">{n.title}</p>
        <p className="line-clamp-2 text-[11px] text-text-secondary">{n.body}</p>
        <p className="mt-1 font-mono text-[10px] text-text-muted">
          {formatDate(new Date(n.ts).getTime())}
        </p>
      </div>
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
    default:
      return AlertTriangle;
  }
}

function alertTitle(a: AlertEvent): string {
  return `${a.severity} — ${a.kind}`;
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
