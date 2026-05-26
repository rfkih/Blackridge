'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButtons } from '@/components/research/papers/ExportButtons';
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
// Section shell
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  children,
  className = '',
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-4 space-y-3 ${className}`}>
      <div className="border-b border-bd-subtle pb-1.5">
        <h2 className="font-display text-[14px] font-semibold uppercase tracking-widest text-text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="border-b border-bd-subtle px-4 py-2.5">
        <h3 className="font-display text-[12px] font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="px-2 pb-2 pt-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric grid
// ---------------------------------------------------------------------------

function MetricCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p
        className="font-display text-[18px] font-semibold tabular-nums leading-none text-text-primary"
        style={tone ? { color: toneColor(tone) } : undefined}
      >
        {value}
      </p>
      {sub && <p className="font-mono text-[10px] text-text-muted">{sub}</p>}
    </div>
  );
}

function MetricsGrid({ m }: { m: BestIterationMetrics }) {
  const dd = m.max_drawdown_pct;
  const ddTone: Tone = dd != null && dd < -15 ? 'loss' : dd != null && dd < -8 ? 'warning' : 'muted';

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
      <MetricCell
        label="CAGR"
        value={fmt(m.cagr, 1, '%')}
        tone={m.cagr != null && m.cagr >= 10 ? 'profit' : 'warning'}
      />
      <MetricCell
        label="Profit Factor"
        value={fmt(m.profit_factor)}
        sub={
          m.pf_ci_low != null && m.pf_ci_high != null
            ? `CI [${fmt(m.pf_ci_low)}, ${fmt(m.pf_ci_high)}]`
            : undefined
        }
        tone={m.profit_factor != null && m.profit_factor > 1 ? 'profit' : 'loss'}
      />
      <MetricCell label="DSR" value={fmt(m.dsr, 3)} tone={m.dsr != null && m.dsr >= 0.95 ? 'profit' : 'warning'} />
      <MetricCell label="Max Drawdown" value={fmt(dd, 1, '%')} tone={ddTone} />
      <MetricCell label="Sharpe" value={fmt(m.sharpe_ratio)} />
      <MetricCell label="Trades" value={m.trade_count?.toString() ?? '—'} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parameters table
// ---------------------------------------------------------------------------

function ParamsTable({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params);
  if (!entries.length) return <p className="text-[12px] text-text-muted">No parameters recorded.</p>;
  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle">
      <table className="w-full text-[11px]">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-bd-subtle last:border-0">
              <td className="w-1/2 bg-bg-base px-3 py-1.5 font-mono text-text-secondary">{k}</td>
              <td className="px-3 py-1.5 font-mono tabular-nums text-text-primary">
                {String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top iterations table
// ---------------------------------------------------------------------------

function TopIterationsTable({ rows }: { rows: TopIteration[] }) {
  if (!rows.length) return <p className="text-[12px] text-text-muted">No iterations recorded.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-bd-subtle">
      <table className="w-full min-w-[640px] text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle bg-bg-base">
            {['#', 'CAGR', 'PF', 'PF CI low', 'DSR', 'Max DD', 'Trades', 'Verdict'].map((h) => (
              <th
                key={h}
                className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-bd-subtle bg-bg-surface last:border-0 hover:bg-bg-hover">
              <td className="px-2.5 py-1.5 font-mono text-text-muted">{r.iteration_number ?? i + 1}</td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums"
                style={{ color: r.cagr != null && r.cagr >= 10 ? toneColor('profit') : toneColor('muted') }}>
                {fmt(r.cagr, 1, '%')}
              </td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums text-text-primary">{fmt(r.profit_factor)}</td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums text-text-secondary">{fmt(r.pf_ci_low)}</td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums text-text-secondary">{fmt(r.dsr, 3)}</td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums text-text-secondary">{fmt(r.max_drawdown_pct, 1, '%')}</td>
              <td className="px-2.5 py-1.5 font-mono tabular-nums text-text-secondary">{r.trade_count ?? '—'}</td>
              <td className="px-2.5 py-1.5">
                {r.verdict && (
                  <span
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                    style={{ background: 'rgba(0,0,0,0.25)', color: toneColor(verdictTone(r.verdict)) }}
                  >
                    {r.verdict}
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
// Statistical gates checklist
// ---------------------------------------------------------------------------

function GateRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {ok ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: toneColor('profit') }} />
      ) : (
        <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: toneColor('loss') }} />
      )}
      <div className="min-w-0">
        <span className="text-[12px] text-text-primary">{label}</span>
        <span className="ml-2 font-mono text-[11px] text-text-muted">{detail}</span>
      </div>
    </div>
  );
}

function StatGates({ gate }: { gate: VerdictGate }) {
  return (
    <div className="divide-y divide-bd-subtle rounded-xl border border-bd-subtle bg-bg-surface px-4">
      <GateRow
        ok={gate.n_trades_ok}
        label={`Trades ≥ ${gate.n_trades_threshold}`}
        detail={`actual: ${gate.n_trades_value}`}
      />
      <GateRow
        ok={gate.pf_ci_ok}
        label="PF 95% CI lower > 1.0"
        detail={`actual: ${gate.pf_ci_low != null ? gate.pf_ci_low.toFixed(2) : '—'}`}
      />
      <GateRow
        ok={gate.dsr_ok}
        label={`DSR ≥ ${gate.dsr_threshold}`}
        detail={`actual: ${gate.dsr_value != null ? gate.dsr_value.toFixed(3) : '—'}`}
      />
      <GateRow
        ok={gate.stat_verdict_ok}
        label="Statistical verdict: SIGNIFICANT_EDGE"
        detail={gate.stat_verdict ?? '—'}
      />
      <GateRow
        ok={gate.cagr_ok}
        label={`CAGR ≥ ${gate.cagr_threshold}% (90% Kelly, annualised)`}
        detail={`actual: ${gate.cagr_value != null ? gate.cagr_value.toFixed(1) + '%' : '—'}`}
      />
      <div className="flex items-center gap-2 py-2.5">
        <span
          className="rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: 'rgba(0,0,0,0.3)',
            color: toneColor(gate.all_gates_passed ? 'profit' : 'loss'),
          }}
        >
          {gate.all_gates_passed ? 'All gates cleared' : 'Gates failed'}
        </span>
      </div>
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
    <div className="overflow-hidden rounded-md border border-bd-subtle">
      <table className="w-full text-[11px]">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-bd-subtle last:border-0">
              <td className="w-1/3 bg-bg-base px-3 py-1.5 font-mono text-text-secondary">{k}</td>
              <td className="px-3 py-1.5 font-mono tabular-nums text-text-primary">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

function JournalCard({ entry }: { entry: PaperJournalEntry }) {
  return (
    <div className="rounded-lg border border-bd-subtle bg-bg-surface p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-text-muted">
          {entry.entry_type.replace(/_/g, ' ')}
        </span>
        <span className="font-mono text-[9px] text-text-muted">
          {formatDate(parseIsoUtc(entry.created_time))}
        </span>
      </div>
      <p className="text-[13px] font-semibold text-text-primary">{entry.title}</p>
      <p className="text-[12px] leading-relaxed text-text-secondary whitespace-pre-line">{entry.content}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

function CitationList({ citations }: { citations: PaperCitation[] }) {
  return (
    <ol className="space-y-2 list-decimal list-inside">
      {citations.map((c) => (
        <li key={c.key} className="text-[12px] leading-relaxed text-text-secondary">
          {c.text}
        </li>
      ))}
    </ol>
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
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
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

  const tocItems = [
    { id: 'abstract', label: 'Abstract' },
    ...(best ? [{ id: 'metrics', label: 'Key Metrics' }] : []),
    { id: 'equity', label: 'Equity Curve' },
    { id: 'monthly', label: 'Monthly Returns' },
    { id: 'trades', label: 'Trade P&L' },
    ...(hasWf ? [{ id: 'walk-forward', label: 'Walk-Forward' }] : []),
    ...(best && Object.keys(best.params).length > 0 ? [{ id: 'parameters', label: 'Parameters' }] : []),
    ...(paper.top_iterations.length > 0 ? [{ id: 'iterations', label: 'Top Iterations' }] : []),
    { id: 'gates', label: 'Stat. Gates' },
    ...(hasSlippage || hasRegime ? [{ id: 'robustness', label: 'Robustness' }] : []),
    ...(hasAuditNotes || hasJournal ? [{ id: 'notes', label: 'Research Notes' }] : []),
    ...(paper.citations.length > 0 ? [{ id: 'references', label: 'References' }] : []),
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
          <RegenerateButton paperId={id} queueId={paper.queue_id} currentVersion={paper.version} />
          <ExportButtons paperId={id} />
        </div>
      </div>

      {/* Paper header */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-text-muted">{paper.paper_id}</span>
          <span className="font-mono text-[10px] text-text-muted">v{paper.version}</span>
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
            style={{
              background: 'rgba(0,0,0,0.25)',
              color: toneColor(statusTone(paper.paper_status)),
            }}
          >
            {paper.paper_status === 'WORKING_PAPER' ? 'Working Paper' : 'Finalized'}
          </span>
          {meta.final_verdict && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
              style={{
                background: 'rgba(0,0,0,0.25)',
                color: toneColor(verdictTone(meta.final_verdict)),
              }}
            >
              {meta.final_verdict.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <h1 className="font-display text-[22px] font-semibold leading-snug tracking-tight text-text-primary">
          {paper.title}
        </h1>
        <p className="text-[11px] text-text-muted">
          {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
          {meta.n_iterations > 0 && ` · ${meta.n_iterations} iterations`}
          {paper.created_by && ` · ${paper.created_by}`}
          {` · ${formatDate(parseIsoUtc(paper.created_time))}`}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex items-start gap-8">
        {/* Sticky sidebar ToC — desktop only */}
        <aside className="hidden w-40 shrink-0 lg:block print:hidden">
          <div className="sticky top-4 space-y-0.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Contents
            </p>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-sm px-2 py-1 text-[12px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-10">

          {/* 1. Abstract */}
          <Section id="abstract" title="Abstract">
            {paper.abstract ? (
              <p className="text-[14px] leading-relaxed text-text-secondary">{paper.abstract}</p>
            ) : (
              <p className="text-[12px] text-text-muted">Abstract not yet generated.</p>
            )}
            {meta.hypothesis && (
              <div className="mt-3 rounded-md border border-bd-subtle bg-bg-base px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Hypothesis
                </p>
                <p className="mt-1 text-[13px] italic text-text-secondary">{meta.hypothesis}</p>
              </div>
            )}
          </Section>

          {/* 2. Key metrics */}
          {best && (
            <Section id="metrics" title="Key Metrics">
              <MetricsGrid m={best.metrics} />
            </Section>
          )}

          {/* 3. Equity curve */}
          <Section id="equity" title="Equity Curve">
            <ChartPanel title={`Normalised equity (base 100) · ${meta.instrument} ${meta.interval_name}`}>
              {chartLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : chartData?.equity_curve.length ? (
                <PaperEquityCurveChart
                  curve={chartData.equity_curve}
                  height={240}
                  gradientId="is"
                />
              ) : (
                <div className="flex h-60 items-center justify-center text-[12px] text-text-muted">
                  {chartData ? 'No equity data stored.' : 'Chart data not available — paper may still be generating.'}
                </div>
              )}
            </ChartPanel>
          </Section>

          {/* 4. Monthly returns */}
          <Section id="monthly" title="Monthly Returns">
            {chartLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : equityPoints.length >= 2 ? (
              <BacktestMonthlyReturns points={equityPoints} />
            ) : (
              <p className="text-[12px] text-text-muted">
                {chartData ? 'Not enough data points for monthly breakdown.' : 'Awaiting chart data.'}
              </p>
            )}
          </Section>

          {/* 5. Trade P&L distribution */}
          <Section id="trades" title="Trade P&L Distribution">
            <ChartPanel title="Per-trade P&L (%) — chronological">
              {chartLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : chartData?.trades.length ? (
                <PaperTradeHistogram trades={chartData.trades} height={200} />
              ) : (
                <div className="flex h-48 items-center justify-center text-[12px] text-text-muted">
                  {chartData ? 'No trade data stored.' : 'Awaiting chart data.'}
                </div>
              )}
            </ChartPanel>
          </Section>

          {/* 6. Walk-forward (conditional) */}
          {hasWf && (
            <Section id="walk-forward" title="Walk-Forward Performance">
              <ChartPanel title="In-sample (green) vs walk-forward OOS (blue)">
                <PaperEquityCurveChart
                  curve={chartData!.equity_curve}
                  wfCurve={chartData!.wf_equity_curve}
                  height={240}
                  gradientId="wf"
                />
              </ChartPanel>
            </Section>
          )}

          {/* 7. Best parameters */}
          {best && Object.keys(best.params).length > 0 && (
            <Section id="parameters" title="Best Parameters">
              <p className="text-[11px] text-text-muted">
                Iteration #{best.iteration_number ?? '—'} ·{' '}
                {best.statistical_verdict?.replace(/_/g, ' ') ?? 'Not assessed'}
              </p>
              <ParamsTable params={best.params} />
            </Section>
          )}

          {/* 8. Top iterations */}
          {paper.top_iterations.length > 0 && (
            <Section id="iterations" title="Top Iterations">
              <p className="text-[11px] text-text-muted">
                Top {paper.top_iterations.length} configurations ranked by CAGR.
              </p>
              <TopIterationsTable rows={paper.top_iterations} />
            </Section>
          )}

          {/* 9. Statistical gates */}
          <Section id="gates" title="Statistical Gate Results">
            <StatGates gate={paper.verdict_gate} />
          </Section>

          {/* 10. Robustness */}
          {(hasSlippage || hasRegime) && (
            <Section id="robustness" title="Robustness">
              {hasSlippage && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Slippage sensitivity
                  </h3>
                  <ObjectTable data={paper.robustness.slippage_sensitivity} />
                </div>
              )}
              {hasRegime && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Regime breakdown
                  </h3>
                  <ObjectTable data={paper.robustness.regime_breakdown} />
                </div>
              )}
            </Section>
          )}

          {/* 11. Research notes */}
          {(hasAuditNotes || hasJournal) && (
            <Section id="notes" title="Research Notes">
              {hasAuditNotes && (
                <div className="rounded-md border border-bd-subtle bg-bg-base p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Quant audit notes
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                    {best!.quant_audit_notes}
                  </p>
                </div>
              )}
              {hasJournal && (
                <div className="space-y-3">
                  <p className="text-[11px] text-text-muted">
                    {paper.journal_entries.length} journal entr
                    {paper.journal_entries.length === 1 ? 'y' : 'ies'} for{' '}
                    {meta.strategy_code} · {meta.instrument}
                  </p>
                  {paper.journal_entries.map((e) => (
                    <JournalCard key={e.journal_id} entry={e} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* 12. References */}
          {paper.citations.length > 0 && (
            <Section id="references" title="References">
              <CitationList citations={paper.citations} />
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}
