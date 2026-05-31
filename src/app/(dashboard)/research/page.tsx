'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChevronRight,
  CircleDot,
  Cpu,
  Clock,
  HardDrive,
  ListChecks,
  Loader2,
  PauseCircle,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useRearmKillSwitch, useStrategies } from '@/hooks/useStrategies';
import { useSearchResearchLog, useSearchSweeps } from '@/hooks/useResearch';
import { useResearchControl } from '@/hooks/useResearchControl';
import {
  useResearchAutomationControl,
  useResearchAutomationStatus,
} from '@/hooks/useResearchAutomation';
import { useRunSchedulerOnce, useSchedulerStatus, useUpdateScheduler } from '@/hooks/useScheduler';
import type { SchedulerJobStatus } from '@/lib/api/scheduler';
import { useWsStatus } from '@/hooks/useServerIp';
import { useTradeAnomalies } from '@/hooks/useTrades';
import type { TradeAnomaly, TradeAnomalyType } from '@/lib/api/trades';
import {
  useDefinitionPromote,
  useDefinitionPromotionState,
  useSearchRecentPromotions,
} from '@/hooks/useStrategyPromotion';
import {
  derivePromotionState,
  type DerivedPromotionState,
  type PromotionState,
  type StrategyPromotionLog,
} from '@/lib/api/strategy-promotion';
import { useSearchStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import type { StrategyDefinition } from '@/types/strategyDefinition';
import { useJvmTelemetry, useServiceHealth, type ServiceHealthMap } from '@/hooks/useTelemetry';
import { StrategyRankingTable } from '@/components/research/StrategyRankingTable';
import {
  useEnqueueSweep,
  useJournalListInfinite,
  useLeaderboard,
  useQueueList,
  useSearchRecentIterations,
  useTick,
  useWalkForwardCandidates,
} from '@/hooks/useOrchestrator';
import type {
  EnqueueSweepRequest,
  IterationVerdict,
  JournalEntryType,
  JournalStatus,
  QueueStatus,
  StatisticalVerdict,
} from '@/types/orchestrator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { formatDate } from '@/lib/formatters';
import { toneColor, type Tone } from '@/lib/tones';
import type { JvmTelemetrySnapshot, Jvm } from '@/lib/api/actuator';
import type { AccountStrategy } from '@/types/strategy';
import { RunningNowStrip } from '@/components/research/RunningNowStrip';
import { SUPPORTED_SYMBOLS, DEFAULT_SYMBOL } from '@/lib/symbols';

/**
 * /research dashboard — single admin-only page consolidating ops + research.
 *
 * Seven panels: service health, JVM telemetry per JVM, sweep activity,
 * promotion candidates with promote/demote dialog, recent promotions feed,
 * IP-monitor heartbeat (proxies for scheduler liveness today), and the
 * research log tail. Telemetry polls every 5s; everything else 30s.
 *
 * Admin-only because every backend endpoint behind it is hasRole(ADMIN).
 * Non-admins fall through to a permission-denied state instead of the
 * panels rendering as empty boxes from 403 responses.
 */
export default function ResearchDashboardPage() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const tick = useTick();
  const [enqueueOpen, setEnqueueOpen] = useState(false);

  if (!isAdmin) {
    return (
      <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-8 text-center">
        <ShieldCheck size={28} className="mx-auto text-text-muted" />
        <h1 className="font-display text-[20px] font-semibold tracking-tight text-text-primary">
          Admin only
        </h1>
        <p className="text-[13px] text-text-muted">
          The research dashboard surfaces internal JVM state and promotion controls. Sign in with an
          admin account to view it.
        </p>
      </div>
    );
  }

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['actuator'] });
    queryClient.invalidateQueries({ queryKey: ['strategy-promotion'] });
    queryClient.invalidateQueries({ queryKey: ['research'] });
    queryClient.invalidateQueries({ queryKey: ['strategies'] });
  };

  const handleTick = () => {
    tick.mutate(undefined, {
      onSuccess: (iter) => {
        toast.show({
          title: `Tick complete · ${iter.strategy_code} #${iter.iteration_number}`,
          description: `verdict=${iter.verdict ?? '—'} · stat=${iter.statistical_verdict ?? '—'}`,
          variant: iter.verdict === 'PASS' ? 'success' : 'default',
        });
      },
      onError: (err) => toast.error({ title: 'Tick failed', description: normalizeError(err) }),
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · OPS</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Research dashboard
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            Live JVM telemetry, sweep activity, and the strategy promotion pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnqueueOpen(true)}
            className="border-bd-default inline-flex items-center gap-1.5 rounded-sm border bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
            title="Enqueue a research sweep on the orchestrator"
          >
            <Plus size={12} /> Enqueue
          </button>
          <button
            type="button"
            onClick={handleTick}
            disabled={tick.isPending}
            className="border-bd-default bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            title="POST /tick — runs one iteration synchronously (up to ~30 min)"
          >
            {tick.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {tick.isPending ? 'Tick running…' : 'Tick now'}
          </button>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <Link
            href="/research/sweeps"
            className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Sweeps <ChevronRight size={12} />
          </Link>
          <Link
            href="/research/log"
            className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Log <ChevronRight size={12} />
          </Link>
        </div>
      </header>

      <RunningNowStrip />

      <ServiceHealthPanel />
      <WsHeartbeatPanel />
      <KillSwitchPanel />
      <StuckTradesPanel />
      <ResearchAutomationPanel />
      <div className="grid gap-3 lg:grid-cols-2">
        <JvmTelemetryPanel />
      </div>
      <SchedulerPanel />
      <div className="grid gap-3 lg:grid-cols-2">
        <SweepActivityPanel />
        <RecentPromotionsPanel />
      </div>
      <PromotionCandidatesPanel />
      <div className="grid gap-3 lg:grid-cols-2">
        <LeaderboardPanel />
        <RecentIterationsPanel />
      </div>
      <StrategyRankingTable />
      <WalkForwardCandidatesPanel />
      <QueuePanel />
      <JournalPanel />
      <ResearchLogPanel />
      <EnqueueSweepDialog open={enqueueOpen} onClose={() => setEnqueueOpen(false)} />
    </div>
  );
}

function ServiceHealthPanel() {
  const health = useServiceHealth();
  const refreshing = health.trading.refreshing || health.research.refreshing;
  return (
    <PanelShell
      icon={<Server size={14} />}
      title="Service health"
      sub="Trading + research JVMs · /actuator/health · 30 s poll"
      headerSlot={refreshing ? <RefreshingPill /> : null}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <HealthCard jvm="trading" port={8080} health={health} />
        <HealthCard jvm="research" port={8081} health={health} />
      </div>
    </PanelShell>
  );
}

function HealthCard({ jvm, port, health }: { jvm: Jvm; port: number; health: ServiceHealthMap }) {
  const entry = health[jvm];
  const tone =
    entry.status === 'UP'
      ? 'profit'
      : entry.status === 'DOWN' || entry.status === 'UNREACHABLE'
        ? 'loss'
        : 'warning';
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-base p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
            {jvm} JVM
          </span>
        </div>
        <span className="font-mono text-[10px] text-text-muted">:{port}</span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="font-mono text-[14px] font-semibold" style={{ color: toneColor(tone) }}>
          {entry.pending ? '—' : entry.status}
        </span>
        <span className="font-mono text-[10px] text-text-muted">
          {entry.lastSeen ? formatDate(entry.lastSeen) : 'never'}
        </span>
      </div>
      {jvm === 'research' && <ResearchLifecycleControls status={entry.status} />}
    </div>
  );
}

function ResearchLifecycleControls({ status }: { status: ServiceHealthMap['research']['status'] }) {
  const { start, restart } = useResearchControl();
  const isUp = status === 'UP';
  const busy = start.isPending || restart.isPending;

  const handleStart = () => {
    start.mutate(undefined, {
      onSuccess: (result) =>
        toast.show({
          title: `Research: ${result.state}`,
          description: result.message,
          variant: result.healthy ? 'success' : 'warning',
        }),
      onError: (err) => toast.error({ title: 'Start failed', description: normalizeError(err) }),
    });
  };
  const handleRestart = () => {
    restart.mutate(undefined, {
      onSuccess: (result) =>
        toast.show({
          title: `Research: ${result.state}`,
          description: result.message,
          variant: result.healthy ? 'success' : 'warning',
        }),
      onError: (err) => toast.error({ title: 'Restart failed', description: normalizeError(err) }),
    });
  };

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-bd-subtle pt-3">
      <button
        type="button"
        onClick={handleStart}
        disabled={busy || isUp}
        className="border-bd-default inline-flex items-center gap-1 rounded border bg-bg-base px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        title={isUp ? 'Research JVM already running' : 'Spawn research JVM via launcher script'}
      >
        {start.isPending ? <Loader2 size={11} className="animate-spin" /> : <CircleDot size={11} />}
        Start
      </button>
      <button
        type="button"
        onClick={handleRestart}
        disabled={busy || !isUp}
        className="border-bd-default inline-flex items-center gap-1 rounded border bg-bg-base px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        title={isUp ? 'Stop via /actuator/shutdown then re-spawn' : 'Research JVM is not running'}
      >
        {restart.isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <RefreshCw size={11} />
        )}
        Restart
      </button>
    </div>
  );
}

