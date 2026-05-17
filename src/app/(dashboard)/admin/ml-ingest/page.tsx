'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNowStrict, parseISO, subMonths } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Settings,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthHydrated } from '@/store/authStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  useMlSchedules,
  useMlSourceHealth,
  useTriggerMlBackfill,
  useUpdateMlSchedule,
} from '@/hooks/useMlIngest';
import { useCancelJob, useJob } from '@/hooks/useHistoricalBackfill';
import { isJobTerminal, type HistoricalBackfillJob } from '@/lib/api/historical';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import {
  ML_SOURCE_DESCRIPTIONS,
  ML_SOURCE_LABELS,
  type MlIngestSchedule,
  type MlSource,
  type MlSourceHealth,
  type MlSourceHealthStatus,
} from '@/types/mlIngest';
import { SUPPORTED_SYMBOLS, DEFAULT_SYMBOL } from '@/lib/symbols';

const SOURCE_ORDER: MlSource[] = [
  'fred',
  'binance_macro',
  'defillama',
  'coinmetrics',
  'coingecko',
  'alternative_me',
  'forexfactory',
];

const VALID_SOURCES: ReadonlySet<MlSource> = new Set(SOURCE_ORDER);

/**
 * Derive the ML source from a job's `jobType`. The source string is encoded
 * in the JobType prefix (`BACKFILL_ML_FRED` → `fred`), NOT in `params` —
 * `params` carries handler-specific args like `{start, end}`.
 */
function jobTypeToMlSource(jobType: string | null | undefined): MlSource | null {
  if (!jobType || !jobType.startsWith('BACKFILL_ML_')) return null;
  const candidate = jobType.replace('BACKFILL_ML_', '').toLowerCase();
  return VALID_SOURCES.has(candidate as MlSource) ? (candidate as MlSource) : null;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function healthBadgeClass(status: MlSourceHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-tint-profit text-profit border-profit/30';
    case 'degraded':
      return 'bg-tint-warning text-warning border-warning/30';
    case 'failed':
      return 'bg-tint-loss text-loss border-loss/30';
    case 'disabled':
      return 'bg-bg-hover text-text-secondary border-bd';
    case 'unknown':
    default:
      return 'bg-bg-hover text-text-secondary border-bd';
  }
}

function healthIcon(status: MlSourceHealthStatus) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'degraded':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5" />;
    case 'disabled':
      return <X className="h-3.5 w-3.5" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
}

const ISO_DATE_FMT = 'yyyy-MM-dd';

function defaultBackfillRange(): { start: string; end: string } {
  const now = new Date();
  const seventeenMonthsAgo = subMonths(now, 17);
  return {
    start: format(seventeenMonthsAgo, ISO_DATE_FMT),
    end: format(now, ISO_DATE_FMT),
  };
}

interface BackfillPreset {
  label: string;
  months: number;
}

const BACKFILL_PRESETS: BackfillPreset[] = [
  { label: '17 months', months: 17 },
  { label: '12 months', months: 12 },
  { label: '6 months', months: 6 },
  { label: '3 months', months: 3 },
  { label: '1 month', months: 1 },
];

function presetRange(months: number): { start: string; end: string } {
  const now = new Date();
  return {
    start: format(subMonths(now, months), ISO_DATE_FMT),
    end: format(now, ISO_DATE_FMT),
  };
}

