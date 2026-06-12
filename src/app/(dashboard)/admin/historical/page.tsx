'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  History,
  Info,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, subDays, subYears } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthHydrated } from '@/store/authStore';
import {
  useCancelJob,
  useCoverageReport,
  useJob,
  useListJobs,
  usePatchableColumns,
  useSubmitJob,
} from '@/hooks/useHistoricalBackfill';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { BACKTEST_INTERVALS, INTERVALS } from '@/lib/constants';
import {
  isJobTerminal,
  type CoverageReport,
  type HistoricalBackfillJob,
  type JobStatus,
  type SubmitJobRequest,
} from '@/lib/api/historical';
import { SUPPORTED_SYMBOLS, DEFAULT_SYMBOL } from '@/lib/symbols';

type ActionKey =
  | 'warmup'
  | 'rangeFill'
  | 'recompute'
  | 'fundingHistory'
  | 'backfillOfi'
  | `patch:${string}`;

interface SelectableAction {
  key: ActionKey;
  label: string;
  description: string;
  count?: number;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const fromDt = subDays(now, 7);

  return {
    from: format(fromDt, "yyyy-MM-dd'T'HH:mm"),
    to: format(now, "yyyy-MM-dd'T'HH:mm"),
  };
}

function toIsoSeconds(v: string): string {
  return v.length === 16 ? `${v}:00` : v;
}

/** Current local time as a backend LocalDateTime ISO string (no trailing Z). */
function nowLocalIso(): string {
  return new Date().toISOString().slice(0, 19);
}

/** Bar duration in milliseconds for the intervals we support, or null if unknown. */
function intervalToMs(interval: string): number | null {
  const map: Record<string, number> = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '4h': 4 * 60 * 60_000,
    '1d': 24 * 60 * 60_000,
  };
  return map[interval] ?? null;
}

/**
 * Builds the set of COVERAGE_REPAIR range jobs needed to fill every gap for a
 * coverage row, plus a tail job when the latest bar is stale (older than ~one
 * interval before now). Returns an empty list when nothing needs filling.
 *
 * The backend's range repair brute-fetches the whole [from,to] span from
 * Binance, so we submit one job per gap rather than a single full-span job —
 * that avoids re-pulling years of already-present candles. The only exception
 * is when the gap list hits the backend's 100-gap cap: then we can't trust the
 * list to be complete, so we fall back to a single full-span range job.
 */
function buildFillGapsJobs(
  symbol: string,
  interval: string,
  coverage: CoverageReport,
): SubmitJobRequest[] {
  const md = coverage.marketData;
  if (!md.earliest) return [];

  const now = nowLocalIso();
  const GAP_CAP = 100;

  // Gap list is capped — assume it may be truncated and repair the full span.
  if (md.gaps.length >= GAP_CAP) {
    return [
      {
        jobType: 'COVERAGE_REPAIR',
        symbol,
        interval,
        params: { mode: 'range', from: md.earliest, to: now },
      },
    ];
  }

  const jobs: SubmitJobRequest[] = md.gaps.map((g) => ({
    jobType: 'COVERAGE_REPAIR',
    symbol,
    interval,
    params: { mode: 'range', from: g.from, to: g.to },
  }));

  // Stale-tail job: fill from the last present bar up to now when the tail is
  // older than ~one interval (i.e. the symbol isn't live-streaming fresh bars).
  const barMs = intervalToMs(interval);
  if (md.latest) {
    const latestMs = new Date(`${md.latest}Z`).getTime();
    const nowMs = Date.now();
    const staleThreshold = barMs ?? 60 * 60_000;
    if (Number.isFinite(latestMs) && nowMs - latestMs > staleThreshold) {
      jobs.push({
        jobType: 'COVERAGE_REPAIR',
        symbol,
        interval,
        params: { mode: 'range', from: md.latest, to: now },
      });
    }
  }

  return jobs;
}

export default function AdminHistoricalPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !isAdmin) router.replace('/');
  }, [hydrated, isAdmin, router]);

  if (!hydrated) return null;
  if (!isAdmin) return null;

  return <HistoricalIntegrityConsole />;
}