function ResearchAutomationPanel() {
  const { data, isLoading, isError } = useResearchAutomationStatus();
  const { pause, resume } = useResearchAutomationControl();
  const [reason, setReason] = useState('');

  const paused = data?.paused ?? false;
  const busy = pause.isPending || resume.isPending;

  const handlePause = () => {
    pause.mutate(reason.trim() || undefined, {
      onSuccess: (status) => {
        setReason('');
        toast.show({
          title: 'Research paused',
          description: status.reason
            ? `Reason: ${status.reason}`
            : 'Tick loop will skip the next cron window.',
          variant: 'warning',
        });
      },
      onError: (err) => toast.error({ title: 'Pause failed', description: normalizeError(err) }),
    });
  };

  const handleResume = () => {
    resume.mutate(undefined, {
      onSuccess: () =>
        toast.show({
          title: 'Research resumed',
          description: 'Tick loop will claim work on the next cron window.',
          variant: 'success',
        }),
      onError: (err) => toast.error({ title: 'Resume failed', description: normalizeError(err) }),
    });
  };

  return (
    <PanelShell
      icon={paused ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
      title="Research automation"
      sub="Global pause flag · OS-cron tick · 30 s poll"
    >
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : isError || !data ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          Automation status endpoint unreachable.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-bd-subtle bg-bg-base px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Dot tone={paused ? 'warning' : 'profit'} />
              <span
                className="font-mono text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: toneColor(paused ? 'warning' : 'profit') }}
              >
                {paused ? 'Paused' : 'Running'}
              </span>
            </div>
            {paused && data.reason && (
              <span className="text-[11px] text-text-secondary">
                Reason: <span className="font-mono">{data.reason}</span>
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-text-muted">
              Updated {data.updatedAt ? formatDate(Date.parse(data.updatedAt)) : '—'}
            </span>
          </div>
          {!paused && (
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Pause reason (optional, written to audit log)"
              disabled={busy}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-60"
            />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePause}
              disabled={busy || paused}
              className="border-bd-default inline-flex items-center gap-1.5 rounded-sm border bg-bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              title={paused ? 'Already paused' : 'Set pause flag — next cron tick will skip'}
            >
              {pause.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PauseCircle size={11} />
              )}
              Pause
            </button>
            <button
              type="button"
              onClick={handleResume}
              disabled={busy || !paused}
              className="border-bd-default inline-flex items-center gap-1.5 rounded-sm border bg-bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              title={
                paused ? 'Clear pause flag — next cron tick will claim work' : 'Already running'
              }
            >
              {resume.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PlayCircle size={11} />
              )}
              Resume
            </button>
            <span className="ml-auto text-[10px] text-text-muted">
              Takes effect on the next 30-min cron window.
            </span>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function KillSwitchPanel() {
  const { data: strategies = [], isLoading } = useStrategies();
  const tripped = useMemo(() => strategies.filter((s) => s.isKillSwitchTripped), [strategies]);

  if (isLoading || tripped.length === 0) return null;

  return (
    <PanelShell
      icon={<ShieldAlert size={14} />}
      title="Kill-switch tripped"
      sub={`${tripped.length} strateg${tripped.length === 1 ? 'y' : 'ies'} blocked from new entries · admin re-arm required`}
    >
      <ul className="space-y-1.5">
        {tripped.map((s) => (
          <KillSwitchRow key={s.id} strategy={s} />
        ))}
      </ul>
    </PanelShell>
  );
}

function KillSwitchRow({ strategy }: { strategy: AccountStrategy }) {
  const rearm = useRearmKillSwitch();
  const handleRearm = () => {
    rearm.mutate(strategy.id, {
      onSuccess: () =>
        toast.show({
          title: `Re-armed ${strategy.strategyCode}`,
          description: 'New entries will resume on the next signal.',
          variant: 'success',
        }),
      onError: (err) => toast.error({ title: 'Re-arm failed', description: normalizeError(err) }),
    });
  };

  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'rgba(229,72,77,0.32)',
        background: 'rgba(229,72,77,0.06)',
      }}
    >
      <Dot tone="loss" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[12px] font-semibold text-text-primary">
            {strategy.strategyCode}
          </span>
          <span className="font-mono text-[11px] text-text-secondary">
            {strategy.symbol} · {strategy.interval}
          </span>
          <span className="font-mono text-[10px] text-text-muted">{strategy.presetName}</span>
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">
          {strategy.killSwitchReason ?? 'No reason recorded.'}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-text-muted">
          Tripped{' '}
          {strategy.killSwitchTrippedAt
            ? formatDate(Date.parse(strategy.killSwitchTrippedAt))
            : '—'}
        </div>
      </div>
      <button
        type="button"
        onClick={handleRearm}
        disabled={rearm.isPending}
        className="border-bd-default inline-flex items-center gap-1.5 rounded-sm border bg-bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        title="Clear the trip flag — strategy resumes on the next signal"
      >
        {rearm.isPending && rearm.variables === strategy.id ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <ShieldCheck size={11} />
        )}
        Re-arm
      </button>
    </li>
  );
}

function StuckTradesPanel() {
  const { data: anomalies = [], isLoading } = useTradeAnomalies();

  if (isLoading || anomalies.length === 0) return null;

  return (
    <PanelShell
      icon={<Wrench size={14} />}
      title="Stuck trades"
      sub={`${anomalies.length} parent trade${anomalies.length === 1 ? '' : 's'} inconsistent with child legs · 30 s poll`}
    >
      <ul className="space-y-1.5">
        {anomalies.map((a) => (
          <StuckTradeRow key={a.tradeId} anomaly={a} />
        ))}
      </ul>
    </PanelShell>
  );
}

const ANOMALY_HINTS: Record<TradeAnomalyType, string> = {
  OPEN_NO_CHILDREN: 'Parent OPEN, zero legs recorded — entry never produced a position.',
  OPEN_NO_OPEN_CHILDREN: 'Parent still OPEN, every leg CLOSED — listener never flipped the parent.',
  PARTIAL_NO_OPEN_CHILDREN:
    'PARTIALLY_CLOSED with no OPEN legs — domain invariant says this should be CLOSED.',
};

function StuckTradeRow({ anomaly }: { anomaly: TradeAnomaly }) {
  const hint = ANOMALY_HINTS[anomaly.anomalyType] ?? anomaly.anomalyType;
  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'rgba(245,166,35,0.32)',
        background: 'rgba(245,166,35,0.06)',
      }}
    >
      <Dot tone="warning" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[12px] font-semibold text-text-primary">
            {anomaly.asset}
          </span>
          <span className="font-mono text-[11px] text-text-secondary">
            {anomaly.interval} · {anomaly.side}
          </span>
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.25)', color: toneColor('warning') }}
          >
            {anomaly.status}
          </span>
          <span className="font-mono text-[10px] text-text-muted">
            legs {anomaly.openLegs}/{anomaly.totalLegs} open
          </span>
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">{hint}</div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-text-muted">
          <span>Entered {anomaly.entryTime ? formatDate(Date.parse(anomaly.entryTime)) : '—'}</span>
          <span className="text-text-muted/60">·</span>
          <code className="text-text-muted">{anomaly.tradeId.slice(0, 8)}</code>
        </div>
      </div>
      <Link
        href={`/trades/${anomaly.tradeId}`}
        className="border-bd-default inline-flex items-center gap-1 rounded-sm border bg-bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover"
        title="Open trade detail to triage"
      >
        Inspect <ChevronRight size={11} />
      </Link>
    </li>
  );
}

/**
 * Surfaces the trading JVM's actual core function — receiving Binance kline
 * frames. /actuator/health says "the JVM is alive"; this tile says "the
 * trading data plane is alive". They diverge on connection drops, network
 * partitions, and Binance-side outages, all of which would otherwise be
 * silent until a strategy missed an entry.
 */
