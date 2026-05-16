'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  format,
  formatDistanceToNowStrict,
  intervalToDuration,
  formatDuration,
  parseISO,
} from 'date-fns';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useResearchActivityStream } from '@/hooks/useResearchActivityStream';
import { researchActivityApi } from '@/lib/api/researchActivity';
import { useWsStore } from '@/store/wsStore';
import type { AgentActivity, AgentSessionSummary } from '@/types/research';
import { toast } from '@/hooks/useToast';

const SESSIONS_PAGE_SIZE = 20;
const ACTIVITIES_PAGE_SIZE = 100;

/** Convert SCREAMING_SNAKE_CASE to Title Case for human display. */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a session duration from two ISO strings. */
function formatSessionDuration(startedAt: string, lastActivityAt: string): string {
  const start = parseISO(startedAt);
  const end = parseISO(lastActivityAt);
  const duration = intervalToDuration({ start, end });
  return formatDuration(duration, { format: ['hours', 'minutes'], zero: false }) || '< 1m';
}

/** Relative offset from a session start ("+15m", "+2h 3m"). */
function relativeOffset(sessionStart: string, activityAt: string): string {
  const startMs = parseISO(sessionStart).getTime();
  const actMs = parseISO(activityAt).getTime();
  const diffMs = actMs - startMs;
  if (diffMs < 0) return '0m';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `+${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
}

interface ActivityStyle {
  color: string;
  bg: string;
  dot: string;
}

function getActivityStyle(
  activityType: string,
  details: Record<string, unknown> | null,
): ActivityStyle {
  if (activityType === 'GOAL_HIT') {
    return { color: 'var(--color-profit)', bg: 'rgba(46,196,138,0.14)', dot: '#2ec48a' };
  }
  if (activityType === 'ERROR') {
    return { color: 'var(--color-loss)', bg: 'rgba(255,90,90,0.14)', dot: '#ff5a5a' };
  }
  if (activityType === 'SESSION_START' || activityType === 'SESSION_END') {
    return { color: 'var(--text-secondary)', bg: 'rgba(170,170,170,0.10)', dot: '#888' };
  }
  if (activityType === 'ITERATION_COMPLETED') {
    const verdict =
      typeof details?.statistical_verdict === 'string' ? details.statistical_verdict : '';
    if (verdict === 'SIGNIFICANT_EDGE') {
      return { color: 'var(--color-profit)', bg: 'rgba(46,196,138,0.14)', dot: '#2ec48a' };
    }
    if (verdict === 'INSUFFICIENT_EVIDENCE') {
      return { color: 'var(--color-info)', bg: 'rgba(59,130,246,0.14)', dot: '#4e9eff' };
    }
    if (verdict === 'DISCARD') {
      return { color: 'var(--color-loss)', bg: 'rgba(255,90,90,0.14)', dot: '#ff5a5a' };
    }

    return { color: 'var(--color-warning)', bg: 'rgba(245,166,35,0.14)', dot: '#f5a623' };
  }
  if (activityType === 'SWEEP_QUEUED') {
    return { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', dot: '#a78bfa' };
  }
  if (activityType === 'TICK_DISPATCHED') {
    return { color: '#818cf8', bg: 'rgba(129,140,248,0.14)', dot: '#818cf8' };
  }
  if (activityType === 'REVIEW_REQUESTED' || activityType === 'REVIEW_RECEIVED') {
    return { color: '#fb923c', bg: 'rgba(251,146,60,0.14)', dot: '#fb923c' };
  }
  if (activityType === 'WALK_FORWARD_SUBMITTED' || activityType === 'WALK_FORWARD_RESULT') {
    return { color: '#22d3ee', bg: 'rgba(34,211,238,0.14)', dot: '#22d3ee' };
  }
  if (activityType === 'HYPOTHESIS_REGISTERED' || activityType === 'PLAN_WRITTEN') {
    return { color: '#c084fc', bg: 'rgba(192,132,252,0.14)', dot: '#c084fc' };
  }
  return { color: 'var(--text-secondary)', bg: 'rgba(170,170,170,0.10)', dot: '#888' };
}

function StrategyBadge({ code }: { code: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-xs"
      style={{
        background: 'var(--accent-glow)',
        color: 'var(--accent-primary)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {code}
    </span>
  );
}

function DetailsBlock({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  return (
    <dl className="mt-2 space-y-1 rounded-sm border border-bd-subtle bg-bg-base p-2">
      {entries.map(([key, value]) => {
        const isComplex = typeof value === 'object' && value !== null;
        return (
          <div key={key} className="flex gap-3 text-[11px]">
            <dt className="w-44 shrink-0 font-mono text-text-muted">{key}</dt>
            <dd className="min-w-0 break-all font-mono text-text-primary">
              {isComplex ? (
                <pre className="whitespace-pre-wrap text-[10px]">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ActivityItem({
  activity,
  sessionStart,
  isLast,
}: {
  activity: AgentActivity;
  sessionStart: string;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = getActivityStyle(activity.activityType, activity.details);
  const isGoal = activity.activityType === 'GOAL_HIT';
  const hasDetails = activity.details !== null && Object.keys(activity.details).length > 0;

  return (
    <div className="relative flex gap-3">
      {}
      {!isLast && (
        <div
          className="absolute left-[9px] top-5 w-px"
          style={{ height: 'calc(100% + 4px)', background: 'rgba(255,255,255,0.07)' }}
        />
      )}

      {}
      <div className="relative mt-1 shrink-0">
        <div
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: style.dot, boxShadow: `0 0 0 3px rgba(255,255,255,0.06)` }}
        >
          {isGoal && <Star size={9} fill="currentColor" className="text-white" />}
        </div>
      </div>

      {}
      <div className="mb-3 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {}
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: style.color, background: style.bg }}
          >
            {toTitleCase(activity.activityType)}
          </span>

          {activity.strategyCode && <StrategyBadge code={activity.strategyCode} />}

          {}
          {activity.status !== 'SUCCESS' && (
            <span className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-loss)]">
              {activity.status}
            </span>
          )}

          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {relativeOffset(sessionStart, activity.createdAt)}
          </span>
        </div>

        <p className="mt-0.5 text-[12px] text-text-primary">{activity.title}</p>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}

        {expanded && hasDetails && activity.details && <DetailsBlock details={activity.details} />}
      </div>
    </div>
  );
}

function SessionTimeline({
  sessionId,
  session,
  onBack,
  liveActivities,
}: {
  sessionId: string;
  session: AgentSessionSummary;
  onBack: () => void;
  liveActivities: AgentActivity[];
}) {
  const query = useQuery({
    queryKey: ['research-activity', 'timeline', sessionId],
    queryFn: () => researchActivityApi.getActivities(sessionId, 0, ACTIVITIES_PAGE_SIZE),
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });

  const fetched: AgentActivity[] = query.data?.content ?? [];

  const fetchedIds = new Set(fetched.map((a) => a.activityId));
  const newLive = liveActivities.filter((a) => !fetchedIds.has(a.activityId));
  const activities: AgentActivity[] = [...fetched, ...newLive];

  return (
    <div className="space-y-5">
      {}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft size={12} /> Back to sessions
          </button>
          <p className="label-caps inline-flex items-center gap-1.5">
            <ShieldCheck size={10} strokeWidth={1.75} />
            Admin · Research Agent Activity
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Session Timeline
          </h1>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-text-muted">{sessionId}</p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill shrink-0"
          style={{ padding: '8px 12px', fontSize: 12 }}
          aria-label="Refresh timeline"
        >
          {query.isFetching ? (
            <Loader2 size={13} strokeWidth={1.7} className="animate-spin" />
          ) : (
            <RefreshCcw size={13} strokeWidth={1.7} />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {}
      <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
        <div className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaStat label="Agent" value={session.agentName} />
          <MetaStat
            label="Started"
            value={format(parseISO(session.startedAt), 'MMM d, HH:mm')}
            mono
          />
          <MetaStat
            label="Duration"
            value={formatSessionDuration(session.startedAt, session.lastActivityAt)}
            mono
          />
          <MetaStat label="Activities" value={String(session.activityCount)} mono />
          <MetaStat label="Iterations" value={String(session.iterationsCompleted)} mono />
          <MetaStat
            label="Significant Edge"
            value={String(session.significantEdgeCount)}
            mono
            tone="profit"
          />
          <MetaStat label="No Edge" value={String(session.noEdgeCount)} mono tone="muted" />
          <MetaStat
            label="Discarded"
            value={String(session.discardCount)}
            mono
            tone={session.discardCount > 0 ? 'warn' : 'muted'}
          />
        </div>
        {session.goalHit && (
          <div
            className="flex items-center gap-2 border-t border-bd-subtle px-4 py-2"
            style={{ background: 'rgba(46,196,138,0.08)' }}
          >
            <Star size={12} fill="currentColor" className="text-[var(--color-profit)]" />
            <span className="text-[12px] font-semibold text-[var(--color-profit)]">
              Goal hit this session
            </span>
          </div>
        )}
        {(session.strategyCodes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-bd-subtle px-4 py-2">
            <span className="text-[11px] text-text-muted">Strategies:</span>
            {session.strategyCodes.map((code) => (
              <StrategyBadge key={code} code={code} />
            ))}
          </div>
        )}
      </section>

      {}
      <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
        <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
          <div>
            <h2 className="font-display text-[14px] font-semibold text-text-primary">
              Activity timeline
            </h2>
            <p className="text-[11px] text-text-secondary">
              {activities.length} event{activities.length !== 1 ? 's' : ''}
              {newLive.length > 0 && (
                <span className="ml-1.5 text-[var(--color-profit)]">+{newLive.length} live</span>
              )}
              {' · oldest first'}
            </p>
          </div>
        </header>

        <div className="p-4">
          {query.isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="mt-1 h-5 w-5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {query.isError && (
            <p className="text-[12px] text-[var(--color-loss)]">
              Failed to load activities. Try refreshing.
            </p>
          )}

          {!query.isLoading && !query.isError && activities.length === 0 && (
            <p className="text-[12px] text-text-muted">No activities recorded for this session.</p>
          )}

          {activities.length > 0 && (
            <div>
              {activities.map((activity, idx) => (
                <ActivityItem
                  key={activity.activityId}
                  activity={activity}
                  sessionStart={session.startedAt}
                  isLast={idx === activities.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetaStat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'profit' | 'warn' | 'muted';
}) {
  const colorClass =
    tone === 'profit'
      ? 'text-[var(--color-profit)]'
      : tone === 'warn'
        ? 'text-[var(--color-warning)]'
        : tone === 'muted'
          ? 'text-text-muted'
          : 'text-text-primary';

  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${colorClass}`}
      >
        {value}
      </dd>
    </div>
  );
}