function HistoricalIntegrityConsole() {
  const defaults = useMemo(defaultDateRange, []);

  const [symbol, setSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [interval, setIntervalValue] = useState<string>('1h');
  const [from, setFrom] = useState<string>(defaults.from);
  const [to, setTo] = useState<string>(defaults.to);
  const [useFullRange, setUseFullRange] = useState<boolean>(true);

  const [inspected, setInspected] = useState<boolean>(false);

  const fromIso = useFullRange ? undefined : toIsoSeconds(from);
  const toIso = useFullRange ? undefined : toIsoSeconds(to);

  const coverage = useCoverageReport({
    symbol,
    interval,
    from: fromIso,
    to: toIso,
    enabled: inspected,
  });
  const patchable = usePatchableColumns();

  const patchableSet = useMemo(() => {
    const set = new Set<string>();
    patchable.data?.columns.forEach((c) => set.add(c.column));
    return set;
  }, [patchable.data]);

  const [selected, setSelected] = useState<Set<ActionKey>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [symbol, interval, from, to, useFullRange]);

  const FS_MUTATORS: ActionKey[] = useMemo(() => ['warmup', 'rangeFill', 'recompute'], []);
  const selectedFsMutator = FS_MUTATORS.find((k) => selected.has(k));

  const availableActions = useMemo<SelectableAction[]>(() => {
    if (!coverage.data) return [];
    const report = coverage.data;
    const actions: SelectableAction[] = [];

    const fsConflictReason = (self: ActionKey): string | undefined => {
      if (!selectedFsMutator || selectedFsMutator === self) return undefined;
      return `Conflicts with the selected "${selectedFsMutator}" action on the same scope — pick one feature_store mutator at a time.`;
    };

    {
      const conflict = fsConflictReason('warmup');
      actions.push({
        key: 'warmup',
        label: 'Backfill missing market_data + feature_store (warmup)',
        description:
          'Fetch the last 5,000 candles + 300-bar warmup from Binance and repair missing rows in both tables.',
        disabled: !!conflict,
        disabledReason: conflict,
      });
    }

    {
      const conflict = fsConflictReason('rangeFill');
      const reason =
        conflict ??
        (useFullRange
          ? 'Disable "Use full available range" and pick from/to to enable.'
          : undefined);
      actions.push({
        key: 'rangeFill',
        label: `Backfill missing feature_store rows in range${
          report.featureStore.missingRows > 0 ? ` (${report.featureStore.missingRows} rows)` : ''
        }`,
        description:
          'Fill candles in [from, to] that have no feature_store row. Requires market_data already present.',
        count: report.featureStore.missingRows,
        disabled: !!reason,
        disabledReason: reason,
      });
    }

    Object.entries(report.nullColumns)
      .sort((a, b) => b[1] - a[1])
      .forEach(([column, count]) => {
        const isPatchable = patchableSet.has(column);
        actions.push({
          key: `patch:${column}` as ActionKey,
          label: `Patch NULL ${column}`,
          description: isPatchable
            ? `${count.toLocaleString()} rows · auto-discover all (symbol, interval) pairs.`
            : `${count.toLocaleString()} rows · no patcher registered yet.`,
          count,
          disabled: !isPatchable,
          disabledReason: !isPatchable
            ? 'No FeaturePatcher bean registered for this column. Add one to enable.'
            : undefined,
        });
      });

    actions.push({
      key: 'fundingHistory',
      label: 'Backfill funding_rate_history (Binance fapi)',
      description: 'Pull funding events into funding_rate_history. Idempotent; perp-only.',
    });

    {
      // Only flag missing OFI rows when market_data actually has candles —
      // zero OFI on an empty range is expected, not a backfill gap.
      const hasCandles = report.marketData.actual > 0;
      const ofiMissing =
        hasCandles &&
        !!report.microstructure &&
        Object.values(report.microstructure.ofiRowsByFeature).some((v) => v === 0);
      const reason = useFullRange
        ? 'Disable "Use full available range" and pick from/to to enable.'
        : !hasCandles
          ? 'No market_data candles in range — run COVERAGE_REPAIR first.'
          : undefined;
      actions.push({
        key: 'backfillOfi',
        label: `Backfill OFI features in range${ofiMissing ? ' (missing rows detected)' : ''}`,
        description:
          'Recompute ofi_ratio, ofi_zscore_24h, ofi_momentum_8h, cvd_proxy_zscore_24h from market_data and upsert into feature_values.',
        disabled: !!reason,
        disabledReason: reason,
      });
    }

    {
      const conflict = fsConflictReason('recompute');
      const reason =
        conflict ??
        (useFullRange
          ? 'Disable "Use full available range" and pick from/to to enable.'
          : undefined);
      actions.push({
        key: 'recompute',
        label: 'Recompute feature_store rows in range',
        description:
          'Delete existing feature_store rows in [from, to], then recompute from scratch. Use only after indicator code or params changed.',
        variant: 'danger',
        disabled: !!reason,
        disabledReason: reason,
      });
    }

    return actions;
  }, [coverage.data, patchableSet, useFullRange, selectedFsMutator]);

  const toggleAction = (key: ActionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rangeError = useMemo(() => {
    if (useFullRange) return null;
    if (!from || !to) return 'Pick both start and end.';
    if (new Date(from).getTime() >= new Date(to).getTime()) return 'End must be after start.';
    return null;
  }, [from, to, useFullRange]);

  const submit = useSubmitJob();
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [confirmRecompute, setConfirmRecompute] = useState<boolean>(false);

  const handleRunRepair = async () => {
    if (selected.has('recompute') && !confirmRecompute) {
      setConfirmRecompute(true);
      return;
    }
    setConfirmRecompute(false);

    const jobs: SubmitJobRequest[] = [];
    if (selected.has('warmup')) {
      jobs.push({
        jobType: 'COVERAGE_REPAIR',
        symbol,
        interval,
        params: { mode: 'warmup' },
      });
    }
    if (selected.has('rangeFill') && fromIso && toIso) {
      jobs.push({
        jobType: 'COVERAGE_REPAIR',
        symbol,
        interval,
        params: { mode: 'range', from: fromIso, to: toIso },
      });
    }
    if (selected.has('recompute') && fromIso && toIso) {
      jobs.push({
        jobType: 'RECOMPUTE_RANGE',
        symbol,
        interval,
        params: { from: fromIso, to: toIso },
      });
    }
    if (selected.has('fundingHistory')) {
      jobs.push({
        jobType: 'BACKFILL_FUNDING_HISTORY',
        symbol,
        params: {},
      });
    }
    if (selected.has('backfillOfi') && fromIso && toIso) {
      jobs.push({
        jobType: 'BACKFILL_OFI_FEATURES',
        symbol,
        interval,
        params: { from: fromIso, to: toIso },
      });
    }
    selected.forEach((k) => {
      if (typeof k === 'string' && k.startsWith('patch:')) {
        const column = k.slice('patch:'.length);
        jobs.push({
          jobType: 'PATCH_NULL_COLUMN',

          params: { column },
        });
      }
    });

    if (jobs.length === 0) {
      toast.warning({ title: 'Nothing selected', description: 'Pick one or more repair actions.' });
      return;
    }

    const settled = await Promise.all(
      jobs.map(async (req) => {
        try {
          const job = await submit.mutateAsync(req);
          return { ok: true as const, jobId: job.jobId };
        } catch (err) {
          toast.error({
            title: `Failed to submit ${req.jobType}`,
            description: normalizeError(err),
          });
          return { ok: false as const };
        }
      }),
    );
    const submittedIds: string[] = settled.flatMap((r) => (r.ok ? [r.jobId] : []));

    if (submittedIds.length > 0) {
      setActiveJobIds((prev) => [...prev, ...submittedIds]);
      setSelected(new Set());
      toast.success({
        title: `Submitted ${submittedIds.length} job(s)`,
        description: 'Watch progress in the active jobs panel below.',
      });
    }
  };

  const handleFillGaps = async () => {
    if (!coverage.data) return;
    const md = coverage.data.marketData;
    if (!md.earliest) return;

    const jobs = buildFillGapsJobs(symbol, interval, coverage.data);
    if (jobs.length === 0) {
      toast.success({
        title: 'Coverage already complete',
        description: `${symbol} · ${interval} — no gaps and the tail is fresh.`,
      });
      return;
    }

    const settled = await Promise.all(
      jobs.map(async (req) => {
        try {
          const job = await submit.mutateAsync(req);
          return { ok: true as const, jobId: job.jobId };
        } catch (err) {
          toast.error({
            title: `Failed to submit gap fill for ${symbol} · ${interval}`,
            description: normalizeError(err),
          });
          return { ok: false as const };
        }
      }),
    );
    const submittedIds: string[] = settled.flatMap((r) => (r.ok ? [r.jobId] : []));

    if (submittedIds.length > 0) {
      setActiveJobIds((prev) => [...prev, ...submittedIds]);
      toast.success({
        title: `Filling gaps for ${symbol} · ${interval}`,
        description: `Submitted ${submittedIds.length} backfill job(s). Watch progress below.`,
      });
    }
  };

  const handleInspect = () => {
    if (rangeError) return;
    setInspected(true);
    coverage.refetch();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps inline-flex items-center gap-1.5">
          <ShieldCheck size={10} strokeWidth={1.75} />
          Admin
        </p>
        <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
          Historical data integrity
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">
          Diagnose missing market_data candles, missing feature_store rows, and NULL indicator
          columns — then submit one or more async repair jobs. Each job runs on the research JVM and
          reports live progress.
        </p>
      </header>

      <AdminNotice />

      <BackfillCandleRangeCard
        onJobsSubmitted={(ids) => setActiveJobIds((prev) => [...prev, ...ids])}
      />

      <ScopeCard
        symbol={symbol}
        setSymbol={setSymbol}
        interval={interval}
        setIntervalValue={setIntervalValue}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        useFullRange={useFullRange}
        setUseFullRange={setUseFullRange}
        rangeError={rangeError}
        onInspect={handleInspect}
        isFetching={coverage.isFetching}
      />

      {inspected && (
        <CoverageCard query={coverage} onFillGaps={handleFillGaps} isFilling={submit.isPending} />
      )}

      {inspected && coverage.data && (
        <RepairActionsCard
          actions={availableActions}
          selected={selected}
          onToggle={toggleAction}
          onRun={handleRunRepair}
          isSubmitting={submit.isPending}
        />
      )}

      {activeJobIds.length > 0 && (
        <ActiveJobsPanel jobIds={activeJobIds} onDismiss={() => setActiveJobIds([])} />
      )}

      <RecentJobsPanel />

      <RecomputeConfirmDialog
        open={confirmRecompute}
        from={fromIso}
        to={toIso}
        symbol={symbol}
        interval={interval}
        onCancel={() => setConfirmRecompute(false)}
        onConfirm={handleRunRepair}
      />
    </div>
  );
}

interface ScopeCardProps {
  symbol: string;
  setSymbol: (v: string) => void;
  interval: string;
  setIntervalValue: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  useFullRange: boolean;
  setUseFullRange: (v: boolean) => void;
  rangeError: string | null;
  onInspect: () => void;
  isFetching: boolean;
}

function ScopeCard(props: ScopeCardProps) {
  const {
    symbol,
    setSymbol,
    interval,
    setIntervalValue,
    from,
    setFrom,
    to,
    setTo,
    useFullRange,
    setUseFullRange,
    rangeError,
    onInspect,
    isFetching,
  } = props;
  const symId = useId();
  const fullRangeId = useId();

  const canSubmit = symbol.trim().length >= 3 && interval.length > 0 && !rangeError;

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-sm"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
        >
          <Database size={14} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">Scope</h2>
          <p className="text-[11px] text-text-secondary">
            Pick the (symbol, interval) — and optionally a time range — to inspect.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={symId} className="label-caps">
              Symbol
            </Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger id={symId} className="font-mono">
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

          <div className="space-y-1.5">
            <Label className="label-caps">Interval</Label>
            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i} className="font-mono">
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label
          htmlFor={fullRangeId}
          className="flex cursor-pointer items-start gap-2 text-[12px] text-text-secondary"
        >
          <input
            id={fullRangeId}
            type="checkbox"
            checked={useFullRange}
            onChange={(e) => setUseFullRange(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer"
          />
          <span>
            <span className="font-semibold text-text-primary">Use full available range</span>
            <span className="ml-1 text-text-muted">
              — defaults to MIN(start_time)..MAX(start_time) for the pair. Disable to scope to a
              specific window (required for range-fill / recompute).
            </span>
          </span>
        </label>

        {!useFullRange && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-caps">From</Label>
              <Input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">To</Label>
              <Input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        )}

        {rangeError && (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-loss)]">
            <AlertTriangle size={11} /> {rangeError}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={onInspect} disabled={!canSubmit || isFetching} className="gap-1.5">
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Inspect coverage
          </Button>
        </div>
      </div>
    </section>
  );
}

