'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButtons } from '@/components/research/papers/ExportButtons';
import { PaperActionButtons } from '@/components/research/papers/PaperActionButtons';
import { RegenerateButton } from '@/components/research/papers/RegenerateButton';
import { getPaper, getPaperChartData } from '@/lib/api/researchPapers';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { toneColor, type Tone } from '@/lib/tones';
import type {
  BestIteration,
  BestIterationMetrics,
  PaperCitation,
  PaperDetail,
  PaperJournalEntry,
  TopIteration,
  VerdictGate,
} from '@/types/papers';
import type { BacktestEquityPoint } from '@/types/backtest';

const PaperEquityCurveChart = dynamic(
  () =>
    import('@/components/research/papers/PaperEquityCurveChart').then(
      (m) => m.PaperEquityCurveChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
);

const PaperTradeHistogram = dynamic(
  () =>
    import('@/components/research/papers/PaperTradeHistogram').then((m) => m.PaperTradeHistogram),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

const BacktestMonthlyReturns = dynamic(
  () =>
    import('@/components/backtest/BacktestMonthlyReturns').then((m) => m.BacktestMonthlyReturns),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function verdictTone(v: string | null): Tone {
  if (!v) return 'muted';
  if (v === 'SIGNIFICANT_EDGE' || v === 'PASS') return 'profit';
  if (v === 'MARGINAL') return 'warning';
  if (v === 'NO_EDGE' || v === 'DISCARD') return 'loss';
  return 'muted';
}

function statusTone(s: string): Tone {
  return s === 'FINALIZED' ? 'profit' : 'warning';
}

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

// ---------------------------------------------------------------------------
// Paper section — numbered, always visible
// ---------------------------------------------------------------------------

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div className="flex items-baseline gap-2 border-b border-bd-subtle pb-1">
        <span className="font-mono text-[11px] text-text-muted">{num}</span>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-widest text-text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section — for extended / detail content
// ---------------------------------------------------------------------------

function CollapsibleSection({
  id,
  num,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  id: string;
  num: string;
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-baseline gap-2 border-b border-bd-subtle pb-1 text-left transition-colors hover:border-text-muted"
      >
        <span className="font-mono text-[11px] text-text-muted">{num}</span>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-widest text-text-muted group-hover:text-text-secondary">
          {title}
        </h2>
        <span className="ml-2 font-mono text-[11px] text-text-muted">{summary}</span>
        <span className="ml-auto text-text-muted">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Figure wrapper
// ---------------------------------------------------------------------------

function Figure({ num, caption, children }: { num: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-bd-subtle bg-bg-surface">
        <div className="px-2 pb-2 pt-3">{children}</div>
      </div>
      <figcaption className="text-center font-mono text-[10px] italic text-text-muted">
        {num} {caption}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Compact metrics row (paper style — one line)
// ---------------------------------------------------------------------------

function MetricPill({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 first:pl-0 last:pr-0">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span
        className="font-display text-[20px] font-semibold tabular-nums leading-none"
        style={tone ? { color: toneColor(tone) } : { color: 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && <span className="font-mono text-[9px] text-text-muted">{sub}</span>}
    </div>
  );
}

function MetricsRow({ m }: { m: BestIterationMetrics }) {
  const dd = m.max_drawdown_pct;
  const ddTone: Tone = dd != null && dd < -15 ? 'loss' : dd != null && dd < -8 ? 'warning' : 'muted';
  return (
    <div className="flex flex-wrap items-start divide-x divide-bd-subtle">
      <MetricPill
        label="CAGR"
        value={fmt(m.cagr, 1, '%')}
        tone={m.cagr != null && m.cagr >= 10 ? 'profit' : 'warning'}
      />
      <MetricPill
        label="Profit Factor"
        value={fmt(m.profit_factor)}
        sub={m.pf_ci_low != null ? `CI low ${fmt(m.pf_ci_low)}` : undefined}
        tone={m.profit_factor != null && m.profit_factor > 1 ? 'profit' : 'loss'}
      />
      <MetricPill
        label="DSR"
        value={fmt(m.dsr, 3)}
        tone={m.dsr != null && m.dsr >= 0.95 ? 'profit' : 'warning'}
      />
      <MetricPill label="Max Drawdown" value={fmt(dd, 1, '%')} tone={ddTone} />
      <MetricPill label="Sharpe" value={fmt(m.sharpe_ratio)} />
      <MetricPill label="Trades" value={m.trade_count?.toString() ?? '—'} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat gates — academic table style
// ---------------------------------------------------------------------------

function StatGatesTable({ gate }: { gate: VerdictGate }) {
  const rows = [
    {
      ok: gate.n_trades_ok,
      criterion: `Trades ≥ ${gate.n_trades_threshold}`,
      actual: String(gate.n_trades_value),
    },
    {
      ok: gate.pf_ci_ok,
      criterion: 'PF 95% CI lower > 1.0',
      actual: gate.pf_ci_low != null ? gate.pf_ci_low.toFixed(2) : '—',
    },
    {
      ok: gate.dsr_ok,
      criterion: `DSR ≥ ${gate.dsr_threshold}`,
      actual: gate.dsr_value != null ? gate.dsr_value.toFixed(3) : '—',
    },
    {
      ok: gate.stat_verdict_ok,
      criterion: 'Statistical verdict',
      actual: gate.stat_verdict ?? '—',
    },
    {
      ok: gate.cagr_ok,
      criterion: `CAGR ≥ ${gate.cagr_threshold}% (90% Kelly, ann.)`,
      actual: gate.cagr_value != null ? gate.cagr_value.toFixed(1) + '%' : '—',
    },
  ];

  return (
    <div className="space-y-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle">
            <th className="pb-1.5 pr-4 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Criterion
            </th>
            <th className="pb-1.5 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Actual
            </th>
            <th className="pb-1.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bd-subtle">
          {rows.map((r) => (
            <tr key={r.criterion}>
              <td className="py-1.5 pr-4 text-text-secondary">{r.criterion}</td>
              <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-text-primary">
                {r.actual}
              </td>
              <td className="py-1.5 text-right">
                {r.ok ? (
                  <CheckCircle2 size={12} className="ml-auto" style={{ color: toneColor('profit') }} />
                ) : (
                  <XCircle size={12} className="ml-auto" style={{ color: toneColor('loss') }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-bd-subtle">
            <td colSpan={2} className="pt-2 text-[11px] font-semibold text-text-secondary">
              Overall verdict
            </td>
            <td className="pt-2 text-right">
              <span
                className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: toneColor(gate.all_gates_passed ? 'profit' : 'loss') }}
              >
                {gate.all_gates_passed ? 'Pass' : 'Fail'}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic-style parameter table (horizontal rules only)
// ---------------------------------------------------------------------------

function ParamsTable({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params);
  if (!entries.length) return <p className="text-[12px] text-text-muted">No parameters recorded.</p>;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-bd-subtle">
          <th className="pb-1.5 pr-6 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Parameter
          </th>
          <th className="pb-1.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Value
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-bd-subtle">
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="py-1 pr-6 font-mono text-text-secondary">{k}</td>
            <td className="py-1 text-right font-mono tabular-nums text-text-primary">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Top iterations — academic table
// ---------------------------------------------------------------------------

function TopIterationsTable({ rows }: { rows: TopIteration[] }) {
  if (!rows.length) return <p className="text-[12px] text-text-muted">No iterations recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle">
            {['#', 'CAGR', 'Profit Factor', 'PF CI low', 'DSR', 'Max DD', 'Trades', 'Verdict'].map((h) => (
              <th
                key={h}
                className="pb-1.5 pr-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bd-subtle">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-bg-hover">
              <td className="py-1.5 pr-3 font-mono text-text-muted">{r.iteration_number ?? i + 1}</td>
              <td
                className="py-1.5 pr-3 font-mono tabular-nums font-semibold"
                style={{ color: r.cagr != null && r.cagr >= 10 ? toneColor('profit') : toneColor('muted') }}
              >
                {fmt(r.cagr, 1, '%')}
              </td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-primary">{fmt(r.profit_factor)}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-secondary">{fmt(r.pf_ci_low)}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-secondary">{fmt(r.dsr, 3)}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-secondary">{fmt(r.max_drawdown_pct, 1, '%')}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-secondary">{r.trade_count ?? '—'}</td>
              <td className="py-1.5">
                {r.verdict && (
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: toneColor(verdictTone(r.verdict)) }}
                  >
                    {r.verdict.replace(/_/g, ' ')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Robustness tables
// ---------------------------------------------------------------------------

function ObjectTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="text-[12px] text-text-muted">No data.</p>;
  return (
    <table className="w-full text-[11px]">
      <tbody className="divide-y divide-bd-subtle">
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="py-1 pr-6 font-mono text-text-secondary">{k}</td>
            <td className="py-1 text-right font-mono tabular-nums text-text-primary">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

function JournalCard({ entry }: { entry: PaperJournalEntry }) {
  return (
    <div className="space-y-1 border-l-2 border-bd-subtle pl-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-text-muted">
          {entry.entry_type.replace(/_/g, ' ')}
        </span>
        <span className="font-mono text-[9px] text-text-muted">
          {formatDate(parseIsoUtc(entry.created_time))}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-text-primary">{entry.title}</p>
      <p className="text-[12px] leading-relaxed text-text-secondary whitespace-pre-line">{entry.content}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading & error states
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-6 w-full max-w-lg" />
      <div className="flex gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-16" />
        ))}
      </div>
      <Skeleton className="h-60 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-10 text-center">
      <p className="text-[13px] text-text-muted">
        No research paper found with ID <span className="font-mono">{id}</span>.
      </p>
      <Link
        href="/research/papers"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent-primary)] hover:underline"
      >
        <ArrowLeft size={12} /> Back to library
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaperPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: paper, isLoading, isError } = useQuery({
    queryKey: ['paper', id],
    queryFn: () => getPaper(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['paper-charts', id],
    queryFn: () => getPaperChartData(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !paper) return <NotFound id={id} />;

  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;
  const meta = paper.metadata;

  const equityPoints: BacktestEquityPoint[] = (chartData?.equity_curve ?? []).map((p) => ({
    ts: p.t,
    equity: p.value,
    drawdown: 0,
    drawdownPct: 0,
  }));

  const hasWf = (chartData?.wf_equity_curve?.length ?? 0) > 0;
  const hasSlippage = Object.keys(paper.robustness.slippage_sensitivity).length > 0;
  const hasRegime = Object.keys(paper.robustness.regime_breakdown).length > 0;
  const hasAuditNotes = !!best?.quant_audit_notes;
  const hasJournal = paper.journal_entries.length > 0;
  const hasParams = best && Object.keys(best.params).length > 0;

  // Figure counter
  let figNum = 0;
  const nextFig = () => `Figure ${++figNum}.`;

  // Section counter
  let secNum = 0;
  const nextSec = () => `${++secNum}.`;

  const tocItems = [
    { id: 'abstract', label: '1. Abstract' },
    ...(best ? [{ id: 'metrics', label: '2. Key Results' }] : []),
    { id: 'equity', label: `${best ? 3 : 2}. Equity Curve` },
    { id: 'monthly', label: `${best ? 4 : 3}. Monthly Returns` },
    { id: 'trades', label: `${best ? 5 : 4}. Trade P&L` },
    ...(hasWf ? [{ id: 'walk-forward', label: 'Walk-Forward' }] : []),
    { id: 'gates', label: 'Stat. Gates' },
    ...(hasParams ? [{ id: 'parameters', label: 'Parameters ▸' }] : []),
    ...(paper.top_iterations.length > 0 ? [{ id: 'iterations', label: 'Iterations ▸' }] : []),
    ...(hasSlippage || hasRegime ? [{ id: 'robustness', label: 'Robustness ▸' }] : []),
    ...(hasAuditNotes || hasJournal ? [{ id: 'notes', label: 'Notes ▸' }] : []),
    ...(paper.citations.length > 0 ? [{ id: 'references', label: 'References ▸' }] : []),
  ];

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link
          href="/research/papers"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={12} /> Research library
        </Link>
        <div className="flex items-center gap-2">
          <PaperActionButtons paper={paper} />
          <RegenerateButton paperId={id} queueId={paper.queue_id} currentVersion={paper.version} />
          <ExportButtons paperId={id} />
        </div>
      </div>

      {/* Paper document */}
      <div className="rounded-xl border border-bd-subtle bg-bg-surface shadow-xl shadow-black/20">
        <div className="flex items-start gap-0">

          {/* Sticky sidebar ToC */}
          <aside className="hidden w-44 shrink-0 lg:block print:hidden">
            <div className="sticky top-4 px-4 py-6">
              <p className="mb-3 text-[9px] font-semibold uppercase tracking-widest text-text-muted">
                Contents
              </p>
              <nav className="space-y-0.5">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Divider */}
          <div className="hidden w-px self-stretch bg-bd-subtle lg:block" />

          {/* Main content — paper body */}
          <div className="min-w-0 flex-1 px-8 py-8 lg:px-12">

            {/* Paper masthead */}
            <header className="mb-8 space-y-3 border-b border-bd-subtle pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-text-muted">{paper.paper_id}</span>
                <span className="font-mono text-[10px] text-text-muted">· v{paper.version}</span>
                <span
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    color: toneColor(statusTone(paper.paper_status)),
                  }}
                >
                  {paper.paper_status === 'WORKING_PAPER' ? 'Working Paper' : 'Finalized'}
                </span>
                {meta.final_verdict && (
                  <span
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: toneColor(verdictTone(meta.final_verdict)),
                    }}
                  >
                    {meta.final_verdict.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <h1 className="font-display text-[24px] font-semibold leading-snug tracking-tight text-text-primary">
                {paper.title}
              </h1>

              <p className="text-[11px] text-text-muted">
                {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
                {meta.n_iterations > 0 && ` · ${meta.n_iterations} iterations`}
                {paper.created_by && ` · ${paper.created_by}`}
                {` · ${formatDate(parseIsoUtc(paper.created_time))}`}
              </p>
            </header>

            {/* Sections */}
            <div className="space-y-10">

              {/* 1. Abstract */}
              <Section id="abstract" num={nextSec()} title="Abstract">
                {paper.abstract ? (
                  <p className="text-[14px] leading-relaxed text-text-secondary">{paper.abstract}</p>
                ) : (
                  <p className="text-[12px] italic text-text-muted">Abstract not yet generated.</p>
                )}
                {meta.hypothesis && (
                  <blockquote className="mt-2 border-l-2 border-bd-subtle pl-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Hypothesis
                    </p>
                    <p className="mt-1 text-[13px] italic leading-relaxed text-text-secondary">
                      {meta.hypothesis}
                    </p>
                  </blockquote>
                )}
              </Section>

              {/* 2. Key results */}
              {best && (
                <Section id="metrics" num={nextSec()} title="Key Results">
                  <MetricsRow m={best.metrics} />
                  {best.statistical_verdict && (
                    <p className="text-[11px] text-text-muted">
                      Best iteration #{best.iteration_number ?? '—'} ·{' '}
                      <span style={{ color: toneColor(verdictTone(best.statistical_verdict)) }}>
                        {best.statistical_verdict.replace(/_/g, ' ')}
                      </span>
                    </p>
                  )}
                </Section>
              )}

              {/* 3. Equity curve */}
              <Section id="equity" num={nextSec()} title="Equity Curve">
                <Figure
                  num={nextFig()}
                  caption={`Normalised equity (base 100) · ${meta.instrument} ${meta.interval_name}`}
                >
                  {chartLoading ? (
                    <Skeleton className="h-60 w-full" />
                  ) : chartData?.equity_curve.length ? (
                    <PaperEquityCurveChart curve={chartData.equity_curve} height={240} gradientId="is" />
                  ) : (
                    <div className="flex h-60 items-center justify-center text-[12px] text-text-muted">
                      {chartData
                        ? 'No equity data stored.'
                        : 'Chart data not available — paper may still be generating.'}
                    </div>
                  )}
                </Figure>
              </Section>

              {/* 4. Monthly returns */}
              <Section id="monthly" num={nextSec()} title="Monthly Returns">
                <Figure num={nextFig()} caption="Monthly return heatmap (in-sample)">
                  {chartLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : equityPoints.length >= 2 ? (
                    <BacktestMonthlyReturns points={equityPoints} />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-[12px] text-text-muted">
                      {chartData ? 'Not enough data points.' : 'Awaiting chart data.'}
                    </div>
                  )}
                </Figure>
              </Section>

              {/* 5. Trade P&L */}
              <Section id="trades" num={nextSec()} title="Trade P&L Distribution">
                <Figure num={nextFig()} caption="Per-trade P&L (%) — chronological order">
                  {chartLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : chartData?.trades.length ? (
                    <PaperTradeHistogram trades={chartData.trades} height={200} />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-[12px] text-text-muted">
                      {chartData ? 'No trade data stored.' : 'Awaiting chart data.'}
                    </div>
                  )}
                </Figure>
              </Section>

              {/* 6. Walk-forward (always visible if present) */}
              {hasWf && (
                <Section id="walk-forward" num={nextSec()} title="Walk-Forward Performance">
                  <Figure
                    num={nextFig()}
                    caption="In-sample equity (green) vs walk-forward out-of-sample (blue)"
                  >
                    <PaperEquityCurveChart
                      curve={chartData!.equity_curve}
                      wfCurve={chartData!.wf_equity_curve}
                      height={240}
                      gradientId="wf"
                    />
                  </Figure>
                </Section>
              )}

              {/* 7. Statistical gates */}
              <Section id="gates" num={nextSec()} title="Statistical Gate Results">
                <StatGatesTable gate={paper.verdict_gate} />
              </Section>

              {/* ── Extended sections (collapsible) ── */}

              {/* Best parameters */}
              {hasParams && (
                <CollapsibleSection
                  id="parameters"
                  num={nextSec()}
                  title="Best Parameters"
                  summary={`${Object.keys(best!.params).length} params · iteration #${best!.iteration_number ?? '—'}`}
                >
                  <ParamsTable params={best!.params} />
                </CollapsibleSection>
              )}

              {/* Top iterations */}
              {paper.top_iterations.length > 0 && (
                <CollapsibleSection
                  id="iterations"
                  num={nextSec()}
                  title="Top Iterations"
                  summary={`${paper.top_iterations.length} configurations ranked by CAGR`}
                >
                  <TopIterationsTable rows={paper.top_iterations} />
                </CollapsibleSection>
              )}

              {/* Robustness */}
              {(hasSlippage || hasRegime) && (
                <CollapsibleSection
                  id="robustness"
                  num={nextSec()}
                  title="Robustness"
                  summary={[hasSlippage && 'slippage sensitivity', hasRegime && 'regime breakdown'].filter(Boolean).join(' · ')}
                >
                  {hasSlippage && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Slippage sensitivity
                      </p>
                      <ObjectTable data={paper.robustness.slippage_sensitivity} />
                    </div>
                  )}
                  {hasRegime && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Regime breakdown
                      </p>
                      <ObjectTable data={paper.robustness.regime_breakdown} />
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* Research notes */}
              {(hasAuditNotes || hasJournal) && (
                <CollapsibleSection
                  id="notes"
                  num={nextSec()}
                  title="Research Notes"
                  summary={[
                    hasAuditNotes && 'quant audit',
                    hasJournal && `${paper.journal_entries.length} journal entr${paper.journal_entries.length === 1 ? 'y' : 'ies'}`,
                  ].filter(Boolean).join(' · ')}
                >
                  {hasAuditNotes && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Quant audit notes
                      </p>
                      <p className="whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                        {best!.quant_audit_notes}
                      </p>
                    </div>
                  )}
                  {hasJournal && (
                    <div className="space-y-4">
                      {paper.journal_entries.map((e) => (
                        <JournalCard key={e.journal_id} entry={e} />
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* References */}
              {paper.citations.length > 0 && (
                <CollapsibleSection
                  id="references"
                  num={nextSec()}
                  title="References"
                  summary={`${paper.citations.length} citation${paper.citations.length === 1 ? '' : 's'}`}
                >
                  <ol className="space-y-2 list-decimal list-inside">
                    {paper.citations.map((c) => (
                      <li key={c.key} className="text-[12px] leading-relaxed text-text-secondary">
                        {c.text}
                      </li>
                    ))}
                  </ol>
                </CollapsibleSection>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