export default function MlIngestAdminPage() {
  const router = useRouter();
  const isAuthHydrated = useAuthHydrated();
  const isAdmin = useIsAdmin();

  const schedulesQ = useMlSchedules();
  const healthQ = useMlSourceHealth();

  const schedulesBySource = useMemo<Partial<Record<MlSource, MlIngestSchedule>>>(() => {
    const out: Partial<Record<MlSource, MlIngestSchedule>> = {};
    for (const row of schedulesQ.data ?? []) {
      out[row.source] = row;
    }
    return out;
  }, [schedulesQ.data]);

  const healthBySource = useMemo<Partial<Record<MlSource, MlSourceHealth>>>(() => {
    const out: Partial<Record<MlSource, MlSourceHealth>> = {};
    for (const row of healthQ.data ?? []) {
      out[row.source] = row;
    }
    return out;
  }, [healthQ.data]);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobQ = useJob(activeJobId);
  const cancelMutation = useCancelJob();

  const [backfillDialogFor, setBackfillDialogFor] = useState<MlSource | null>(null);
  const [scheduleDialogFor, setScheduleDialogFor] = useState<MlSource | null>(null);

  useEffect(() => {
    if (isAuthHydrated && !isAdmin) {
      router.replace('/');
    }
  }, [isAuthHydrated, isAdmin, router]);

  const lastHandledJobIdRef = useRef<string | null>(null);
  const schedulesRefetch = schedulesQ.refetch;
  const healthRefetch = healthQ.refetch;
  useEffect(() => {
    const job = jobQ.data;
    if (!job || !isJobTerminal(job)) return;
    if (lastHandledJobIdRef.current === job.jobId) return;
    lastHandledJobIdRef.current = job.jobId;
    schedulesRefetch();
    healthRefetch();
  }, [jobQ.data, schedulesRefetch, healthRefetch]);

  if (!isAuthHydrated) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const onCancelActive = async () => {
    if (!activeJobId) return;
    try {
      await cancelMutation.mutateAsync(activeJobId);
      toast.info({ title: 'Cancel requested', description: 'Handler will exit at its next poll point.' });
    } catch (e) {
      toast.error({ title: 'Failed to cancel', description: normalizeError(e) });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <Database className="h-5 w-5 text-text-secondary" />
            ML Data Sources
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Admin control plane for ML/sentiment ingestion. 7 free sources, all PIT-correct.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            schedulesQ.refetch();
            healthQ.refetch();
          }}
          disabled={schedulesQ.isFetching || healthQ.isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${schedulesQ.isFetching || healthQ.isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {}
      {jobQ.data && !isJobTerminal(jobQ.data) ? (
        <ActiveJobBanner job={jobQ.data} onCancel={onCancelActive} isCancelling={cancelMutation.isPending} />
      ) : null}

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SOURCE_ORDER.map((source) => (
          <SourceCard
            key={source}
            source={source}
            schedule={schedulesBySource[source]}
            health={healthBySource[source]}
            loading={schedulesQ.isLoading || healthQ.isLoading}
            onBackfill={() => setBackfillDialogFor(source)}
            onSchedule={() => setScheduleDialogFor(source)}
            isJobRunning={!!jobQ.data && !isJobTerminal(jobQ.data) && jobTypeToMlSource(jobQ.data.jobType) === source}
          />
        ))}
      </div>

      {}
      <BackfillDialog
        source={backfillDialogFor}
        onClose={() => setBackfillDialogFor(null)}
        onSubmitted={(job) => {
          setActiveJobId(job.jobId);
          setBackfillDialogFor(null);
        }}
      />

      {}
      <ScheduleDialog
        source={scheduleDialogFor}
        schedule={scheduleDialogFor ? schedulesBySource[scheduleDialogFor] : undefined}
        onClose={() => setScheduleDialogFor(null)}
      />
    </div>
  );
}

interface SourceCardProps {
  source: MlSource;
  schedule: MlIngestSchedule | undefined;
  health: MlSourceHealth | undefined;
  loading: boolean;
  onBackfill: () => void;
  onSchedule: () => void;
  isJobRunning: boolean;
}