function WsHeartbeatPanel() {
  const { data, isLoading, isError } = useWsStatus();

  const tone: Tone = !data
    ? 'muted'
    : !data.running
      ? 'loss'
      : data.stale
        ? 'loss'
        : data.ageMs > 10_000
          ? 'warning'
          : 'profit';

  const headline = !data ? '—' : !data.running ? 'STOPPED' : data.stale ? 'STALE' : 'LIVE';

  return (
    <PanelShell
      icon={<Radio size={14} />}
      title="Binance WS heartbeat"
      sub="Trading JVM kline feed · 10 s poll"
    >
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : isError || !data ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          WS status endpoint unreachable.
        </div>
      ) : (
        <div className="rounded-md border border-bd-subtle bg-bg-base p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Dot tone={tone} />
            <span
              className="font-mono text-[14px] font-semibold uppercase tracking-wider"
              style={{ color: toneColor(tone) }}
            >
              {headline}
            </span>
            <span className="font-mono text-[11px] text-text-secondary">{data.symbol ?? '—'}</span>
            <span className="font-mono text-[10px] text-text-muted">
              {data.intervals.length > 0 ? data.intervals.join(' · ') : 'no intervals'}
            </span>
            <span className="ml-auto flex items-baseline gap-2 font-mono text-[11px]">
              <span className="text-text-muted">last frame</span>
              <span style={{ color: toneColor(tone) }}>{formatAge(data.ageMs)}</span>
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-text-muted">
            {data.lastMessageAt
              ? `at ${formatDate(Date.parse(data.lastMessageAt))}`
              : 'no frames received yet'}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1_000) return `${Math.round(ms)} ms ago`;
  const s = ms / 1_000;
  if (s < 60) return `${s.toFixed(1)} s ago`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s ago`;
}

function JvmTelemetryPanel() {
  const tele = useJvmTelemetry();
  return (
    <>
      <TelemetryCard
        jvm="trading"
        snap={tele.trading.current}
        samples={tele.trading.samples}
        refreshing={tele.trading.refreshing}
      />
      <TelemetryCard
        jvm="research"
        snap={tele.research.current}
        samples={tele.research.samples}
        refreshing={tele.research.refreshing}
      />
    </>
  );
}

function TelemetryCard({
  jvm,
  snap,
  samples,
  refreshing,
}: {
  jvm: Jvm;
  snap: JvmTelemetrySnapshot | null;
  samples: JvmTelemetrySnapshot[];
  refreshing: boolean;
}) {
  const heapPct =
    snap && snap.heapUsedBytes != null && snap.heapMaxBytes && snap.heapMaxBytes > 0
      ? (snap.heapUsedBytes / snap.heapMaxBytes) * 100
      : null;
  const heapTone =
    heapPct == null ? 'muted' : heapPct > 85 ? 'loss' : heapPct > 65 ? 'warning' : 'profit';

  return (
    <PanelShell
      icon={<Cpu size={14} />}
      title={`${jvm[0].toUpperCase()}${jvm.slice(1)} JVM telemetry`}
      sub="/actuator/metrics · 5 s poll"
      headerSlot={refreshing ? <RefreshingPill /> : null}
    >
      {!snap ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric
              icon={<HardDrive size={11} />}
              label="Heap"
              value={heapPct != null ? `${heapPct.toFixed(0)}%` : '—'}
              sub={
                snap.heapUsedBytes != null && snap.heapMaxBytes != null
                  ? `${formatBytes(snap.heapUsedBytes)} / ${formatBytes(snap.heapMaxBytes)}`
                  : '—'
              }
              tone={heapTone}
            />
            <Metric
              label="Non-heap"
              value={snap.nonHeapUsedBytes != null ? formatBytes(snap.nonHeapUsedBytes) : '—'}
              sub="metaspace + code"
            />
            <Metric
              label="GC pause p99"
              value={
                snap.gcPauseP99Seconds != null
                  ? `${(snap.gcPauseP99Seconds * 1000).toFixed(1)} ms`
                  : '—'
              }
              sub="rolling window"
            />
            <Metric
              label="Threads"
              value={snap.liveThreads != null ? String(snap.liveThreads) : '—'}
              sub="live"
            />
            <Metric
              label="Uptime"
              value={snap.uptimeSeconds != null ? formatUptime(snap.uptimeSeconds) : '—'}
              sub="since boot"
            />
            <Metric
              label="CPU"
              value={snap.processCpu != null ? `${(snap.processCpu * 100).toFixed(1)}%` : '—'}
              sub={snap.systemCpu != null ? `system ${(snap.systemCpu * 100).toFixed(0)}%` : ''}
            />
          </div>
          <Sparkline samples={samples} />
        </div>
      )}
    </PanelShell>
  );
}

function Sparkline({ samples }: { samples: JvmTelemetrySnapshot[] }) {
  if (samples.length < 2) {
    return (
      <div className="bg-bg-base/40 flex h-10 items-center justify-center rounded-sm text-[10px] text-text-muted">
        Heap sparkline — collecting samples…
      </div>
    );
  }
  const W = 320;
  const H = 32;
  const pts = samples
    .map((s) =>
      s.heapUsedBytes != null && s.heapMaxBytes && s.heapMaxBytes > 0
        ? s.heapUsedBytes / s.heapMaxBytes
        : null,
    )
    .map((v) => (v == null ? null : Math.max(0, Math.min(1, v))));
  const max = pts.reduce<number>((acc, v) => (v != null && v > acc ? v : acc), 0);
  const min = pts.reduce<number>((acc, v) => (v != null && v < acc ? v : acc), 1);
  const span = Math.max(0.001, max - min);
  const stepX = W / Math.max(1, pts.length - 1);
  const path = pts
    .map((v, i) => {
      if (v == null) return null;
      const x = i * stepX;
      const y = H - ((v - min) / span) * H;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
  return (
    <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-text-muted">
        <span>Heap % · last 5 min</span>
        <span className="font-mono">
          {(min * 100).toFixed(0)}% – {(max * 100).toFixed(0)}%
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <path
          d={path}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function SchedulerPanel() {
  const { data: jobs = [], isLoading, isError, isFetching } = useSchedulerStatus();
  const runOnce = useRunSchedulerOnce();
  const [editing, setEditing] = useState<SchedulerJobStatus | null>(null);

  const handleRun = (job: SchedulerJobStatus) => {
    runOnce.mutate(job.id, {
      onSuccess: () =>
        toast.success({
          title: 'Job queued',
          description: `${job.jobName} is running in the background.`,
        }),
      onError: (err) =>
        toast.error({
          title: 'Run failed',
          description: normalizeError(err),
        }),
    });
  };

  return (
    <PanelShell
      icon={<Clock size={14} />}
      title="Scheduler"
      sub="In-process jobs · 30 s poll"
      headerSlot={isFetching && !isLoading ? <RefreshingPill /> : null}
    >
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          Scheduler endpoint unreachable.
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          No scheduler jobs registered.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-bd-subtle">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-bd-subtle bg-bg-base">
                <Th>Job</Th>
                <Th>Type</Th>
                <Th>Cron</Th>
                <Th>State</Th>
                <Th>Last run</Th>
                <Th>Next run</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-bd-subtle bg-bg-surface last:border-b-0">
                  <Td className="font-mono">{j.jobName}</Td>
                  <Td className="text-text-secondary">{j.jobType}</Td>
                  <Td className="font-mono text-text-muted">{j.cronExpression}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Dot tone={j.scheduled ? 'profit' : 'muted'} />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                        {j.scheduled ? 'scheduled' : 'idle'}
                      </span>
                    </div>
                  </Td>
                  <Td className="font-mono text-text-secondary">
                    {j.lastRunAt ? formatDate(Date.parse(j.lastRunAt)) : '—'}
                  </Td>
                  <Td className="font-mono text-text-secondary">
                    {j.nextRunAt ? formatDate(Date.parse(j.nextRunAt)) : '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleRun(j)}
                        disabled={runOnce.isPending}
                        title="Run now"
                        className="rounded-sm border border-bd-subtle bg-bg-base px-1.5 py-1 text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(j)}
                        title="Edit cron / status"
                        className="rounded-sm border border-bd-subtle bg-bg-base px-1.5 py-1 text-text-secondary hover:bg-bg-hover"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <SchedulerEditDialog job={editing} onClose={() => setEditing(null)} />}
    </PanelShell>
  );
}

function SchedulerEditDialog({ job, onClose }: { job: SchedulerJobStatus; onClose: () => void }) {
  const [cronExpression, setCronExpression] = useState(job.cronExpression);
  const [status, setStatus] = useState<'0' | '1'>(job.status === '1' ? '1' : '0');
  const update = useUpdateScheduler();

  const cronChanged = cronExpression.trim() !== job.cronExpression;
  const statusChanged = status !== job.status;
  const dirty = cronChanged || statusChanged;

  const submit = () => {
    if (!dirty) return;
    update.mutate(
      {
        id: job.id,
        patch: {
          ...(cronChanged ? { cronExpression: cronExpression.trim() } : {}),
          ...(statusChanged ? { status } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success({
            title: 'Scheduler updated',
            description: `${job.jobName} reconciled.`,
          });
          onClose();
        },
        onError: (err) =>
          toast.error({
            title: 'Update failed',
            description: normalizeError(err),
          }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit scheduler · {job.jobName}</DialogTitle>
          <DialogDescription>
            {job.jobType} · changes take effect immediately (in-process schedule reconciles on
            save).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="scheduler-cron">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Cron expression
              </span>
              <input
                id="scheduler-cron"
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </label>
            <p className="mt-1 font-mono text-[10px] text-text-muted">
              Spring 6-field: <code>sec min hr day mon dow</code> · server validates and rejects
              malformed values.
            </p>
          </div>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Status
            </span>
            <div className="flex gap-1.5">
              {(
                [
                  ['1', 'Enabled'],
                  ['0', 'Disabled'],
                ] as const
              ).map(([val, label]) => {
                const selected = status === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatus(val)}
                    className="rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors"
                    style={{
                      borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: selected ? 'rgba(59,130,246,0.12)' : 'transparent',
                      color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || update.isPending || !cronExpression.trim()}
            className="hover:bg-[var(--accent-primary)]/90 inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {update.isPending && <Loader2 size={11} className="animate-spin" />}
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SWEEP_STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'In-flight', value: 'RUNNING,PENDING' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'All', value: '' },
];

const SWEEP_SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Newest', value: 'createdAt,desc' },
  { label: 'Oldest', value: 'createdAt,asc' },
  { label: 'Most progress', value: 'finishedCombos,desc' },
  { label: 'Largest', value: 'totalCombos,desc' },
  { label: 'Status', value: 'status,asc' },
];

const SWEEP_PAGE_SIZE = 5;

function SweepActivityPanel() {
  const [status, setStatus] = useState<string>('RUNNING,PENDING');
  const [sort, setSort] = useState<string>('createdAt,desc');
  const [page, setPage] = useState(0);

  const search = useSearchSweeps({ status, sort, page, size: SWEEP_PAGE_SIZE });
  const rows = search.data?.content ?? [];
  const totalPages = search.data?.totalPages ?? 0;
  const totalElements = search.data?.totalElements ?? 0;

  return (
    <PanelShell
      icon={<Activity size={14} />}
      title="Sweep activity"
      sub="Server-side filter + sort + paginate · 10 s poll"
      headerSlot={
        <div className="flex items-center gap-3">
          {search.isFetching && !search.isLoading && <RefreshingPill />}
          <Link
            href="/research/sweeps"
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
          >
            All →
          </Link>
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Status
        </span>
        {SWEEP_STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(0);
              }}
              aria-pressed={active}
              className="rounded-sm px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: active ? 'var(--bg-hover)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: active ? 'var(--border-default)' : 'transparent',
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span className="h-4 w-px bg-bd-subtle" />
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            aria-label="Sort sweeps by"
            className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          >
            {SWEEP_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {search.isLoading ? (
        <Skeleton className="mt-1 h-24 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 mt-1 rounded-sm border border-bd-subtle p-4 text-center">
          <Activity size={14} className="mx-auto mb-1 text-text-muted" />
          <p className="text-[11px] text-text-muted">No sweeps match this filter.</p>
        </div>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {rows.map((s) => {
            const pct =
              s.totalCombos > 0 ? Math.round((s.finishedCombos / s.totalCombos) * 100) : 0;
            const statusTone: Tone =
              s.status === 'RUNNING'
                ? 'info'
                : s.status === 'COMPLETED'
                  ? 'profit'
                  : s.status === 'FAILED' || s.status === 'CANCELLED'
                    ? 'loss'
                    : 'muted';
            return (
              <li key={s.sweepId}>
                <Link
                  href={`/research/sweeps/${s.sweepId}`}
                  className="block rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2 transition-colors hover:bg-bg-hover"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-text-secondary">
                      {s.spec.strategyCode} · {s.spec.asset} {s.spec.interval}
                    </span>
                    <span className="flex items-center gap-2">
                      <VerdictPill tone={statusTone} label={s.status} />
                      <span className="font-mono text-text-muted">
                        {s.finishedCombos}/{s.totalCombos} · {pct}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-bg-base/50 mt-1.5 h-1 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </PanelShell>
  );
}

const RECENT_PROMOTIONS_TO_STATES: { label: string; value: PromotionState | '' }[] = [
  { label: 'All', value: '' },
  { label: 'PAPER_TRADE', value: 'PAPER_TRADE' },
  { label: 'PROMOTED', value: 'PROMOTED' },
  { label: 'DEMOTED', value: 'DEMOTED' },
  { label: 'REJECTED', value: 'REJECTED' },
];

const RECENT_PROMOTIONS_PAGE_SIZE = 25;

function RecentPromotionsPanel() {
  const [strategyCode, setStrategyCode] = useState('');
  const [toState, setToState] = useState<PromotionState | ''>('');
  const [page, setPage] = useState(0);

  const [codeQuery, setCodeQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setCodeQuery(strategyCode);
      setPage(0);
    }, 250);
    return () => clearTimeout(id);
  }, [strategyCode]);

  const search = useSearchRecentPromotions({
    strategyCode: codeQuery || undefined,
    toState: toState || undefined,
    page,
    size: RECENT_PROMOTIONS_PAGE_SIZE,
  });
  const rows = search.data?.content ?? [];
  const totalPages = search.data?.totalPages ?? 0;
  const totalElements = search.data?.totalElements ?? 0;
  const [selected, setSelected] = useState<StrategyPromotionLog | null>(null);
  const filtersActive = Boolean(codeQuery || toState);

  return (
    <PanelShell
      icon={<TrendingUp size={14} />}
      title="Recent promotions"
      sub="Filterable feed across every strategy · click for detail · 30 s poll"
      headerSlot={search.isFetching && !search.isLoading ? <RefreshingPill /> : null}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label
          htmlFor="recent-strategy-filter"
          className="flex items-center gap-1.5 text-[11px] text-text-secondary"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Strategy
          </span>
          <input
            id="recent-strategy-filter"
            type="text"
            value={strategyCode}
            placeholder="e.g. LSR"
            onChange={(e) => setStrategyCode(e.target.value)}
            aria-label="Filter recent promotions by strategy code"
            className="w-24 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </label>
        <span className="h-4 w-px bg-bd-subtle" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          To state
        </span>
        {RECENT_PROMOTIONS_TO_STATES.map((s) => {
          const active = toState === s.value;
          return (
            <button
              key={s.value || 'all'}
              type="button"
              onClick={() => {
                setToState(s.value);
                setPage(0);
              }}
              aria-pressed={active}
              className="rounded-sm px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: active ? 'var(--bg-hover)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: active ? 'var(--border-default)' : 'transparent',
              }}
            >
              {s.label}
            </button>
          );
        })}
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setStrategyCode('');
              setToState('');
              setPage(0);
            }}
            className="ml-1 rounded-sm border border-bd-subtle px-2 py-0.5 text-[10px] text-text-secondary hover:bg-bg-hover"
          >
            Clear
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {search.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 flex items-center justify-center gap-1.5 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          <CircleDot size={12} />
          {filtersActive
            ? 'No promotions match the current filters.'
            : 'No promotions recorded yet.'}
        </div>
      ) : (
        <ul className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li key={r.promotionId}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="block w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-bg-hover focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-text-secondary">{r.strategyCode}</span>
                  <span className="font-mono text-[10px] text-text-muted">
                    {formatDate(Date.parse(r.createdTime))}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <StateBadge state={r.fromState} />
                  <ChevronRight size={10} className="text-text-muted" />
                  <StateBadge state={r.toState} />
                  <span className="ml-auto truncate text-text-muted">{r.reason}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
      {selected && <PromotionDetailDialog row={selected} onClose={() => setSelected(null)} />}
    </PanelShell>
  );
}

function PromotionDetailDialog({
  row,
  onClose,
}: {
  row: StrategyPromotionLog;
  onClose: () => void;
}) {
  const evidenceText = useMemo(() => {
    if (row.evidence == null) return null;
    if (typeof row.evidence === 'string') return row.evidence;
    try {
      return JSON.stringify(row.evidence, null, 2);
    } catch {
      return String(row.evidence);
    }
  }, [row.evidence]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promotion · {row.strategyCode}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 pt-1">
            <StateBadge state={row.fromState} />
            <ChevronRight size={12} className="text-text-muted" />
            <StateBadge state={row.toState} />
            <span className="ml-2 font-mono text-[11px] text-text-muted">
              {formatDate(Date.parse(row.createdTime))}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[12px]">
          <DetailRow label="Reason">
            <p className="whitespace-pre-wrap text-text-primary">{row.reason || '—'}</p>
          </DetailRow>
          {row.accountStrategyId ? (
            <DetailRow label="Account strategy">
              <code className="font-mono text-[11px] text-text-secondary">
                {row.accountStrategyId}
              </code>
            </DetailRow>
          ) : (
            <DetailRow label="Strategy definition">
              <code className="font-mono text-[11px] text-text-secondary">
                {row.strategyDefinitionId ?? row.strategyCode}
              </code>
            </DetailRow>
          )}
          <DetailRow label="Reviewer">
            <code className="font-mono text-[11px] text-text-secondary">
              {row.reviewerUserId ?? '— (system)'}
            </code>
          </DetailRow>
          <DetailRow label="Promotion ID">
            <code className="font-mono text-[11px] text-text-secondary">{row.promotionId}</code>
          </DetailRow>
          <DetailRow label="Evidence">
            {evidenceText ? (
              <pre className="max-h-[220px] overflow-auto rounded-sm border border-bd-subtle bg-bg-base p-2 font-mono text-[11px] text-text-primary">
                {evidenceText}
              </pre>
            ) : (
              <span className="text-text-muted">No evidence attached.</span>
            )}
          </DetailRow>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

const PROMOTION_CANDIDATES_PAGE_SIZE = 25;

const PROMOTION_SORT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'strategyCode', label: 'Strategy' },
  { key: 'strategyType', label: 'Type' },
  { key: 'archetype', label: 'Archetype' },
];

const STATE_TONE: Record<DerivedPromotionState, Tone> = {
  PROMOTED: 'profit',
  PAPER_TRADE: 'info',
  INACTIVE: 'muted',
};

function PromotionCandidatesPanel() {
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState('strategyCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const search = useSearchStrategyDefinitions({
    query: debouncedQuery || undefined,
    sort: `${sortField},${sortDir}`,
    page,
    size: PROMOTION_CANDIDATES_PAGE_SIZE,
  });
  const rows = useMemo(() => search.data?.content ?? [], [search.data?.content]);
  const totalPages = search.data?.totalPages ?? 0;
  const totalElements = search.data?.totalElements ?? 0;
  const filtersActive = Boolean(debouncedQuery);

  const [target, setTarget] = useState<StrategyDefinition | null>(null);
  const [targetIsDeepLinked, setTargetIsDeepLinked] = useState(false);

  const [pendingTargetCode, setPendingTargetCode] = useState<string | null>(null);
  const deepLinkParsedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (deepLinkParsedRef.current) return;
    deepLinkParsedRef.current = true;
    const hash = window.location.hash;
    if (!hash) return;
    const m = hash.match(/^#promote-(.+)$/);
    if (!m) return;
    let code: string;
    try {
      code = decodeURIComponent(m[1]);
    } catch {
      return;
    }
    setQuery(code);
    setDebouncedQuery(code);
    setPage(0);
    setPendingTargetCode(code);
  }, []);

  useEffect(() => {
    if (!pendingTargetCode) return;
    if (debouncedQuery !== pendingTargetCode) return;
    if (search.isFetching) return;
    const def = rows.find((d) => d.strategyCode === pendingTargetCode);
    if (def) {
      setTarget(def);
      setTargetIsDeepLinked(true);
    }
    setPendingTargetCode(null);
  }, [rows, debouncedQuery, pendingTargetCode, search.isFetching]);

  const closeTarget = () => {
    const wasDeepLinked = targetIsDeepLinked;
    setTarget(null);
    setTargetIsDeepLinked(false);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#promote-')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (wasDeepLinked) {
      setQuery('');
      setDebouncedQuery('');
      setPage(0);
    }
  };

  const onSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <PanelShell
      icon={<Sparkles size={14} />}
      title="Promotion candidates"
      sub="One row per strategy. Promote / demote / reject applies to every account."
      headerSlot={search.isFetching && !search.isLoading ? <RefreshingPill /> : null}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Search
          </span>
          <input
            type="text"
            value={query}
            placeholder="strategy code or name"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter promotion candidates by strategy code or name"
            className="w-48 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-sm border border-bd-subtle px-2 py-0.5 text-[10px] text-text-secondary hover:bg-bg-hover"
          >
            Clear
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {search.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-6 text-center">
          <Sparkles size={16} className="mx-auto mb-2 text-text-muted" />
          <p className="text-[11px] text-text-muted">
            {filtersActive
              ? 'No definitions match the current filter.'
              : 'No active strategy definitions. Seed one via the research orchestrator or POST '}
            {!filtersActive && <code className="font-mono">/api/v1/strategy-definitions</code>}
            {!filtersActive && '.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-bd-subtle">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-bd-subtle bg-bg-base">
                {PROMOTION_SORT_FIELDS.map((f) => (
                  <SortableTh
                    key={f.key}
                    label={f.label}
                    field={f.key}
                    activeField={sortField}
                    dir={sortDir}
                    onSort={onSort}
                  />
                ))}
                <Th>State</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const state = derivePromotionState(Boolean(d.enabled), Boolean(d.simulated));
                return (
                  <tr
                    key={d.id}
                    className="border-b border-bd-subtle bg-bg-surface last:border-b-0 hover:bg-bg-hover"
                  >
                    <Td className="font-mono">
                      <div className="flex flex-col">
                        <span>{d.strategyCode}</span>
                        <span className="text-[10px] text-text-muted">{d.strategyName}</span>
                      </div>
                    </Td>
                    <Td className="text-text-secondary">{d.strategyType}</Td>
                    <Td className="font-mono text-text-muted">
                      {d.archetype ?? '—'}
                      {d.archetypeVersion != null && (
                        <span className="ml-1 text-text-muted">v{d.archetypeVersion}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Dot tone={STATE_TONE[state]} />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                          {state.replace('_', ' ')}
                        </span>
                      </span>
                    </Td>
                    <Td align="right">
                      <button
                        type="button"
                        onClick={() => {
                          setTarget(d);
                          setTargetIsDeepLinked(false);
                        }}
                        aria-label={`Manage promotion for ${d.strategyCode}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] transition-colors hover:border-[var(--accent-primary)] hover:bg-[rgba(59,130,246,0.08)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
                      >
                        Manage →
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
      {target && <PromoteDialog target={target} onClose={closeTarget} />}
    </PanelShell>
  );
}

