'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEvaluateHoldout, useSweep } from '@/hooks/useResearch';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatters';
import type { SweepResult, SweepSpec, SweepState } from '@/types/research';

interface PageProps {
  params: { id: string };
}

/**
 * Sweep detail / leaderboard. Auto-polls every 2.5s while the sweep is
 * running, then settles once all combos are done.
 */
export default function SweepDetailPage({ params }: PageProps) {
  const sweepQ = useSweep(params.id);
  const s = sweepQ.data;

  const rankMetric =
    (s?.spec.rankMetric as keyof SweepResult | undefined) ?? 'avgR';

  // ── Filter / sort / paginate state ─────────────────────────────────────
  // Filters are tracked as Sets so each pill is a toggle. Sort key defaults
  // to the sweep's rankMetric so the "winner is row 1" expectation holds
  // until the user clicks a column to override.
  type SortDir = 'asc' | 'desc';
  const [statusFilter, setStatusFilter] = useState<Set<SweepResult['status']>>(
    new Set(),
  );
  const [roundFilter, setRoundFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<keyof SweepResult>(
    rankMetric as keyof SweepResult,
  );
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const allResults = s?.results ?? [];

  const availableRounds = useMemo(() => {
    const set = new Set<number>();
    for (const r of allResults) if (typeof r.round === 'number') set.add(r.round);
    return Array.from(set).sort((a, b) => a - b);
  }, [allResults]);

  const filteredResults = useMemo(() => {
    return allResults.filter((r) => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (roundFilter.size > 0 && (r.round == null || !roundFilter.has(r.round)))
        return false;
      return true;
    });
  }, [allResults, statusFilter, roundFilter]);

  const rankedResults = useMemo(() => {
    const copy = [...filteredResults];
    copy.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey as string];
      const bv = (b as unknown as Record<string, unknown>)[sortKey as string];
      // String compare for status; numeric for everything else. Nulls always
      // sort to the bottom regardless of direction so a still-pending combo
      // never out-ranks a completed one.
      if (typeof av === 'string' || typeof bv === 'string') {
        const as = (av as string) ?? '';
        const bs = (bv as string) ?? '';
        return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
      }
      const aNum = typeof av === 'number' ? av : null;
      const bNum = typeof bv === 'number' ? bv : null;
      if (aNum == null && bNum == null) return 0;
      if (aNum == null) return 1;
      if (bNum == null) return -1;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return copy;
  }, [filteredResults, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rankedResults.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageResults = useMemo(
    () => rankedResults.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [rankedResults, safePage],
  );

  const toggleStatus = (st: SweepResult['status']) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
    setPage(0);
  };
  const toggleRound = (r: number) => {
    setRoundFilter((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
    setPage(0);
  };
  const onSortClick = (key: keyof SweepResult) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default to descending for numeric metrics — almost always what the
      // user wants ("show me the highest avgR").
      setSortDir('desc');
    }
    setPage(0);
  };

  const paramKeys = useMemo(() => {
    // Research-mode sweeps use paramRanges; flat sweeps use paramGrid.
    // Fall back to union of keys observed on actual result rows if neither is
    // present (shouldn't happen, but keeps us safe).
    const fromRanges = s?.spec.paramRanges ? Object.keys(s.spec.paramRanges) : [];
    if (fromRanges.length) return fromRanges;
    const fromGrid = s?.spec.paramGrid ? Object.keys(s.spec.paramGrid) : [];
    if (fromGrid.length) return fromGrid;
    const seen: string[] = [];
    const seenSet = new Set<string>();
    for (const r of s?.results ?? []) {
      for (const k of Object.keys(r.paramSet ?? {})) {
        if (!seenSet.has(k)) {
          seenSet.add(k);
          seen.push(k);
        }
      }
    }
    return seen;
  }, [s?.spec.paramGrid, s?.spec.paramRanges, s?.results]);

  const isResearchMode = (s?.totalRounds ?? 0) > 1;
  const winner = rankedResults.find((r) => r.status === 'COMPLETED') ?? null;

  // ── Per-backtest progress ──────────────────────────────────────────────
  // The sweep thread mirrors each backtest's BacktestRun.progress_percent
  // (0..100) onto the SweepResult on every poll, so we can render the real
  // backtest progress directly — no client-side estimation needed.
  const getProgress = (r: SweepResult): number => {
    if (r.status === 'COMPLETED') return 1;
    if (r.status === 'PENDING') return 0;
    // RUNNING / FAILED: prefer server-reported percent. Default to 0 if it
    // hasn't been polled yet.
    const pct = typeof r.progressPercent === 'number' ? r.progressPercent : 0;
    return Math.max(0, Math.min(1, pct / 100));
  };

  if (sweepQ.isLoading || !s) {
    return (
      <div className="space-y-5">
        <SweepHeader />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SweepHeader spec={s.spec} status={s.status} createdAt={s.createdAt} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Status" value={s.status} />
        <Stat label="Combos" value={`${s.finishedCombos}/${s.totalCombos}`} />
        {isResearchMode && (
          <Stat
            label="Round"
            value={`${s.currentRound ?? '—'} of ${s.totalRounds ?? '—'}`}
          />
        )}
        <Stat label="Asset · Int" value={`${s.spec.asset} · ${s.spec.interval}`} />
        <Stat label="Rank by" value={String(rankMetric)} />
        <Stat
          label="Window"
          value={`${(s.spec.fromDate ?? '').slice(0, 10)} → ${(s.spec.toDate ?? '').slice(0, 10)}`}
        />
        <Stat
          label="Eval mode"
          value={
            s.spec.splitMode === 'WALK_FORWARD_K'
              ? `K-fold · K=${s.spec.walkForwardWindows ?? 4}`
              : s.spec.splitMode === 'TRAIN_OOS'
                ? `Train/OOS · ${s.spec.oosFractionPct ?? 30}%`
                : 'Single window'
          }
        />
      </div>

      {s.status === 'COMPLETED' && winner && (
        <div className="rounded-md border border-[rgba(0,200,150,0.3)] bg-[rgba(0,200,150,0.06)] px-4 py-3">
          <div className="label-caps text-[var(--color-profit)]">WINNER</div>
          <div className="mt-1 font-mono text-[12px] text-text-primary">
            {Object.entries(winner.paramSet).map(([k, v]) => (
              <span key={k} className="mr-3">
                {k}={String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      <DsrThresholdPanel state={s} />
      <HoldoutPanel state={s} winner={winner} />

      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd-subtle px-4 py-3">
          <div className="font-display text-[13px] font-semibold text-text-primary">
            Leaderboard
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {rankedResults.length} of {allResults.length}
              {sortKey === rankMetric && sortDir === 'desc' ? (
                <span className="ml-2">· ranked by {rankMetric}</span>
              ) : null}
            </span>
          </div>
          {(statusFilter.size > 0 || roundFilter.size > 0) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(new Set());
                setRoundFilter(new Set());
                setPage(0);
              }}
              className="text-[11px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
            >
              clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-bd-subtle bg-bg-elevated px-4 py-2.5">
          <FilterGroup label="Status">
            {(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map((st) => (
              <FilterPill
                key={st}
                active={statusFilter.has(st)}
                onClick={() => toggleStatus(st)}
              >
                {st}
              </FilterPill>
            ))}
          </FilterGroup>
          {isResearchMode && availableRounds.length > 1 && (
            <FilterGroup label="Round">
              {availableRounds.map((r) => (
                <FilterPill
                  key={r}
                  active={roundFilter.has(r)}
                  onClick={() => toggleRound(r)}
                >
                  R{r}
                </FilterPill>
              ))}
            </FilterGroup>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead>
              <tr className="border-b border-bd-subtle bg-bg-elevated">
                <Th>#</Th>
                {isResearchMode && <Th>R</Th>}
                {paramKeys.map((k) => (
                  <Th key={k}>
                    <span className="font-mono">{k}</span>
                  </Th>
                ))}
                <SortableTh
                  align="right"
                  sortKey="tradeCount"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Trades
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="winRate"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  WR
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="profitFactor"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  PF
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="avgR"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Avg R
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="netPnl"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Net PnL
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="maxDrawdown"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Max DD
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="trainSharpeRatio"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Train SR
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="sharpeRatio"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Sharpe
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="stddevOosSharpe"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  σ(OOS)
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="psr"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  PSR
                </SortableTh>
                <SortableTh
                  align="right"
                  sortKey="status"
                  current={sortKey}
                  dir={sortDir}
                  onClick={onSortClick}
                >
                  Progress
                </SortableTh>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {pageResults.length === 0 ? (
                <tr>
                  <td
                    colSpan={paramKeys.length + (isResearchMode ? 13 : 12)}
                    className="px-4 py-10 text-center text-[12px] text-text-muted"
                  >
                    No combos match the current filter.
                  </td>
                </tr>
              ) : (
                pageResults.map((r, i) => (
                  <ResultRow
                    key={safePage * PAGE_SIZE + i}
                    rank={safePage * PAGE_SIZE + i + 1}
                    paramKeys={paramKeys}
                    result={r}
                    rankMetric={rankMetric}
                    showRound={isResearchMode}
                    progress={getProgress(r)}
                    dsrThreshold={s.dsrThresholdSharpe ?? null}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-bd-subtle px-4 py-2.5 font-mono text-[11px] text-text-muted">
            <span>
              Page {safePage + 1} of {pageCount} · showing{' '}
              {safePage * PAGE_SIZE + 1}–
              {Math.min((safePage + 1) * PAGE_SIZE, rankedResults.length)} of{' '}
              {rankedResults.length}
            </span>
            <div className="flex items-center gap-1">
              <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft size={12} /> Prev
              </PageBtn>
              <PageBtn
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next <ChevronRight size={12} />
              </PageBtn>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
      style={{
        borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
        background: active ? 'rgba(78,158,255,0.10)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function SortableTh({
  children,
  sortKey,
  current,
  dir,
  onClick,
  align,
}: {
  children: React.ReactNode;
  sortKey: keyof SweepResult;
  current: keyof SweepResult;
  dir: 'asc' | 'desc';
  onClick: (k: keyof SweepResult) => void;
  align?: 'right';
}) {
  const isActive = current === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`label-caps cursor-pointer whitespace-nowrap select-none px-3 py-2 !text-[9px] hover:text-text-primary ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      style={{ color: isActive ? 'var(--text-primary)' : undefined }}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && isActive && (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
        {children}
        {align !== 'right' && isActive && (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-surface px-2 py-1 text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SweepHeader({
  spec,
  status,
  createdAt,
}: {
  spec?: SweepSpec;
  status?: string;
  createdAt?: string | null;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link
          href="/research/sweeps"
          className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={12} /> Back to sweeps
        </Link>
        <div className="mt-1 label-caps">RESEARCH · SWEEP</div>
        <h1 className="font-display text-[22px] font-semibold tracking-tighter text-text-primary">
          {spec?.label || spec?.strategyCode || 'Sweep'}
        </h1>
        {createdAt && (
          <div className="mt-0.5 font-mono text-[11px] text-text-muted">
            started {formatDate(Date.parse(createdAt))}
            {status && <span className="ml-2">· {status}</span>}
          </div>
        )}
      </div>
    </header>
  );
}

function ResultRow({
  rank,
  paramKeys,
  result,
  rankMetric,
  showRound,
  progress,
  dsrThreshold,
}: {
  rank: number;
  paramKeys: string[];
  result: SweepResult;
  rankMetric: keyof SweepResult;
  showRound: boolean;
  progress: number;
  dsrThreshold: number | null;
}) {
  const wrColor =
    (result.winRate ?? 0) >= 0.5 ? 'var(--color-profit)' : 'var(--color-loss)';
  const beatsThreshold =
    dsrThreshold != null &&
    result.sharpeRatio != null &&
    result.sharpeRatio > dsrThreshold;
  const sharpeColor =
    result.sharpeRatio == null
      ? 'var(--text-muted)'
      : beatsThreshold
        ? 'var(--color-profit)'
        : result.sharpeRatio > 0
          ? 'var(--text-primary)'
          : 'var(--color-loss)';
  const psrColor =
    result.psr == null
      ? 'var(--text-muted)'
      : result.psr >= 0.95
        ? 'var(--color-profit)'
        : result.psr >= 0.7
          ? 'var(--text-primary)'
          : 'var(--color-loss)';
  const rColor =
    (result.avgR ?? 0) > 0
      ? 'var(--color-profit)'
      : (result.avgR ?? 0) < 0
        ? 'var(--color-loss)'
        : 'var(--text-muted)';
  const pnlColor =
    (result.netPnl ?? 0) > 0
      ? 'var(--color-profit)'
      : (result.netPnl ?? 0) < 0
        ? 'var(--color-loss)'
        : 'var(--text-muted)';

  const rowBg = rank === 1 ? 'rgba(0,200,150,0.06)' : undefined;

  return (
    <tr
      className="border-b border-bd-subtle last:border-b-0"
      style={{ background: rowBg }}
    >
      <Td className="font-mono text-text-muted">#{rank}</Td>
      {showRound && (
        <Td className="font-mono text-text-muted">R{result.round ?? '—'}</Td>
      )}
      {paramKeys.map((k) => (
        <Td key={k} className="num">
          {formatParamValue(result.paramSet[k])}
        </Td>
      ))}
      <Td align="right" className="num">
        {result.tradeCount ?? '—'}
      </Td>
      <Td align="right" className="num" style={{ color: wrColor }}>
        {result.winRate != null ? `${(result.winRate * 100).toFixed(1)}%` : '—'}
      </Td>
      <Td align="right" className="num">
        {result.profitFactor != null ? result.profitFactor.toFixed(2) : '—'}
      </Td>
      <Td align="right" className="num" style={{ color: rColor }}>
        {result.avgR != null ? result.avgR.toFixed(3) : '—'}
      </Td>
      <Td align="right" className="num" style={{ color: pnlColor }}>
        {result.netPnl != null
          ? `${result.netPnl > 0 ? '+' : ''}${result.netPnl.toFixed(2)}`
          : '—'}
      </Td>
      <Td align="right" className="num text-[var(--color-loss)]">
        {result.maxDrawdown != null ? result.maxDrawdown.toFixed(2) : '—'}
      </Td>
      <Td align="right" className="num text-text-secondary">
        {result.trainSharpeRatio != null ? result.trainSharpeRatio.toFixed(2) : '—'}
      </Td>
      <Td align="right" className="num" style={{ color: sharpeColor }}>
        {result.sharpeRatio != null ? result.sharpeRatio.toFixed(2) : '—'}
      </Td>
      <Td align="right" className="num" style={stddevStyle(result)}>
        {result.stddevOosSharpe != null
          ? `±${result.stddevOosSharpe.toFixed(2)}`
          : '—'}
      </Td>
      <Td align="right" className="num" style={{ color: psrColor }}>
        {result.psr != null ? `${(result.psr * 100).toFixed(1)}%` : '—'}
      </Td>
      <Td align="right">
        <ProgressCell status={result.status} progress={progress} />
      </Td>
      <Td align="right">
        {result.backtestRunId && (
          <Link
            href={`/backtest/${result.backtestRunId}`}
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
          >
            run →
          </Link>
        )}
      </Td>
    </tr>
  );
}

function ProgressCell({
  status,
  progress,
}: {
  status: SweepResult['status'];
  progress: number;
}) {
  const pct = Math.round(progress * 100);
  const palette: Record<SweepResult['status'], { bar: string; label: string }> = {
    PENDING: { bar: 'var(--bg-overlay)', label: 'var(--text-muted)' },
    RUNNING: { bar: 'var(--color-info)', label: 'var(--color-info)' },
    COMPLETED: { bar: 'var(--color-profit)', label: 'var(--color-profit)' },
    FAILED: { bar: 'var(--color-loss)', label: 'var(--color-loss)' },
  };
  const c = palette[status] ?? palette.PENDING;
  // Use the status label as primary text for terminal cases; show the
  // percentage for in-flight rows so the user sees concrete movement.
  const label =
    status === 'PENDING'
      ? 'PENDING'
      : status === 'RUNNING'
        ? `${pct}%`
        : status;
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: c.label }}
      >
        {label}
      </span>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: c.bar,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Locked-holdout discipline panel. Three states:
 *  - sweep submitted without holdout → render nothing.
 *  - holdout reserved, no evaluation yet → show the slice + an "Evaluate
 *    on holdout" button (enabled only on COMPLETED sweeps).
 *  - already evaluated → show a link to the holdout backtest run; no
 *    re-evaluate option, that's the entire point of a holdout.
 */
function HoldoutPanel({
  state,
  winner,
}: {
  state: SweepState;
  winner: SweepResult | null;
}) {
  const evalMutation = useEvaluateHoldout(state.sweepId);
  if (!state.holdoutFromDate || !state.holdoutToDate) return null;

  const sweepCompleted = state.status === 'COMPLETED';
  const alreadyEvaluated = Boolean(state.holdoutBacktestRunId);

  const onEvaluate = async () => {
    if (!winner) {
      toast.error({ title: 'No winner combo to evaluate' });
      return;
    }
    try {
      const res = await evalMutation.mutateAsync(winner.paramSet);
      toast.success({
        title: 'Holdout evaluation submitted',
        description: `run ${res.backtestRunId.slice(0, 8)} — this is the unbiased estimate`,
      });
    } catch (err) {
      toast.error({
        title: 'Could not evaluate holdout',
        description: normalizeError(err),
      });
    }
  };

  return (
    <div
      className="rounded-md border px-4 py-3"
      style={{
        borderColor: alreadyEvaluated
          ? 'rgba(78,158,255,0.3)'
          : 'var(--border-subtle)',
        background: alreadyEvaluated ? 'rgba(78,158,255,0.06)' : undefined,
      }}
    >
      <div
        className="label-caps"
        style={{
          color: alreadyEvaluated
            ? 'var(--color-info)'
            : 'var(--text-secondary)',
        }}
      >
        Locked holdout
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 text-[12px] sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Reserved window
          </span>
          <span className="num text-text-primary">
            {(state.holdoutFromDate ?? '').slice(0, 10)}
            <span className="mx-1 text-text-muted">→</span>
            {(state.holdoutToDate ?? '').slice(0, 10)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Status
          </span>
          <span
            className="text-[11px]"
            style={{
              color: alreadyEvaluated
                ? 'var(--color-info)'
                : sweepCompleted
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
            }}
          >
            {alreadyEvaluated
              ? 'Evaluated — see unbiased result'
              : sweepCompleted
                ? 'Ready — sweep complete, evaluate winner'
                : 'Reserved, waiting for sweep to finish'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            {alreadyEvaluated ? 'Holdout result' : 'Action'}
          </span>
          {alreadyEvaluated ? (
            <Link
              href={`/backtest/${state.holdoutBacktestRunId}`}
              className="font-mono text-[11px] text-[var(--color-info)] hover:underline"
            >
              run {state.holdoutBacktestRunId?.slice(0, 8) ?? '—'} →
            </Link>
          ) : (
            <button
              type="button"
              onClick={onEvaluate}
              disabled={
                !sweepCompleted || !winner || evalMutation.isPending
              }
              className="self-start rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-fast hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {evalMutation.isPending
                ? 'Submitting…'
                : 'Evaluate winner on holdout'}
            </button>
          )}
        </div>
      </div>
      {!alreadyEvaluated && (
        <p className="mt-2 text-[11px] text-text-muted">
          One-shot by design. Once you click, the holdout is spent — no
          second chance, no re-tune. That&apos;s how the result stays
          unbiased.
        </p>
      )}
    </div>
  );
}

function formatParamValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    // Trim trailing zeros for cleaner grid display.
    const s = v.toString();
    return s;
  }
  return String(v);
}

/**
 * Stddev coloring relative to mean OOS Sharpe — the regime-sensitivity
 * signal. Coefficient of variation < 0.3 → robust (profit color); 0.3-0.6
 * neutral; > 0.6 means OOS Sharpe swings hard fold-to-fold (warning).
 * Falls back to muted when there's nothing to compare to.
 */
function stddevStyle(result: SweepResult): React.CSSProperties {
  const sd = result.stddevOosSharpe;
  const mean = result.meanOosSharpe ?? result.sharpeRatio;
  if (sd == null || mean == null || mean === 0) {
    return { color: 'var(--text-muted)' };
  }
  const cv = Math.abs(sd / mean);
  if (cv < 0.3) return { color: 'var(--color-profit)' };
  if (cv > 0.6) return { color: 'var(--color-warning)' };
  return { color: 'var(--text-secondary)' };
}

/**
 * Multiple-comparison context for the leaderboard. Surfaces the cohort's
 * expected-max-Sharpe under N null trials so users can read the top combo's
 * Sharpe with the right amount of skepticism: a Sharpe of 2.0 over 500
 * combos means much less than a Sharpe of 2.0 from a single pre-registered
 * run. Hidden when fewer than 2 combos have completed (no DSR possible).
 */
function DsrThresholdPanel({ state }: { state: SweepState }) {
  const threshold = state.dsrThresholdSharpe;
  const sigma = state.dsrCohortStddev;
  if (threshold == null) return null;

  const completed = state.results.filter((r) => r.status === 'COMPLETED');
  const topSharpe = completed.reduce<number | null>((max, r) => {
    if (r.sharpeRatio == null) return max;
    return max == null || r.sharpeRatio > max ? r.sharpeRatio : max;
  }, null);
  const passes = topSharpe != null && topSharpe > threshold;

  return (
    <div className="rounded-md border border-bd-subtle bg-bg-surface px-4 py-3">
      <div className="label-caps text-text-secondary">
        Multiple-comparison context
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4 text-[12px] sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            DSR threshold (E[max])
          </span>
          <span className="num text-text-primary">{threshold.toFixed(3)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Top Sharpe
          </span>
          <span
            className="num"
            style={{
              color: passes
                ? 'var(--color-profit)'
                : topSharpe == null
                ? 'var(--text-muted)'
                : 'var(--color-warning)',
            }}
          >
            {topSharpe != null ? topSharpe.toFixed(3) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Cohort σ(SR)
          </span>
          <span className="num text-text-secondary">
            {sigma != null ? sigma.toFixed(3) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Verdict
          </span>
          <span
            className="text-[11px]"
            style={{
              color: passes
                ? 'var(--color-profit)'
                : 'var(--color-warning)',
            }}
          >
            {passes
              ? 'Top combo exceeds expected max — evidence beyond luck.'
              : 'Top combo within selection-bias range; treat as candidate, not winner.'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2">
      <div className="label-caps !text-[9px]">{label}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold text-text-primary">
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`label-caps whitespace-nowrap px-3 py-2 !text-[9px] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
  style,
}: {
  children: React.ReactNode;
  align?: 'right';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 ${
        align === 'right' ? 'text-right tabular-nums' : ''
      } ${className ?? ''}`}
      style={style}
    >
      {children}
    </td>
  );
}