interface CoverageCardProps {
  query: ReturnType<typeof useCoverageReport>;
  onFillGaps: () => void;
  isFilling: boolean;
}

function CoverageCard({ query, onFillGaps, isFilling }: CoverageCardProps) {
  if (query.isLoading) {
    return (
      <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
          <Loader2 size={12} className="animate-spin" /> Inspecting coverage…
        </p>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="rounded-xl border border-bd-subtle bg-bg-surface p-4">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-loss)]">
          <AlertTriangle size={12} /> Coverage failed: {normalizeError(query.error)}
        </p>
      </section>
    );
  }
  if (!query.data) return null;

  const r = query.data;
  const hasData = r.marketData.earliest != null;
  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <header className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
          >
            <Sparkles size={14} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold text-text-primary">
              Coverage report
            </h2>
            <p className="font-mono text-[11px] text-text-secondary">
              {r.symbol} · {r.interval} · {r.from?.replace('T', ' ').slice(0, 19)} →{' '}
              {r.to?.replace('T', ' ').slice(0, 19)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onFillGaps}
            disabled={!hasData || isFilling || query.isFetching}
            className="gap-1.5"
            title={
              hasData
                ? 'Backfills every missing candle from the first bar to now (idempotent).'
                : 'No market_data for this pair yet — use "Add candle range" first.'
            }
          >
            {isFilling ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Fill gaps
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="gap-1.5"
          >
            {query.isFetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Search size={12} />
            )}
            Re-inspect
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <CoverageBlockMarketData report={r} />
        <CoverageBlockFeatureStore report={r} />
        <CoverageBlockNullColumns report={r} />
        <CoverageBlockSanity report={r} />
        {r.microstructure && <CoverageBlockMicrostructure report={r} />}
      </div>
    </section>
  );
}