function SourceCard({
  source,
  schedule,
  health,
  loading,
  onBackfill,
  onSchedule,
  isJobRunning,
}: SourceCardProps) {
  const status: MlSourceHealthStatus = health?.healthStatus ?? 'unknown';
  const label = ML_SOURCE_LABELS[source];
  const description = ML_SOURCE_DESCRIPTIONS[source];

  return (
    <div className="rounded-lg border border-bd-subtle bg-bg-elevated p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-sm font-medium text-text-primary">{label}</div>
          <div className="text-xs text-text-muted">{description}</div>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 inline-flex items-center gap-1 ${healthBadgeClass(status)}`}
        >
          {healthIcon(status)}
          <span className="capitalize">{status}</span>
        </Badge>
      </div>

      {}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
        <Stat label="Last pull" value={fmtRelative(health?.lastPullAt ?? null)} />
        <Stat label="Last success" value={fmtRelative(health?.lastSuccessAt ?? null)} />
        <Stat
          label="Rows (total)"
          value={loading ? '…' : (health?.rowsInsertedTotal ?? 0).toLocaleString()}
        />
        <Stat
          label="Errors"
          value={loading ? '…' : (health?.errorsTotal ?? 0).toString()}
          tone={(health?.errorsTotal ?? 0) > 0 ? 'warn' : 'normal'}
        />
        <Stat
          label="PIT rejects"
          value={loading ? '…' : (health?.rejectedPitViolationsTotal ?? 0).toString()}
          tone={(health?.rejectedPitViolationsTotal ?? 0) > 0 ? 'warn' : 'normal'}
        />
        <Stat
          label="Schedule"
          value={schedule ? (schedule.enabled ? 'enabled' : 'disabled') : '—'}
          tone={schedule?.enabled ? 'normal' : 'muted'}
        />
      </div>

      {health?.healthMessage ? (
        <div className="text-xs text-text-secondary italic line-clamp-2">{health.healthMessage}</div>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={onBackfill} disabled={isJobRunning} className="flex-1">
          {isJobRunning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running
            </>
          ) : (
            <>
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Backfill
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={onSchedule} disabled={!schedule}>
          <Settings className="h-3.5 w-3.5 mr-1.5" /> Schedule
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'warn' | 'muted';
}) {
  const toneClass =
    tone === 'warn' ? 'text-warning' : tone === 'muted' ? 'text-text-muted' : 'text-text-primary';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`${toneClass} truncate`}>{value}</div>
    </div>
  );
}

function ActiveJobBanner({
  job,
  onCancel,
  isCancelling,
}: {
  job: HistoricalBackfillJob;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const progressPct =
    job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  return (
    <div className="rounded-lg border border-info/30 bg-tint-info p-4 flex items-center gap-4">
      <Loader2 className="h-5 w-5 text-info animate-spin shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-sm text-text-primary truncate">
          <span className="font-medium">{job.jobType}</span>
          <span className="text-text-secondary mx-2">·</span>
          <span className="text-text-secondary">phase: {job.phase ?? 'pending'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-xs text-text-muted font-mono tabular-nums">
          {job.progressDone} / {job.progressTotal} · status {job.status}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        disabled={job.cancelRequested || isCancelling}
      >
        {job.cancelRequested ? 'Cancelling…' : 'Cancel'}
      </Button>
    </div>
  );
}

function BackfillDialog({
  source,
  onClose,
  onSubmitted,
}: {
  source: MlSource | null;
  onClose: () => void;
  onSubmitted: (job: HistoricalBackfillJob) => void;
}) {
  const triggerMutation = useTriggerMlBackfill();
  const startId = useId();
  const endId = useId();
  const symbolId = useId();

  const [{ start, end }, setRange] = useState(defaultBackfillRange);
  const [symbol, setSymbol] = useState<string>(DEFAULT_SYMBOL);

  const open = source !== null;
  const symbolRequired = source === 'binance_macro' || source === 'coinmetrics';

  const todayIso = format(new Date(), ISO_DATE_FMT);

  const buildSubmitParams = () => ({
    start: `${start}T00:00:00`,
    end: `${end}T23:59:59`,
  });

  const onSubmit = async () => {
    if (!source) return;
    if (!start || !end) {
      toast.error({
        title: 'Date range required',
        description: 'Pick both a from and a to date.',
      });
      return;
    }
    if (start > end) {
      toast.error({
        title: 'Invalid range',
        description: 'From-date must be on or before to-date.',
      });
      return;
    }
    if (symbolRequired && !symbol.trim()) {
      toast.error({
        title: 'Symbol required',
        description: `${ML_SOURCE_LABELS[source]} is per-symbol — enter one (e.g. BTCUSDT).`,
      });
      return;
    }
    try {
      const job = await triggerMutation.mutateAsync({
        source,
        symbol: symbolRequired ? symbol.trim() : null,
        params: buildSubmitParams(),
      });
      toast.success({
        title: 'Backfill submitted',
        description: `${ML_SOURCE_LABELS[source]} ${start} → ${end}`,
      });
      onSubmitted(job);
    } catch (e) {
      toast.error({
        title: 'Failed to submit backfill',
        description: normalizeError(e),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backfill {source ? ML_SOURCE_LABELS[source] : ''}</DialogTitle>
          <DialogDescription>
            Submits a historical backfill job. Progress streams to the banner above.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {symbolRequired ? (
            <div>
              <Label htmlFor={symbolId}>Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id={symbolId} className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {}
          <div>
            <Label className="text-xs uppercase tracking-wide text-text-muted">
              Quick range
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BACKFILL_PRESETS.map((preset) => {
                const presetVals = presetRange(preset.months);
                const isActive = presetVals.start === start && presetVals.end === end;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRange(presetVals)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-mono tabular-nums transition-colors ${
                      isActive
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-bd-subtle bg-bg-elevated text-text-secondary hover:border-bd hover:text-text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={startId} className="text-xs uppercase tracking-wide text-text-muted">
                From
              </Label>
              <DatePicker
                id={startId}
                value={start}
                onChange={(v) => setRange((r) => ({ ...r, start: v }))}
                max={end || todayIso}
                placeholder="Start date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={endId} className="text-xs uppercase tracking-wide text-text-muted">
                To
              </Label>
              <DatePicker
                id={endId}
                value={end}
                onChange={(v) => setRange((r) => ({ ...r, end: v }))}
                min={start}
                max={todayIso}
                placeholder="End date"
              />
            </div>
          </div>

          <div className="text-xs text-text-muted italic">
            Ranges are inclusive day-boundaries (00:00:00 → 23:59:59 UTC). Default 17
            months matches the Phase 1 backfill window.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={triggerMutation.isPending}>
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting…
              </>
            ) : (
              <>Run backfill</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  source,
  schedule,
  onClose,
}: {
  source: MlSource | null;
  schedule: MlIngestSchedule | undefined;
  onClose: () => void;
}) {
  const open = source !== null && schedule !== undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        {schedule ? (

          <ScheduleEditForm key={schedule.id} schedule={schedule} onSaved={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleEditForm({
  schedule,
  onSaved,
}: {
  schedule: MlIngestSchedule;
  onSaved: () => void;
}) {
  const updateMutation = useUpdateMlSchedule();
  const cronId = useId();
  const lookbackId = useId();
  const configId = useId();

  const [cron, setCron] = useState(schedule.cronExpression);
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [lookback, setLookback] = useState(schedule.lookbackHours.toString());
  const [configText, setConfigText] = useState(JSON.stringify(schedule.config, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);

  const onSave = async () => {
    let parsedConfig: Record<string, unknown> | undefined;
    try {
      parsedConfig = JSON.parse(configText) as Record<string, unknown>;
      setConfigError(null);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }

    const lookbackNum = Number.parseInt(lookback, 10);
    if (!Number.isFinite(lookbackNum) || lookbackNum < 1 || lookbackNum > 720) {
      toast.error({
        title: 'Invalid lookback',
        description: 'Lookback hours must be in [1, 720].',
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: schedule.id,
        req: {
          cronExpression: cron,
          enabled,
          lookbackHours: lookbackNum,
          config: parsedConfig,
        },
      });
      toast.success({ title: 'Schedule updated', description: ML_SOURCE_LABELS[schedule.source] });
      onSaved();
    } catch (e) {
      toast.error({
        title: 'Failed to save schedule',
        description: normalizeError(e),
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Schedule · {ML_SOURCE_LABELS[schedule.source]}</DialogTitle>
        <DialogDescription>
          Live ingestion runs on this cron. Disabled schedules persist but never fire.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {}
        <div className="flex items-center justify-between rounded-md border border-bd-subtle px-3 py-2">
          <div>
            <Label className="text-sm">Enabled</Label>
            <div className="text-xs text-text-muted">
              When off, the cron still parses but does not fire.
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {}
        <div>
          <Label htmlFor={cronId}>Cron (Spring 6-field)</Label>
          <Input
            id={cronId}
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 0 22 * * *"
            className="font-mono tabular-nums"
          />
          <div className="text-xs text-text-muted mt-1">
            Format: <span className="font-mono">sec min hour day month dow</span>. Validated server-side.
          </div>
        </div>

        {}
        <div>
          <Label htmlFor={lookbackId}>Lookback hours (live tick)</Label>
          <Input
            id={lookbackId}
            type="number"
            min={1}
            max={720}
            value={lookback}
            onChange={(e) => setLookback(e.target.value)}
            className="font-mono tabular-nums"
          />
          <div className="text-xs text-text-muted mt-1">
            How many hours of history each tick pulls. Range [1, 720].
          </div>
        </div>

        {}
        <div>
          <Label htmlFor={configId}>Config (JSON)</Label>
          <textarea
            id={configId}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-bd-subtle bg-bg-elevated px-3 py-2 text-xs font-mono tabular-nums text-text-primary"
          />
          {configError ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-loss">
              <ShieldAlert className="h-3 w-3" /> {configError}
            </div>
          ) : (
            <div className="text-xs text-text-muted mt-1">
              Source-specific. E.g. <span className="font-mono">{`{"series_ids":["DXY","DGS10"]}`}</span>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onSaved}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            <>Save</>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