function SessionCard({
  session,
  onViewTimeline,
}: {
  session: AgentSessionSummary;
  onViewTimeline: (sessionId: string) => void;
}) {
  const shortId = session.sessionId.slice(0, 8);

  const handleCopyId = () => {
    void navigator.clipboard.writeText(session.sessionId).then(() => {
      toast.success({ title: 'Session ID copied', description: session.sessionId });
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd-subtle px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {}
          <span
            className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
          >
            <Bot size={11} />
            {session.agentName}
          </span>

          {}
          <div className="flex items-center gap-1">
            <span className="font-mono text-[12px] tabular-nums text-text-muted">{shortId}…</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="rounded p-0.5 text-text-muted hover:text-text-secondary"
              aria-label="Copy session ID"
              title="Copy full session ID"
            >
              <ClipboardCopy size={11} />
            </button>
          </div>

          {}
          {session.goalHit && (
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{ color: 'var(--color-profit)', background: 'rgba(46,196,138,0.14)' }}
            >
              <Star size={9} fill="currentColor" />
              Goal Hit
            </span>
          )}
        </div>

        {}
        <div className="font-mono text-[11px] tabular-nums text-text-muted">
          <span title={session.startedAt}>
            {format(parseISO(session.startedAt), 'MMM d, HH:mm')}
          </span>
          <span className="mx-1">·</span>
          <span>{formatSessionDuration(session.startedAt, session.lastActivityAt)}</span>
          <span className="mx-1">·</span>
          <span title={session.lastActivityAt}>
            last {formatDistanceToNowStrict(parseISO(session.lastActivityAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      {}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        {}
        <div className="flex flex-wrap items-center gap-5">
          <Stat label="Iterations" value={session.iterationsCompleted} mono />
          <Stat
            label="Sig. Edge"
            value={session.significantEdgeCount}
            mono
            tone={session.significantEdgeCount > 0 ? 'profit' : undefined}
          />
          <Stat label="No Edge" value={session.noEdgeCount} mono tone="muted" />
          <Stat
            label="Discarded"
            value={session.discardCount}
            mono
            tone={session.discardCount > 0 ? 'warn' : undefined}
          />
          <Stat label="Activities" value={session.activityCount} mono />
        </div>

        {}
        {(session.strategyCodes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {session.strategyCodes.map((code) => (
              <StrategyBadge key={code} code={code} />
            ))}
          </div>
        )}
      </div>

      {}
      <div className="flex justify-end border-t border-bd-subtle px-4 py-2.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewTimeline(session.sessionId)}
          className="gap-1.5"
        >
          View timeline <ChevronRight size={12} />
        </Button>
      </div>
    </div>
  );
}

/** Inline stat with label + value. */
function Stat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: number;
  mono?: boolean;
  tone?: 'profit' | 'warn' | 'muted';
}) {
  const colorClass =
    tone === 'profit'
      ? 'text-[var(--color-profit)]'
      : tone === 'warn'
        ? 'text-[var(--color-warning)]'
        : tone === 'muted'
          ? 'text-text-muted'
          : 'text-text-primary';
  return (
    <div className="text-center">
      <div
        className={`text-[14px] font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${colorClass}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
    </div>
  );
}

function SessionsSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
          <div className="border-b border-bd-subtle px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-28 rounded-sm" />
              <Skeleton className="h-4 w-20 rounded-sm" />
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center gap-5">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-8 w-14 rounded-sm" />
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-bd-subtle px-4 py-2.5">
            <Skeleton className="h-7 w-28 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginationBar({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-1 text-[12px] text-text-muted">
      <span className="font-mono tabular-nums">
        Page {page + 1} of {totalPages} · {total} session{total !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function SessionsList({
  onViewTimeline,
  wsConnected,
}: {
  onViewTimeline: (sessionId: string, session: AgentSessionSummary) => void;
  wsConnected: boolean;
}) {
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['research-activity', 'sessions', page],
    queryFn: () => researchActivityApi.getSessions(page, SESSIONS_PAGE_SIZE),
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });

  const sessions = query.data?.content ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-5">
      {}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <ShieldCheck size={10} strokeWidth={1.75} />
            Admin
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
              Research Agent Activity
            </h1>
            {wsConnected && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: 'rgba(46,196,138,0.14)', color: 'var(--color-profit)' }}
              >
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-profit)]" />
                Live
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">
            Quant-researcher agent session log — iteration outcomes, edge verdicts, walk-forward
            submissions, and goal events. Select a session to view the full activity timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill shrink-0"
          style={{ padding: '8px 12px', fontSize: 12 }}
          aria-label="Refresh sessions"
        >
          {query.isFetching && !query.isLoading ? (
            <Loader2 size={13} strokeWidth={1.7} className="animate-spin" />
          ) : (
            <RefreshCcw size={13} strokeWidth={1.7} />
          )}
          <span>Refresh</span>
        </button>
      </div>

      <div className="h-px w-full bg-bd-subtle" />

      {}
      {query.isLoading && <SessionsSkeletonList />}

      {}
      {query.isError && !query.isLoading && (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface p-6 text-center">
          <p className="text-[13px] text-[var(--color-loss)]">
            Failed to load sessions. Check the Research JVM connection and try refreshing.
          </p>
        </div>
      )}

      {}
      {!query.isLoading && !query.isError && sessions.length === 0 && (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface p-10 text-center">
          <Bot size={32} className="mx-auto mb-3 text-text-muted" strokeWidth={1.4} />
          <p className="text-[14px] font-medium text-text-primary">No sessions yet</p>
          <p className="mt-1 text-[12px] text-text-secondary">
            The quant-researcher agent has not started any sessions. Start the agent to begin
            recording activity.
          </p>
        </div>
      )}

      {}
      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onViewTimeline={(id) => onViewTimeline(id, session)}
            />
          ))}
        </div>
      )}

      {}
      {!query.isLoading && total > 0 && (
        <PaginationBar page={page} total={total} pageSize={SESSIONS_PAGE_SIZE} onPage={setPage} />
      )}
    </div>
  );
}

export default function ResearchActivityPage() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const wsConnected = useWsStore((s) => s.connected);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AgentSessionSummary | null>(null);

  const [liveActivities, setLiveActivities] = useState<AgentActivity[]>([]);

  const lastSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastSessionRef.current;
    lastSessionRef.current = selectedSessionId;

    if (prev !== null && prev !== selectedSessionId) {
      setLiveActivities([]);
    }
  }, [selectedSessionId]);

  const handleLiveActivity = useCallback(
    (activity: AgentActivity) => {
      setLiveActivities((prev) => {
        if (prev.some((a) => a.activityId === activity.activityId)) return prev;
        return [...prev, activity];
      });

      if (activity.activityType === 'SESSION_END') {
        void queryClient.invalidateQueries({ queryKey: ['research-activity', 'sessions'] });
        void queryClient.invalidateQueries({ queryKey: ['research-activity', 'timeline'] });
      }
    },
    [queryClient],
  );

  useResearchActivityStream(handleLiveActivity);

  const sessionLiveActivities = liveActivities.filter((a) => a.sessionId === selectedSessionId);

  if (!isAdmin) {
    return <div className="px-6 py-12 text-center text-text-secondary">Admin access required.</div>;
  }

  if (selectedSessionId !== null && selectedSession !== null) {
    return (
      <div className="space-y-6 px-6 py-6">
        <SessionTimeline
          sessionId={selectedSessionId}
          session={selectedSession}
          onBack={() => {
            setSelectedSessionId(null);
            setSelectedSession(null);
          }}
          liveActivities={sessionLiveActivities}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <SessionsList
        onViewTimeline={(id, session) => {
          setSelectedSessionId(id);
          setSelectedSession(session);
        }}
        wsConnected={wsConnected}
      />
    </div>
  );
}