function CoverageBlockMarketData({ report }: { report: CoverageReport }) {
  const md = report.marketData;
  const completeness = md.expected > 0 ? (md.actual / md.expected) * 100 : 100;
  return (
    <div className="rounded-md border border-bd-subtle p-3">
      <h3 className="mb-2 font-display text-[12px] font-semibold text-text-primary">market_data</h3>
      <dl className="space-y-1.5 text-[12px]">
        <Row
          label="Rows"
          value={`${md.actual.toLocaleString()} / ${md.expected.toLocaleString()}`}
        />
        <Row label="Completeness" value={`${completeness.toFixed(1)}%`} />
        <Row
          label="Internal gaps"
          value={`${md.gapCount}`}
          tone={md.gapCount > 0 ? 'warn' : 'ok'}
        />
        <Row label="Earliest" value={md.earliest?.replace('T', ' ').slice(0, 19) ?? '—'} mono />
        <Row label="Latest" value={md.latest?.replace('T', ' ').slice(0, 19) ?? '—'} mono />
      </dl>
      {md.gaps.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-text-secondary hover:text-text-primary">
            Show first {md.gaps.length} gap(s)
          </summary>
          <div className="mt-2 max-h-48 overflow-auto rounded-sm border border-bd-subtle bg-bg-base p-2">
            <table className="w-full text-[11px]">
              <thead className="text-text-muted">
                <tr>
                  <th className="text-left">After</th>
                  <th className="text-left">Before</th>
                  <th className="text-right">Bars</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {md.gaps.map((g, i) => (
                  <tr key={i} className="border-t border-bd-subtle">
                    <td>{g.from?.replace('T', ' ').slice(0, 19)}</td>
                    <td>{g.to?.replace('T', ' ').slice(0, 19)}</td>
                    <td className="text-right">{g.missingBars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function CoverageBlockFeatureStore({ report }: { report: CoverageReport }) {
  const fs = report.featureStore;
  return (
    <div className="rounded-md border border-bd-subtle p-3">
      <h3 className="mb-2 font-display text-[12px] font-semibold text-text-primary">
        feature_store
      </h3>
      <dl className="space-y-1.5 text-[12px]">
        <Row label="Rows" value={fs.actual.toLocaleString()} />
        <Row
          label="Missing rows"
          value={fs.missingRows.toLocaleString()}
          tone={fs.missingRows > 0 ? 'warn' : 'ok'}
        />
      </dl>
      <p className="mt-2 text-[11px] text-text-muted">
        Missing = market_data rows in range that have no corresponding feature_store row. Patchable
        via the &ldquo;backfill missing feature_store rows&rdquo; action.
      </p>
    </div>
  );
}

function CoverageBlockNullColumns({ report }: { report: CoverageReport }) {
  const entries = Object.entries(report.nullColumns).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-md border border-bd-subtle p-3">
      <h3 className="mb-2 font-display text-[12px] font-semibold text-text-primary">
        NULL indicator columns
      </h3>
      {entries.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-profit)]">
          <CheckCircle2 size={11} /> All indicator columns populated.
        </p>
      ) : (
        <ul className="space-y-1.5 font-mono text-[12px]">
          {entries.map(([col, count]) => (
            <li key={col} className="flex items-center justify-between">
              <span className="text-text-primary">{col}</span>
              <span className="text-[var(--color-warning)]">{count.toLocaleString()} NULL</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoverageBlockSanity({ report }: { report: CoverageReport }) {
  const s = report.sanity;
  const hits = s.highLessThanLow + s.zeroVolume + s.duplicateStartTime;
  return (
    <div className="rounded-md border border-bd-subtle p-3">
      <h3 className="mb-2 font-display text-[12px] font-semibold text-text-primary">
        Sanity checks
      </h3>
      <dl className="space-y-1.5 text-[12px]">
        <Row
          label="high < low"
          value={`${s.highLessThanLow}`}
          tone={s.highLessThanLow > 0 ? 'bad' : 'ok'}
        />
        <Row
          label="zero volume"
          value={`${s.zeroVolume}`}
          tone={s.zeroVolume > 0 ? 'warn' : 'ok'}
        />
        <Row
          label="duplicate start_time"
          value={`${s.duplicateStartTime}`}
          tone={s.duplicateStartTime > 0 ? 'bad' : 'ok'}
        />
      </dl>
      {hits === 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-profit)]">
          <CheckCircle2 size={11} /> Clean.
        </p>
      )}
    </div>
  );
}

function CoverageBlockMicrostructure({ report }: { report: CoverageReport }) {
  const ms = report.microstructure;
  // Drive OFI rows from the backend's returned keyset — never a hardcoded
  // frontend list that can fall out of sync with OFI_FEATURE_NAMES in Java.
  const ofiEntries = Object.entries(ms.ofiRowsByFeature);
  // Only flag missing rows when there are actual candles; zero OFI on an
  // empty range is expected, not a data gap.
  const anyOfiMissing = report.marketData.actual > 0 && ofiEntries.some(([, v]) => v === 0);

  return (
    <div className="rounded-md border border-bd-subtle p-3 lg:col-span-2">
      <h3 className="mb-3 font-display text-[12px] font-semibold text-text-primary">
        Market microstructure
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* OFI features (feature_values) */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-text-secondary">
            OFI features — feature_values
          </p>
          <dl className="space-y-1.5 text-[12px]">
            {ofiEntries.map(([name, count]) => (
              <Row
                key={name}
                label={name}
                value={count.toLocaleString()}
                tone={
                  count === 0 && report.marketData.actual > 0
                    ? 'warn'
                    : count > 0
                      ? 'ok'
                      : undefined
                }
                mono
              />
            ))}
          </dl>
          {anyOfiMissing ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-warning)]">
              <AlertTriangle size={11} /> One or more OFI features have no rows in this range. Use
              &ldquo;Backfill OFI features&rdquo; to fill.
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-profit)]">
              <CheckCircle2 size={11} /> All OFI features populated.
            </p>
          )}
        </div>

        {/* Order book snapshots */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-text-secondary">
            Order book snapshots — orderbook_snapshots
          </p>
          <dl className="space-y-1.5 text-[12px]">
            <Row
              label="Rows"
              value={ms.obSnapshotsActual.toLocaleString()}
              tone={ms.obSnapshotsActual === 0 ? 'warn' : 'ok'}
            />
            <Row
              label="Gaps"
              value={`${ms.obSnapshotsGapCount}`}
              tone={ms.obSnapshotsGapCount > 0 ? 'warn' : 'ok'}
            />
            <Row
              label="Earliest"
              value={ms.obSnapshotsEarliest?.replace('T', ' ').slice(0, 19) ?? '—'}
              mono
            />
            <Row
              label="Latest"
              value={ms.obSnapshotsLatest?.replace('T', ' ').slice(0, 19) ?? '—'}
              mono
            />
          </dl>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
            <Info size={11} /> OB snapshots are live-only — Binance does not provide historical L2
            data. Gaps can only be closed by live streaming.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
  mono?: boolean;
}) {
  const colorClass =
    tone === 'bad'
      ? 'text-[var(--color-loss)]'
      : tone === 'warn'
        ? 'text-[var(--color-warning)]'
        : tone === 'ok'
          ? 'text-[var(--color-profit)]'
          : 'text-text-primary';
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`${mono ? 'font-mono' : ''} ${colorClass}`}>{value}</dd>
    </div>
  );
}

interface RepairActionsCardProps {
  actions: SelectableAction[];
  selected: Set<ActionKey>;
  onToggle: (key: ActionKey) => void;
  onRun: () => void;
  isSubmitting: boolean;
}

function RepairActionsCard(props: RepairActionsCardProps) {
  const { actions, selected, onToggle, onRun, isSubmitting } = props;
  const enabledSelected = Array.from(selected).filter((k) => {
    const a = actions.find((x) => x.key === k);
    return a && !a.disabled;
  });
  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-sm"
          style={{
            background: 'rgba(245,166,35,0.12)',
            color: 'var(--color-warning)',
          }}
        >
          <History size={14} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">
            Repair actions
          </h2>
          <p className="text-[11px] text-text-secondary">
            Select one or more — each runs as a separate async job.
          </p>
        </div>
      </header>

      <ul className="divide-y divide-bd-subtle">
        {actions.map((a) => {
          const checked = selected.has(a.key);
          const isDanger = a.variant === 'danger';
          const inputId = `repair-action-${a.key.replace(/[^a-z0-9]/gi, '_')}`;
          return (
            <li
              key={a.key}
              className={`p-3 ${a.disabled ? 'opacity-60' : ''}`}
              title={a.disabled ? a.disabledReason : undefined}
            >
              <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  disabled={a.disabled}
                  onChange={() => onToggle(a.key)}
                  className="mt-1 h-3.5 w-3.5 cursor-pointer"
                  style={isDanger ? { accentColor: 'var(--color-loss)' } : undefined}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-semibold ${
                        isDanger ? 'text-[var(--color-loss)]' : 'text-text-primary'
                      }`}
                    >
                      {a.label}
                    </span>
                    {isDanger && (
                      <span className="rounded-sm border border-[var(--color-loss)] px-1.5 py-0 text-[9px] font-bold uppercase text-[var(--color-loss)]">
                        Danger
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-muted">{a.description}</p>
                  {a.disabled && a.disabledReason && (
                    <p className="mt-1 text-[10px] text-text-secondary">⤷ {a.disabledReason}</p>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-bd-subtle px-4 py-3">
        <p className="text-[11px] text-text-secondary">
          {enabledSelected.length === 0
            ? 'Nothing selected.'
            : `${enabledSelected.length} action(s) selected.`}
        </p>
        <Button
          onClick={onRun}
          disabled={enabledSelected.length === 0 || isSubmitting}
          className="gap-1.5"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Run repair
        </Button>
      </div>
    </section>
  );
}

function ActiveJobsPanel({ jobIds, onDismiss }: { jobIds: string[]; onDismiss: () => void }) {
  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <header className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
          >
            <Loader2 size={14} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold text-text-primary">
              Active jobs
            </h2>
            <p className="text-[11px] text-text-secondary">
              Polling every 1.5s while not terminal. Cancel is cooperative — most jobs stop at the
              next chunk boundary; warmup and funding-history complete their current call before
              honoring cancel.
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1">
          <X size={12} />
          Dismiss
        </Button>
      </header>
      <ul className="divide-y divide-bd-subtle">
        {jobIds.map((id) => (
          <ActiveJobRow key={id} jobId={id} />
        ))}
      </ul>
    </section>
  );
}

function ActiveJobRow({ jobId }: { jobId: string }) {
  const { data, isError, error } = useJob(jobId);
  const cancel = useCancelJob();

  if (!data) {
    return (
      <li className="p-3 text-[12px] text-text-secondary">
        {isError ? `error: ${normalizeError(error)}` : 'loading…'}
      </li>
    );
  }
  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="font-mono text-[12px] text-text-primary">{data.jobType}</span>
            {data.symbol && (
              <span className="font-mono text-[11px] text-text-secondary">
                · {data.symbol} {data.interval ?? ''}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-muted">
            jobId {data.jobId.slice(0, 8)}… · phase {data.phase ?? '—'}
          </p>
          <ProgressBar done={data.progressDone} total={data.progressTotal} />
          <p className="mt-1 text-[10px] text-text-muted">
            <Clock size={10} className="-mt-0.5 mr-1 inline" />
            created {formatDistanceToNowStrict(new Date(data.createdAt), { addSuffix: true })}
            {data.finishedAt && (
              <>
                {' · '}
                finished {formatDistanceToNowStrict(new Date(data.finishedAt), { addSuffix: true })}
              </>
            )}
          </p>
          {data.errorMessage && (
            <p className="mt-1 text-[11px] text-[var(--color-loss)]">err: {data.errorMessage}</p>
          )}
        </div>
        {!isJobTerminal(data) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancel.mutate(data.jobId)}
            disabled={data.cancelRequested || cancel.isPending}
            title={
              data.jobType === 'BACKFILL_FUNDING_HISTORY'
                ? 'Cancel sets the flag, but funding-history is a single sync call and will complete before honoring cancel.'
                : 'Cancel is cooperative — the job exits at its next chunk boundary (typically <1s).'
            }
          >
            {data.cancelRequested ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>
    </li>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-bg-base">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: 'var(--color-info)',
            transition: 'width 200ms ease-out',
          }}
        />
      </div>
      <span className="font-mono text-[10px] text-text-muted">
        {done}/{total} · {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { color: string; bg: string; label: string }> = {
    PENDING: { color: 'var(--color-info)', bg: 'rgba(59,130,246,0.12)', label: 'PENDING' },
    RUNNING: { color: 'var(--color-info)', bg: 'rgba(59,130,246,0.12)', label: 'RUNNING' },
    SUCCESS: { color: 'var(--color-profit)', bg: 'rgba(46,196,138,0.12)', label: 'SUCCESS' },
    FAILED: { color: 'var(--color-loss)', bg: 'rgba(255,90,90,0.12)', label: 'FAILED' },
    CANCELLED: { color: 'var(--color-warning)', bg: 'rgba(245,166,35,0.12)', label: 'CANCELLED' },
  };
  const cfg = map[status];
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function RecentJobsPanel() {
  const [expanded, setExpanded] = useState<boolean>(false);
  const list = useListJobs({ limit: 20 });

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center justify-between border-b border-bd-subtle px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{ background: 'rgba(170,170,170,0.08)', color: 'var(--text-secondary)' }}
          >
            <Clock size={14} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold text-text-primary">
              Recent jobs
            </h2>
            <p className="text-[11px] text-text-secondary">
              Last {list.data?.length ?? 0} historical backfill jobs across all (symbol, interval).
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <ul className="max-h-96 divide-y divide-bd-subtle overflow-auto">
          {list.isLoading && (
            <li className="p-3 text-[12px] text-text-secondary">
              <Loader2 size={12} className="-mt-0.5 mr-1 inline animate-spin" /> loading…
            </li>
          )}
          {list.data && list.data.length === 0 && (
            <li className="p-3 text-[12px] text-text-muted">No jobs yet.</li>
          )}
          {list.data?.map((j) => (
            <RecentJobRow key={j.jobId} job={j} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentJobRow({ job }: { job: HistoricalBackfillJob }) {
  const created = new Date(job.createdAt);
  return (
    <li className="px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <span className="font-mono text-[12px] text-text-primary">{job.jobType}</span>
          {job.symbol && (
            <span className="font-mono text-[11px] text-text-secondary">
              {job.symbol} {job.interval ?? ''}
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-text-muted">{format(created, 'HH:mm:ss')}</span>
      </div>
      {job.errorMessage && (
        <p className="mt-1 truncate text-[11px] text-[var(--color-loss)]">
          err: {job.errorMessage}
        </p>
      )}
    </li>
  );
}

interface RecomputeConfirmDialogProps {
  open: boolean;
  symbol: string;
  interval: string;
  from: string | undefined;
  to: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

function RecomputeConfirmDialog(props: RecomputeConfirmDialogProps) {
  const { open, symbol, interval, from, to, onCancel, onConfirm } = props;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-loss)]">
            <AlertTriangle size={16} /> Confirm recompute
          </DialogTitle>
          <DialogDescription>
            This will <strong>delete every feature_store row</strong> in the range and recompute
            from scratch. Existing strategies that read these features will see momentary gaps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-sm border border-bd-subtle bg-bg-base p-3 font-mono text-[11px] text-text-primary">
          <div>symbol: {symbol}</div>
          <div>interval: {interval}</div>
          <div>from: {from ?? '—'}</div>
          <div>to: {to ?? '—'}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="gap-1">
            <X size={12} /> Cancel
          </Button>
          <Button onClick={onConfirm} className="gap-1" style={{ background: 'var(--color-loss)' }}>
            <XCircle size={12} /> Yes, recompute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackfillCandleRangeCard({
  onJobsSubmitted,
}: {
  onJobsSubmitted: (ids: string[]) => void;
}) {
  const [symbol, setSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [from, setFrom] = useState<string>('2020-01-01T00:00');
  const [to, setTo] = useState<string>(format(subYears(new Date(), 3), "yyyy-MM-dd'T'HH:mm"));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = useSubmitJob();

  const rangeError = useMemo(() => {
    if (!from || !to) return 'Pick both start and end.';
    if (new Date(from) >= new Date(to)) return 'End must be after start.';
    return null;
  }, [from, to]);

  const canSubmit = symbol.trim().length >= 3 && !rangeError;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const fromIso = toIsoSeconds(from);
    const toIso = toIsoSeconds(to);

    try {
      const settled = await Promise.all(
        BACKTEST_INTERVALS.map(async (interval) => {
          try {
            const job = await submit.mutateAsync({
              jobType: 'COVERAGE_REPAIR',
              symbol,
              interval,
              params: { mode: 'range', from: fromIso, to: toIso },
            });
            return { ok: true as const, jobId: job.jobId };
          } catch (err) {
            toast.error({
              title: `Failed to submit ${interval}`,
              description: normalizeError(err),
            });
            return { ok: false as const };
          }
        }),
      );

      const succeededIds = settled.flatMap((r) => (r.ok ? [r.jobId] : []));
      if (succeededIds.length > 0) {
        onJobsSubmitted(succeededIds);
        toast.success({
          title: `${succeededIds.length}/${BACKTEST_INTERVALS.length} backfill jobs submitted`,
          description: `${symbol} · ${BACKTEST_INTERVALS.join(', ')} · ${from} → ${to}`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-sm"
          style={{ background: 'rgba(46,196,138,0.12)', color: 'var(--color-profit)' }}
        >
          <Database size={14} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">
            Add candle range
          </h2>
          <p className="text-[11px] text-text-secondary">
            Fetch raw OHLCV candles from Binance for a custom date window across all active
            intervals&nbsp;
            <span className="font-mono text-text-muted">({BACKTEST_INTERVALS.join(' · ')})</span>.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label className="label-caps">Symbol</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="font-mono">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="label-caps">From</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-caps">To</Label>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {rangeError && (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-loss)]">
            <AlertTriangle size={11} /> {rangeError}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-text-muted">
            Submits {BACKTEST_INTERVALS.length} jobs in parallel — one per interval. Idempotent;
            existing candles are skipped.
          </p>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="gap-1.5">
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Fetch candles
          </Button>
        </div>
      </div>
    </section>
  );
}

function AdminNotice() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'rgba(59,130,246,0.35)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <ShieldAlert
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-[var(--color-info)]"
        aria-hidden="true"
      />
      <div className="text-[12px] leading-relaxed text-text-secondary">
        <span className="font-semibold text-text-primary">Admin action</span> — backfills mutate
        shared market_data + feature_store tables. Avoid wide ranges during market hours; cancel
        cleanly via the active-jobs panel rather than killing the JVM.
      </div>
    </div>
  );
}