function SortableTh({
  label,
  field,
  activeField,
  dir,
  onSort,
}: {
  label: string;
  field: string;
  activeField: string;
  dir: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const active = activeField === field;
  return (
    <th
      className="px-2 py-1.5 text-left"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
        style={{ color: active ? 'var(--text-secondary)' : undefined }}
      >
        {label}
        {active && <span aria-hidden="true">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

const LEGAL_NEXT_STATES: Record<PromotionState, PromotionState[]> = {
  RESEARCH: ['PAPER_TRADE'],
  PAPER_TRADE: ['PROMOTED', 'REJECTED'],
  PROMOTED: ['DEMOTED', 'PAPER_TRADE'],
  DEMOTED: ['PAPER_TRADE'],
  REJECTED: ['PAPER_TRADE'],
};

const ALL_TARGETS: PromotionState[] = ['PAPER_TRADE', 'PROMOTED', 'DEMOTED', 'REJECTED'];

function PromoteDialog({ target, onClose }: { target: StrategyDefinition; onClose: () => void }) {
  const promote = useDefinitionPromote();

  const stateQuery = useDefinitionPromotionState(target.strategyCode);
  const fallbackState = derivePromotionState(Boolean(target.enabled), Boolean(target.simulated));
  const currentState: PromotionState =
    stateQuery.data ?? (fallbackState === 'INACTIVE' ? 'RESEARCH' : fallbackState);
  const legalTargets = useMemo(() => LEGAL_NEXT_STATES[currentState] ?? [], [currentState]);
  const [toState, setToState] = useState<PromotionState>(legalTargets[0] ?? 'PAPER_TRADE');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');

  const evidenceParse = useMemo<{
    parsed: unknown;
    error: string | null;
  }>(() => {
    if (!evidence.trim()) return { parsed: undefined, error: null };
    try {
      return { parsed: JSON.parse(evidence), error: null };
    } catch (e) {
      return { parsed: undefined, error: (e as Error).message };
    }
  }, [evidence]);

  const reasonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    reasonInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (legalTargets.length === 0) return;
    if (!legalTargets.includes(toState)) setToState(legalTargets[0]);
  }, [legalTargets, toState]);

  const submit = async () => {
    if (!reason.trim()) {
      toast.warning({
        title: 'Reason required',
        description: 'Promotions need a written reason for the audit log.',
      });
      reasonInputRef.current?.focus();
      return;
    }
    if (evidenceParse.error) {
      toast.warning({ title: 'Evidence must be JSON', description: evidenceParse.error });
      return;
    }
    try {
      await promote.mutateAsync({
        strategyCode: target.strategyCode,
        toState,
        reason: reason.trim(),
        evidence: evidenceParse.parsed,
      });
      toast.success({
        title: `Promoted to ${toState}`,
        description: `${target.strategyCode} updated.`,
      });
      onClose();
    } catch (err) {
      toast.error({ title: 'Promotion failed', description: normalizeError(err) });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage promotion · {target.strategyCode}</DialogTitle>
          <DialogDescription>
            {target.strategyName} · {target.strategyType}
            {target.archetype && (
              <span className="ml-1 text-text-muted">
                · {target.archetype}
                {target.archetypeVersion != null && ` v${target.archetypeVersion}`}
              </span>
            )}
            <br />
            Applies globally to <strong>every account</strong> running this strategy.
            <br />
            Current state: <StateBadge state={currentState} />
            {stateQuery.isLoading && <span className="ml-1.5 text-text-muted">(resolving…)</span>}
            {' · '}illegal targets are disabled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Target state
            </span>
            <div
              className="flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="Target promotion state"
            >
              {ALL_TARGETS.map((s) => {
                const legal = legalTargets.includes(s);
                const selected = toState === s;

                const borderColor = selected
                  ? 'var(--accent-primary)'
                  : legal
                    ? 'var(--border-subtle)'
                    : 'rgba(229,72,77,0.32)';
                const background = selected ? 'rgba(59,130,246,0.12)' : 'transparent';
                const color = selected
                  ? 'var(--accent-primary)'
                  : legal
                    ? 'var(--text-secondary)'
                    : 'var(--text-muted)';
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={!legal}
                    disabled={!legal}
                    onClick={() => setToState(s)}
                    title={legal ? undefined : `Illegal transition from ${currentState}`}
                    className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      !legal ? 'line-through' : ''
                    }`}
                    style={{ borderColor, background, color }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {legalTargets.length === 0 && (
              <p className="mt-1.5 text-[10px] text-text-muted">
                No legal transitions from {currentState}.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="promote-reason">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Reason <span className="text-[var(--color-loss)]">*</span> (required for audit log)
              </span>
              <input
                id="promote-reason"
                ref={reasonInputRef}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                aria-required="true"
                placeholder="e.g. 30-day paper window cleared with Sharpe 1.4"
                className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </label>
          </div>
          <div>
            <label htmlFor="promote-evidence">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Evidence JSON (optional)
              </span>
              <textarea
                id="promote-evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={3}
                aria-invalid={Boolean(evidenceParse.error)}
                aria-describedby={evidenceParse.error ? 'promote-evidence-error' : undefined}
                placeholder='{"sweepId":"…","sharpe":1.4,"trades":42}'
                className="w-full rounded-sm border bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none"
                style={{
                  borderColor: evidenceParse.error ? 'rgba(229,72,77,0.5)' : 'var(--border-subtle)',
                }}
              />
            </label>
            {evidenceParse.error && (
              <p
                id="promote-evidence-error"
                className="mt-1 font-mono text-[10px]"
                style={{ color: 'var(--color-loss)' }}
              >
                Invalid JSON · {evidenceParse.error}
              </p>
            )}
          </div>
          {toState === 'PROMOTED' && (
            <div
              className="flex items-start gap-2 rounded-sm border px-2.5 py-2 text-[11px]"
              style={{
                borderColor: 'rgba(245,166,35,0.32)',
                background: 'rgba(245,166,35,0.08)',
                color: 'var(--color-warning)',
              }}
              role="alert"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                Sets <code>strategy_definition.simulated=false</code>. Real Binance orders fire on
                the next signal.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              promote.isPending ||
              legalTargets.length === 0 ||
              !legalTargets.includes(toState) ||
              !reason.trim() ||
              Boolean(evidenceParse.error)
            }
            title={
              !reason.trim()
                ? 'Reason is required'
                : evidenceParse.error
                  ? `Evidence JSON invalid: ${evidenceParse.error}`
                  : !legalTargets.includes(toState)
                    ? `Illegal transition from ${currentState}`
                    : undefined
            }
            className="hover:bg-[var(--accent-primary)]/90 inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {promote.isPending && <Loader2 size={11} className="animate-spin" />}
            Apply
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RESEARCH_LOG_PAGE_SIZE = 25;

function ResearchLogPanel() {
  const [strategyCode, setStrategyCode] = useState('');
  const [asset, setAsset] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [page, setPage] = useState(0);

  const [strategyQuery, setStrategyQuery] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [intervalQuery, setIntervalQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setStrategyQuery(strategyCode);
      setAssetQuery(asset);
      setIntervalQuery(intervalFilter);
      setPage(0);
    }, 250);
    return () => clearTimeout(id);
  }, [strategyCode, asset, intervalFilter]);

  const search = useSearchResearchLog({
    strategyCode: strategyQuery || undefined,
    asset: assetQuery || undefined,
    interval: intervalQuery || undefined,
    page,
    size: RESEARCH_LOG_PAGE_SIZE,
  });
  const rows = search.data?.content ?? [];
  const totalPages = search.data?.totalPages ?? 0;
  const totalElements = search.data?.totalElements ?? 0;
  const filtersActive = Boolean(strategyQuery || assetQuery || intervalQuery);

  return (
    <PanelShell
      icon={<CircleDot size={14} />}
      title="Research log"
      sub="Server-side filter + paginate · 30 s poll"
      headerSlot={
        <div className="flex items-center gap-3">
          {search.isFetching && !search.isLoading && <RefreshingPill />}
          <Link
            href="/research/log"
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
          >
            Full log →
          </Link>
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Strategy
          </span>
          <input
            type="text"
            value={strategyCode}
            placeholder="e.g. LSR"
            onChange={(e) => setStrategyCode(e.target.value)}
            aria-label="Filter research log by strategy code"
            className="w-24 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Asset
          </span>
          <input
            type="text"
            value={asset}
            placeholder="e.g. BTCUSDT, ETHUSDT"
            onChange={(e) => setAsset(e.target.value)}
            aria-label="Filter research log by asset"
            className="w-24 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Interval
          </span>
          <input
            type="text"
            value={intervalFilter}
            placeholder="1h"
            onChange={(e) => setIntervalFilter(e.target.value)}
            aria-label="Filter research log by interval"
            className="w-16 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setStrategyCode('');
              setAsset('');
              setIntervalFilter('');
            }}
            className="rounded-sm border border-bd-subtle px-2 py-0.5 text-[10px] text-text-secondary hover:bg-bg-hover"
          >
            Clear
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {search.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          <CircleDot size={14} className="mx-auto mb-1 text-text-muted" />
          {filtersActive
            ? 'No log entries match the current filters.'
            : 'No research log entries yet.'}
        </div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto rounded-md border border-bd-subtle">
          <table className="w-full min-w-[720px] text-[11px]">
            <thead className="sticky top-0 bg-bg-base">
              <tr className="border-b border-bd-subtle">
                <Th>When</Th>
                <Th>Strategy</Th>
                <Th>Symbol · Int</Th>
                <Th align="right">Trades</Th>
                <Th align="right">Win %</Th>
                <Th align="right">PF</Th>
                <Th align="right">Avg R</Th>
                <Th align="right">Net PnL</Th>
                <Th align="right">MDD</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.runId}
                  className="border-b border-bd-subtle bg-bg-surface last:border-b-0"
                >
                  <Td className="font-mono text-text-muted">
                    {r.createdAt ? formatDate(Date.parse(r.createdAt)) : '—'}
                  </Td>
                  <Td className="font-mono">
                    {r.strategyCode}
                    {r.strategyVersion && (
                      <span className="ml-1 text-text-muted">{r.strategyVersion}</span>
                    )}
                  </Td>
                  <Td className="font-mono">
                    {r.asset} <span className="text-text-muted">{r.interval}</span>
                  </Td>
                  <Td align="right" className="num">
                    {numOrDash(r.tradeCount, 0)}
                  </Td>
                  <Td align="right" className="num">
                    {pctOrDash(r.winRate * 100)}
                  </Td>
                  <Td align="right" className="num">
                    {numOrDash(r.profitFactor, 2)}
                  </Td>
                  <Td align="right" className="num">
                    {numOrDash(r.avgR, 2)}
                  </Td>
                  <Td align="right" className="num">
                    <span
                      style={{
                        color: r.netPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                      }}
                    >
                      {numOrDash(r.netPnl, 2)}
                    </span>
                  </Td>
                  <Td align="right" className="num">
                    {numOrDash(r.maxDrawdown, 2)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </PanelShell>
  );
}

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 rounded-full"
      style={{ background: toneColor(tone) }}
    />
  );
}

function RefreshingPill() {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-text-muted"
    >
      <Loader2 size={10} className="animate-spin" />
      updating…
    </span>
  );
}

const STAT_VERDICT_TONE: Record<StatisticalVerdict, Tone> = {
  SIGNIFICANT_EDGE: 'profit',
  MARGINAL: 'warning',
  NO_EDGE: 'muted',
  INSUFFICIENT_SAMPLE: 'muted',
  FAILED: 'loss',
};

const ITER_VERDICT_TONE: Record<IterationVerdict, Tone> = {
  PASS: 'profit',
  ITERATE: 'warning',
  DISCARD: 'muted',
  FAILED: 'loss',
};

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

function VerdictPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: 'rgba(0,0,0,0.25)', color: toneColor(tone) }}
    >
      {label}
    </span>
  );
}

function LeaderboardPanel() {
  const { data: rows = [], isLoading } = useLeaderboard(15);

  return (
    <PanelShell
      icon={<TrendingUp size={14} />}
      title="Iteration leaderboard"
      sub="Top 15 by PF · 30 s poll"
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          No iterations recorded yet. The orchestrator writes one row per /tick.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="text-text-muted">
              <tr className="border-b border-bd-subtle">
                <th className="py-1.5 pr-2 text-left font-normal">#</th>
                <th className="py-1.5 pr-2 text-left font-normal">Strategy</th>
                <th className="py-1.5 pr-2 text-right font-normal">PF</th>
                <th className="py-1.5 pr-2 text-right font-normal">PF 95% CI</th>
                <th className="py-1.5 pr-2 text-right font-normal">Sharpe</th>
                <th className="py-1.5 pr-2 text-right font-normal">N</th>
                <th className="py-1.5 pr-2 text-right font-normal">Ret %</th>
                <th className="py-1.5 pr-2 text-left font-normal">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const tone = r.statistical_verdict
                  ? (STAT_VERDICT_TONE[r.statistical_verdict] ?? 'muted')
                  : 'muted';
                return (
                  <tr key={r.iteration_id} className="border-bd-subtle/50 border-b last:border-b-0">
                    <td className="py-1.5 pr-2 text-text-muted">{i + 1}</td>
                    <td className="py-1.5 pr-2 text-text-secondary">{r.strategy_code}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-primary">
                      {fmtNum(r.pf)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-muted">
                      {r.pf_lo != null && r.pf_hi != null
                        ? `[${fmtNum(r.pf_lo)}, ${fmtNum(r.pf_hi)}]`
                        : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                      {fmtNum(r.sharpe)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                      {r.trade_count ?? '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                      {r.return_pct != null ? `${fmtNum(r.return_pct)}%` : '—'}
                    </td>
                    <td className="py-1.5 pr-2">
                      <VerdictPill tone={tone} label={r.statistical_verdict ?? '—'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}

const ITERATIONS_PAGE_SIZE = 20;
const ITERATION_VERDICT_FILTERS: { label: string; value: '' | IterationVerdict }[] = [
  { label: 'All', value: '' },
  { label: 'PASS', value: 'PASS' },
  { label: 'ITERATE', value: 'ITERATE' },
  { label: 'DISCARD', value: 'DISCARD' },
  { label: 'FAILED', value: 'FAILED' },
];

function RecentIterationsPanel() {
  const [strategyCode, setStrategyCode] = useState('');
  const [verdict, setVerdict] = useState<'' | IterationVerdict>('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);

  const [codeQuery, setCodeQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setCodeQuery(strategyCode);
      setCursorStack([null]);
    }, 250);
    return () => clearTimeout(id);
  }, [strategyCode]);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;
  const search = useSearchRecentIterations({
    cursor,
    strategyCode: codeQuery || undefined,
    verdict: verdict || undefined,
    limit: ITERATIONS_PAGE_SIZE,
  });
  const rows = search.data?.items ?? [];
  const nextCursor = search.data?.next_cursor ?? null;
  const filtersActive = Boolean(codeQuery || verdict);

  const onNext = () => {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, nextCursor]);
  };
  const onPrev = () => {
    setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  return (
    <PanelShell
      icon={<Sparkles size={14} />}
      title="Recent iterations"
      sub="Cursor-paginated · 30 s poll"
      headerSlot={search.isFetching && !search.isLoading ? <RefreshingPill /> : null}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Strategy
          </span>
          <input
            type="text"
            value={strategyCode}
            placeholder="e.g. LSR"
            onChange={(e) => setStrategyCode(e.target.value)}
            aria-label="Filter iterations by strategy code"
            className="w-24 rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary"
          />
        </div>
        <span className="h-4 w-px bg-bd-subtle" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Verdict
        </span>
        {ITERATION_VERDICT_FILTERS.map((v) => {
          const active = verdict === v.value;
          return (
            <button
              key={v.value || 'all'}
              type="button"
              onClick={() => {
                setVerdict(v.value);
                setCursorStack([null]);
              }}
              aria-pressed={active}
              className="rounded-sm px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: active ? 'var(--bg-hover)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: active ? 'var(--border-default)' : 'transparent',
              }}
            >
              {v.label}
            </button>
          );
        })}
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setStrategyCode('');
              setVerdict('');
              setCursorStack([null]);
            }}
            className="ml-1 rounded-sm border border-bd-subtle px-2 py-0.5 text-[10px] text-text-secondary hover:bg-bg-hover"
          >
            Clear
          </button>
        )}
      </div>
      {search.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          {filtersActive
            ? 'No iterations match the current filters.'
            : 'No tick has completed yet. Run /tick via the agent.'}
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const verdictTone = r.verdict ? (ITER_VERDICT_TONE[r.verdict] ?? 'muted') : 'muted';
            const statTone = r.statistical_verdict
              ? (STAT_VERDICT_TONE[r.statistical_verdict] ?? 'muted')
              : 'muted';
            type IterMetrics = {
              profit_factor?: number;
              trade_count?: number;
              annualized_geometric_return_pct_at_alloc_90?: number;
              capital_utilization_pct?: number;
              deployed_days?: number;
            };
            const m = r.metrics_snapshot as IterMetrics | null;
            const pf = m?.profit_factor;
            const trades = m?.trade_count;
            const annGeom = m?.annualized_geometric_return_pct_at_alloc_90 ?? null;
            const utilPct = m?.capital_utilization_pct ?? null;
            return (
              <li
                key={r.iteration_id}
                className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-text-secondary">
                    {r.strategy_code} <span className="text-text-muted">#{r.iteration_number}</span>
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">
                    {fmtAgo(r.created_time)} ago
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <VerdictPill tone={verdictTone} label={r.verdict ?? '—'} />
                  <VerdictPill tone={statTone} label={r.statistical_verdict ?? '—'} />
                  <span className="font-mono text-text-muted">
                    PF {fmtNum(pf ?? null)} · n={trades ?? '—'}
                  </span>
                  {annGeom != null && (
                    <span
                      className="font-mono"
                      style={{ color: annGeom >= 10 ? 'var(--color-profit)' : annGeom >= 0 ? 'var(--text-secondary)' : 'var(--color-loss)' }}
                      title={utilPct != null ? `Deployed ${utilPct.toFixed(1)}% of window` : undefined}
                    >
                      {annGeom >= 0 ? '+' : ''}{annGeom.toFixed(1)}%/yr
                      {utilPct != null && (
                        <span className="text-text-muted"> @{utilPct.toFixed(0)}%</span>
                      )}
                    </span>
                  )}
                </div>
                {r.hypothesis_predicted && (
                  <div className="mt-1 truncate font-mono text-[10px] text-text-muted">
                    {r.hypothesis_predicted}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(cursorStack.length > 1 || nextCursor) && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={cursorStack.length <= 1}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-text-muted">Page {cursorStack.length}</span>
          <button
            type="button"
            onClick={onNext}
            disabled={!nextCursor}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </PanelShell>
  );
}

function WalkForwardCandidatesPanel() {
  const { data: rows = [], isLoading } = useWalkForwardCandidates();

  return (
    <PanelShell
      icon={<Clock size={14} />}
      title="Walk-forward candidates"
      sub="PARKED · SIGNIFICANT_EDGE · awaiting validation"
    >
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          No queued candidates. Sweeps that hit SIGNIFICANT_EDGE land here for{' '}
          <code className="font-mono">POST /walk-forward</code>.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.queue_id}
              className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-text-secondary">
                  {r.strategy_code} · {r.instrument} {r.interval_name}
                </span>
                <VerdictPill tone="profit" label={String(r.final_verdict ?? 'SIGNIFICANT_EDGE')} />
              </div>
              <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-text-muted">
                <span>queue {r.queue_id.slice(0, 8)}</span>
                {r.completed_at && <span>parked {fmtAgo(r.completed_at)} ago</span>}
                <span>
                  iter {r.iteration_number ?? '—'}/{r.iter_budget ?? '—'}
                </span>
              </div>
              {r.hypothesis && (
                <div className="mt-1 truncate font-mono text-[10px] text-text-muted">
                  {r.hypothesis}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

const QUEUE_STATUS_TONE: Record<QueueStatus, Tone> = {
  PENDING: 'muted',
  RUNNING: 'info',
  PARKED: 'warning',
  COMPLETED: 'profit',
  FAILED: 'loss',
};

const QUEUE_FILTERS: Array<QueueStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'RUNNING',
  'PARKED',
  'COMPLETED',
  'FAILED',
];

function QueuePanel() {
  const [filter, setFilter] = useState<QueueStatus | 'ALL'>('ALL');
  const status = filter === 'ALL' ? undefined : filter;
  const { data: rows = [], isLoading } = useQueueList(status, 50);

  return (
    <PanelShell
      icon={<ListChecks size={14} />}
      title="Research queue"
      sub="All statuses · 15 s poll"
      headerSlot={
        <div className="flex flex-wrap items-center gap-1">
          {QUEUE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                filter === f
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          No queue rows{filter !== 'ALL' ? ` with status=${filter}` : ''}. Use{' '}
          <code className="font-mono">Enqueue</code> to add a sweep.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="text-text-muted">
              <tr className="border-b border-bd-subtle">
                <th className="py-1.5 pr-2 text-left font-normal">Status</th>
                <th className="py-1.5 pr-2 text-left font-normal">Strategy</th>
                <th className="py-1.5 pr-2 text-left font-normal">Inst · Interval</th>
                <th className="py-1.5 pr-2 text-right font-normal">Iter</th>
                <th className="py-1.5 pr-2 text-right font-normal">Pri</th>
                <th className="py-1.5 pr-2 text-left font-normal">Verdict</th>
                <th className="py-1.5 pr-2 text-left font-normal">Age</th>
                <th className="py-1.5 pr-2 text-left font-normal">Hypothesis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tone = QUEUE_STATUS_TONE[r.status] ?? 'muted';
                return (
                  <tr
                    key={r.queue_id}
                    className="border-bd-subtle/50 border-b align-top last:border-b-0"
                  >
                    <td className="py-1.5 pr-2">
                      <VerdictPill tone={tone} label={r.status} />
                    </td>
                    <td className="py-1.5 pr-2 text-text-secondary">{r.strategy_code}</td>
                    <td className="py-1.5 pr-2 text-text-muted">
                      {r.instrument} · {r.interval_name}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                      {r.iteration_number ?? 0}/{r.iter_budget ?? '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-text-muted">
                      {r.priority}
                    </td>
                    <td className="py-1.5 pr-2 text-text-muted">{r.final_verdict ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-text-muted">{fmtAgo(r.created_time)}</td>
                    <td
                      className="max-w-[280px] truncate py-1.5 pr-2 text-text-muted"
                      title={r.hypothesis ?? ''}
                    >
                      {r.hypothesis ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}

const JOURNAL_TYPES: Array<JournalEntryType | 'ALL'> = [
  'ALL',
  'HYPOTHESIS',
  'STRATEGY_OUTCOME',
  'RUN_SUMMARY',
  'ANTI_PATTERN',
  'CROSS_STRATEGY_FINDING',
  'IDEA_BACKLOG',
];

const JOURNAL_STATUSES: Array<JournalStatus | 'ALL'> = [
  'ALL',
  'ACTIVE',
  'STALE',
  'FALSIFIED',
  'PARKED',
];

const JOURNAL_TYPE_TONE: Record<string, Tone> = {
  HYPOTHESIS: 'info',
  STRATEGY_OUTCOME: 'profit',
  RUN_SUMMARY: 'muted',
  ANTI_PATTERN: 'loss',
  CROSS_STRATEGY_FINDING: 'warning',
  IDEA_BACKLOG: 'muted',
};

type JournalSortKey = 'newest' | 'oldest' | 'strategy' | 'status' | 'entry_type';

const SORT_PARAMS: Record<JournalSortKey, { sortBy: string; sortDir: string }> = {
  newest: { sortBy: 'created_time', sortDir: 'desc' },
  oldest: { sortBy: 'created_time', sortDir: 'asc' },
  strategy: { sortBy: 'strategy_code', sortDir: 'asc' },
  status: { sortBy: 'status', sortDir: 'asc' },
  entry_type: { sortBy: 'entry_type', sortDir: 'asc' },
};

function JournalPanel() {
  const [typeFilter, setTypeFilter] = useState<JournalEntryType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'ALL'>('ALL');
  const [strategyInput, setStrategyInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortKey, setSortKey] = useState<JournalSortKey>('newest');

  const [debouncedStrategy, setDebouncedStrategy] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStrategy(strategyInput), 400);
    return () => clearTimeout(t);
  }, [strategyInput]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { sortBy, sortDir } = SORT_PARAMS[sortKey];
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJournalListInfinite({
      entryType: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      strategyCode: debouncedStrategy || undefined,
      search: debouncedSearch || undefined,
      sortBy,
      sortDir,
      limit: 25,
    });

  const rows = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  return (
    <PanelShell
      icon={<BookOpen size={14} />}
      title="Research journal"
      sub="Agent hypothesis & outcome trail · 60 s poll"
      headerSlot={
        <div className="flex flex-wrap items-center gap-1">
          {JOURNAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                typeFilter === t
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              }`}
            >
              {t === 'ALL' ? 'ALL' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      }
    >
      {}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-bd-subtle pb-2">
        <div className="flex items-center gap-1">
          {JOURNAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? 'bg-accent-secondary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Strategy…"
          value={strategyInput}
          onChange={(e) => setStrategyInput(e.target.value)}
          className="focus:border-accent-primary/50 h-6 w-24 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[10px] text-text-secondary placeholder:text-text-muted focus:outline-none"
        />
        <input
          type="text"
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="focus:border-accent-primary/50 h-6 w-32 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[10px] text-text-secondary placeholder:text-text-muted focus:outline-none"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as JournalSortKey)}
          className="focus:border-accent-primary/50 h-6 rounded-sm border border-bd-subtle bg-bg-base px-1 font-mono text-[10px] text-text-secondary focus:outline-none"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="strategy">Strategy A–Z</option>
          <option value="status">Status</option>
          <option value="entry_type">Type</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <div className="bg-bg-base/40 rounded-sm border border-bd-subtle p-4 text-center text-[11px] text-text-muted">
          No journal entries match the current filters.
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {rows.map((r) => {
              const tone = JOURNAL_TYPE_TONE[r.entry_type] ?? 'muted';
              return (
                <li
                  key={r.journal_id}
                  className="rounded-sm border border-bd-subtle bg-bg-base px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <VerdictPill tone={tone} label={r.entry_type.replace('_', ' ')} />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {r.status}
                      </span>
                      {r.strategy_code && (
                        <span className="font-mono text-[10px] text-text-secondary">
                          {r.strategy_code}
                          {r.interval_name ? ` · ${r.interval_name}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-text-muted">
                      {fmtAgo(r.created_time)} ago · {r.created_by ?? '—'}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-[12px] font-semibold text-text-primary">
                    {r.title}
                  </div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-text-muted">
                    {r.content}
                  </div>
                </li>
              );
            })}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-2 w-full rounded-sm border border-bd-subtle py-1 font-mono text-[10px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : `Load more · ${rows.length} shown`}
            </button>
          )}
        </>
      )}
    </PanelShell>
  );
}

interface SweepParamRow {
  name: string;
  values: string;
}

function EnqueueSweepDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const enqueue = useEnqueueSweep();
  const [strategyCode, setStrategyCode] = useState('TPR');
  const [intervalName, setIntervalName] = useState<EnqueueSweepRequest['interval_name']>('1h');
  const [instrument, setInstrument] = useState<string>(DEFAULT_SYMBOL);
  const [hypothesis, setHypothesis] = useState('');
  const [iterBudget, setIterBudget] = useState(3);
  const [priority, setPriority] = useState(200);
  const [earlyStop, setEarlyStop] = useState(true);
  const [requireWalkForward, setRequireWalkForward] = useState(true);
  const [params, setParams] = useState<SweepParamRow[]>([{ name: '', values: '' }]);

  const reset = () => {
    setStrategyCode('TPR');
    setIntervalName('1h');
    setInstrument('BTCUSDT');
    setHypothesis('');
    setIterBudget(3);
    setPriority(200);
    setEarlyStop(true);
    setRequireWalkForward(true);
    setParams([{ name: '', values: '' }]);
  };

  const handleClose = () => {
    onClose();
    enqueue.reset();
  };

  const handleSubmit = () => {
    const cleanedParams = params
      .filter((p) => p.name.trim().length > 0 && p.values.trim().length > 0)
      .map((p) => ({
        name: p.name.trim(),
        values: p.values
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .map((v) => {
            if (v === 'true') return true;
            if (v === 'false') return false;
            const n = Number(v);
            return Number.isFinite(n) && v !== '' ? n : v;
          }),
      }));

    if (cleanedParams.length === 0) {
      toast.error({
        title: 'Sweep needs at least one param row',
        description: 'Add a param name and at least one value to sweep.',
      });
      return;
    }

    const body: EnqueueSweepRequest = {
      strategy_code: strategyCode.trim(),
      interval_name: intervalName,
      instrument: instrument.trim(),
      sweep_config: { strategy: 'grid', params: cleanedParams },
      hypothesis: hypothesis.trim() || null,
      priority,
      iter_budget: iterBudget,
      early_stop_on_no_edge: earlyStop,
      require_walk_forward: requireWalkForward,
    };

    enqueue.mutate(body, {
      onSuccess: (row) => {
        toast.show({
          title: `Enqueued ${row.strategy_code}`,
          description: `queue_id ${row.queue_id.slice(0, 8)} · status ${row.status}`,
          variant: 'success',
        });
        reset();
        onClose();
      },
      onError: (err) => toast.error({ title: 'Enqueue failed', description: normalizeError(err) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enqueue research sweep</DialogTitle>
          <DialogDescription>
            POST /queue. The orchestrator picks up PENDING rows on the next tick, ordered by
            priority then created_time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-[12px]">
          <div className="grid grid-cols-3 gap-2">
            <label htmlFor="enqueue-strategy-code" className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Strategy code
              </span>
              <input
                id="enqueue-strategy-code"
                type="text"
                value={strategyCode}
                onChange={(e) => setStrategyCode(e.target.value)}
                className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary focus:outline-none"
              />
            </label>
            <label htmlFor="enqueue-interval" className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Interval
              </span>
              <select
                id="enqueue-interval"
                value={intervalName}
                onChange={(e) =>
                  setIntervalName(e.target.value as EnqueueSweepRequest['interval_name'])
                }
                className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary focus:outline-none"
              >
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
              </select>
            </label>
            <label htmlFor="enqueue-instrument" className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Instrument
              </span>
              <select
                id="enqueue-instrument"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary focus:outline-none"
              >
                {SUPPORTED_SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor="enqueue-hypothesis" className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Hypothesis (pre-registration)
            </span>
            <textarea
              id="enqueue-hypothesis"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              rows={2}
              placeholder="e.g. Lowering adxEntryMin to 18-23 lifts trade count past 100 without breaking quality gates."
              className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 text-[12px] text-text-primary focus:outline-none"
            />
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Sweep grid (params × values)
              </span>
              <button
                type="button"
                onClick={() => setParams((p) => [...p, { name: '', values: '' }])}
                className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle px-2 py-1 font-mono text-[10px] text-text-muted hover:bg-bg-hover"
              >
                <Plus size={10} /> Add row
              </button>
            </div>
            {params.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) =>
                    setParams((p) =>
                      p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                    )
                  }
                  placeholder="param name (e.g. adxEntryMin)"
                  className="border-bd-default focus:border-accent-primary w-1/3 rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none"
                />
                <input
                  type="text"
                  value={row.values}
                  onChange={(e) =>
                    setParams((p) =>
                      p.map((r, j) => (j === i ? { ...r, values: e.target.value } : r)),
                    )
                  }
                  placeholder="comma-separated values (e.g. 18, 21, 23)"
                  className="border-bd-default focus:border-accent-primary flex-1 rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setParams((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                  disabled={params.length === 1}
                  className="rounded-sm border border-bd-subtle p-1 text-text-muted hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  title="Remove row"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="enqueue-iter-budget" className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Iter budget
              </span>
              <input
                id="enqueue-iter-budget"
                type="number"
                min={1}
                max={200}
                value={iterBudget}
                onChange={(e) => setIterBudget(Number(e.target.value))}
                className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary focus:outline-none"
              />
            </label>
            <label htmlFor="enqueue-priority" className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Priority (lower = sooner)
              </span>
              <input
                id="enqueue-priority"
                type="number"
                min={1}
                max={999}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="border-bd-default focus:border-accent-primary w-full rounded-sm border bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-primary focus:outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="enqueue-early-stop"
              className="inline-flex items-center gap-2 text-[11px] text-text-secondary"
            >
              <input
                id="enqueue-early-stop"
                type="checkbox"
                checked={earlyStop}
                onChange={(e) => setEarlyStop(e.target.checked)}
              />
              <span>Early-stop on NO_EDGE</span>
            </label>
            <label
              htmlFor="enqueue-require-wf"
              className="inline-flex items-center gap-2 text-[11px] text-text-secondary"
            >
              <input
                id="enqueue-require-wf"
                type="checkbox"
                checked={requireWalkForward}
                onChange={(e) => setRequireWalkForward(e.target.checked)}
              />
              <span>Require walk-forward on SIGNIFICANT_EDGE</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            disabled={enqueue.isPending}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={enqueue.isPending}
            className="border-bd-default bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enqueue.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            {enqueue.isPending ? 'Enqueueing…' : 'Enqueue sweep'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PanelShell({
  icon,
  title,
  sub,
  headerSlot,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">{icon}</span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {title}
            </div>
            {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
          </div>
        </div>
        {headerSlot}
      </header>
      {children}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone = 'muted',
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
        {icon}
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums"
        style={{ color: tone === 'muted' ? 'var(--text-primary)' : toneColor(tone) }}
      >
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}

function StateBadge({ state }: { state: PromotionState | 'INACTIVE' }) {
  const tone: Tone =
    state === 'PROMOTED'
      ? 'profit'
      : state === 'PAPER_TRADE'
        ? 'info'
        : state === 'REJECTED' || state === 'DEMOTED'
          ? 'loss'
          : 'muted';
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: 'rgba(0,0,0,0.25)', color: toneColor(tone) }}
    >
      {state}
    </span>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={`px-2.5 py-1.5 ${className}`} style={{ textAlign: align }}>
      {children}
    </td>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function numOrDash(v: number | null | undefined, dp: number): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(dp);
}

function pctOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(2)}%`;
}
