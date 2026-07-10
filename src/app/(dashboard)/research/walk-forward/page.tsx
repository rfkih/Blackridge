'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldX,
  Sparkles,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import {
  listWalkForwardRuns,
  type StabilityVerdict,
  type WalkForwardSummary,
} from '@/lib/api/walk-forward';

const PAGE_SIZE = 25;

const VERDICT_FILTERS: { label: string; value: StabilityVerdict | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Robust', value: 'ROBUST' },
  { label: 'Inconsistent', value: 'INCONSISTENT' },
  { label: 'Insufficient', value: 'INSUFFICIENT_EVIDENCE' },
  { label: 'Overfit', value: 'OVERFIT' },
  { label: 'No edge', value: 'NO_EDGE' },
];

export default function WalkForwardPage() {
  const isAdmin = useIsAdmin();
  const [verdict, setVerdict] = useState<StabilityVerdict | 'ALL'>('ALL');
  // Debounced — the raw input fired one server query per keystroke.
  const { searchInput, setSearchInput, debouncedSearch, page, setPage } = useDebouncedSearchPage();

  const query = useQuery({
    queryKey: ['walk-forward', verdict, debouncedSearch, page],
    queryFn: () =>
      listWalkForwardRuns({
        verdict: verdict === 'ALL' ? undefined : verdict,
        strategyCode: debouncedSearch || undefined,
        page,
        size: PAGE_SIZE,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <div className="px-6 py-12 text-center text-text-secondary">Admin access required.</div>;
  }

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">Walk-forward</h1>
          <p className="text-sm text-text-secondary">
            Rolling-window validation runs from the research orchestrator. ROBUST is the gate for
            promotion to PAPER_TRADE; the agent triggers walk-forward after a SIGNIFICANT_EDGE tick.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill"
          style={{ padding: '8px 12px', fontSize: 14 }}
          aria-label="Refresh walk-forward runs"
        >
          <RefreshCcw size={13} strokeWidth={1.7} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2">
        <span className="text-[13px] uppercase tracking-widest text-text-muted">Verdict</span>
        {VERDICT_FILTERS.map((f) => {
          const active = verdict === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setVerdict(f.value);
                setPage(0);
              }}
              className="rounded-sm px-2 py-1 text-[14px] transition-colors"
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
        <span className="mx-2 h-4 w-px bg-bd-subtle" />
        <label className="flex items-center gap-1.5 text-[14px] text-text-secondary">
          <span className="text-[13px] uppercase tracking-widest text-text-muted">Strategy</span>
          <input
            type="text"
            value={searchInput}
            placeholder="e.g. LSR"
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[14px] text-text-primary"
          />
        </label>
        <span className="ml-auto font-mono text-[12px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'run' : 'runs'}
        </span>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No walk-forward runs match the current filters.
        </div>
      ) : (
        <ul className="divide-y divide-bd-subtle rounded-xl border border-bd-subtle bg-bg-surface">
          {rows.map((r) => (
            <WalkForwardRow key={r.walkForwardId} run={r} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 14 }}
          >
            Prev
          </button>
          <span className="font-mono text-[13px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 14 }}
          >
            Next
          </button>
        </div>
      )}

      <p className="text-[13px] text-text-muted">
        Triggering a new walk-forward from the dashboard is intentionally out of scope — runs take
        up to ~3h synchronous. Use <code className="font-mono">POST /walk-forward</code> on the
        orchestrator (see CLAUDE.md → Research operations) or wait for the autonomous loop.
      </p>
    </div>
  );
}

function WalkForwardRow({ run }: { run: WalkForwardSummary }) {
  const meta = verdictMeta(run.stabilityVerdict);
  const Icon = meta.icon;
  const ts = run.createdTime ? parseIsoUtc(run.createdTime) : null;

  const folds = useMemo(() => {
    const total = num(run.totalTradesAcrossFolds);
    const positivePct = num(run.foldPfPositivePct);
    return {
      pfMean: num(run.foldPfMean),
      pfStd: num(run.foldPfStd),
      pfMin: num(run.foldPfMin),
      pfMax: num(run.foldPfMax),
      sharpeMean: num(run.foldSharpeMean),
      returnMean: num(run.foldReturnMean),
      positivePct,
      totalTrades: total,
    };
  }, [run]);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <span
          className="font-mono text-[13px] uppercase tracking-widest"
          style={{ color: meta.fg }}
        >
          {run.stabilityVerdict.replace(/_/g, ' ')}
        </span>
        {run.stabilityVerdict === 'ROBUST' && (
          <ReadyToPromoteBadge strategyCode={run.strategyCode} />
        )}
        <span className="font-mono text-[14px] text-text-primary">{run.strategyCode}</span>
        <span className="font-mono text-[13px] text-text-secondary">
          {run.instrument} · {run.intervalName}
        </span>
        <span className="font-mono text-[12px] text-text-muted">
          {run.nFolds} folds · {run.trainMonths}m train / {run.testMonths}m test
        </span>
        <span className="ml-auto font-mono text-[12px] text-text-muted">
          {ts ? formatDate(ts) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 lg:grid-cols-6">
        <Metric label="PF mean" value={fmt(folds.pfMean, 3)} />
        <Metric label="PF std" value={fmt(folds.pfStd, 3)} />
        <Metric label="PF range" value={`${fmt(folds.pfMin, 2)} – ${fmt(folds.pfMax, 2)}`} />
        <Metric
          label="% folds +"
          value={folds.positivePct == null ? '—' : `${folds.positivePct.toFixed(1)}%`}
        />
        <Metric
          label="Return mean"
          value={folds.returnMean == null ? '—' : `${(folds.returnMean * 100).toFixed(2)}%`}
        />
        <Metric
          label="Trades"
          value={folds.totalTrades == null ? '—' : folds.totalTrades.toLocaleString()}
        />
      </div>

      {run.motivatingIterationId && (
        <div className="font-mono text-[12px] text-text-muted">
          motivating iter: {run.motivatingIterationId}
        </div>
      )}
    </li>
  );
}

function ReadyToPromoteBadge({ strategyCode }: { strategyCode: string }) {
  return (
    <Link
      href={`/research#promote-${encodeURIComponent(strategyCode)}`}
      title="Walk-forward ROBUST. Opens the /research promotion panel pre-targeted at this strategy."
      className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-80"
      style={{ background: 'rgba(22,179,100,0.15)', color: 'var(--color-profit)' }}
    >
      <Sparkles size={10} strokeWidth={2} />
      Ready to promote
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="font-mono text-[14px] tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

function verdictMeta(v: StabilityVerdict): {
  icon: React.ElementType;
  fg: string;
  bg: string;
} {
  switch (v) {
    case 'ROBUST':
      return {
        icon: CheckCircle2,
        fg: 'var(--color-profit)',
        bg: 'rgba(22,179,100,0.15)',
      };
    case 'INCONSISTENT':
      return {
        icon: ShieldAlert,
        fg: 'var(--color-warning)',
        bg: 'rgba(245,166,35,0.15)',
      };
    case 'OVERFIT':
      return {
        icon: ShieldX,
        fg: 'var(--color-loss)',
        bg: 'rgba(229,72,77,0.15)',
      };
    case 'NO_EDGE':
      return {
        icon: ShieldX,
        fg: 'var(--text-secondary)',
        bg: 'rgba(136,146,164,0.12)',
      };
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return {
        icon: HelpCircle,
        fg: 'var(--color-info)',
        bg: 'rgba(59,130,246,0.12)',
      };
  }
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | null, dp: number): string {
  if (n == null) return '—';
  return n.toFixed(dp);
}
