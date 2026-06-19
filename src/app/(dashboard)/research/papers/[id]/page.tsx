'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButtons } from '@/components/research/papers/ExportButtons';
import { PaperActionButtons } from '@/components/research/papers/PaperActionButtons';
import { PaperChapters } from '@/components/research/papers/PaperChapters';
import { RegenerateButton } from '@/components/research/papers/RegenerateButton';
import { getPaper, getPaperChartData } from '@/lib/api/researchPapers';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { toneColor, type Tone } from '@/lib/tones';
import type { BestIteration, PaperDetail } from '@/types/papers';
import type { BacktestEquityPoint } from '@/types/backtest';

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
      <p className="text-[14px] text-text-muted">
        No research paper found with ID <span className="font-mono">{id}</span>.
      </p>
      <Link
        href="/research/papers"
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-primary)] hover:underline"
      >
        <ArrowLeft size={12} /> Back to library
      </Link>
    </div>
  );
}

export default function PaperPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const {
    data: paper,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['paper', id],
    queryFn: () => getPaper(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const {
    data: chartData,
    isLoading: chartLoading,
    isError: chartError,
  } = useQuery({
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
    // research-paper curves carry no BTC/USDT split → composition stays hidden
    cashBalance: 0,
    assetValue: 0,
  }));

  const hasSlippage = Object.keys(paper.robustness.slippage_sensitivity).length > 0;
  const hasRegime = Object.keys(paper.robustness.regime_breakdown).length > 0;
  const hasAuditNotes = !!best?.quant_audit_notes;
  const hasJournal = paper.journal_entries.length > 0;
  const hasParams = !!best && Object.keys(best.params).length > 0;
  const hasAdditional =
    hasParams ||
    paper.top_iterations.length > 0 ||
    hasSlippage ||
    hasRegime ||
    hasAuditNotes ||
    hasJournal;

  const tocItems = [
    ...(paper.abstract ? [{ id: 'abstract', label: 'Abstract' }] : []),
    ...paper.sections.map((s) => ({
      id: `chapter-${s.chapter}`,
      label: `${s.chapter}. ${s.title}`,
    })),
    ...(hasAdditional ? [{ id: 'additional-info', label: 'Additional Information' }] : []),
    ...(paper.citations.length > 0 ? [{ id: 'references', label: 'References' }] : []),
  ];

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link
          href="/research/papers"
          className="inline-flex items-center gap-1.5 text-[14px] text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={12} /> Research library
        </Link>
        <div className="flex items-center gap-2">
          <PaperActionButtons paper={paper} />
          <RegenerateButton paperId={id} queueId={paper.queue_id} currentVersion={paper.version} />
          <ExportButtons paperId={id} paper={paper} />
        </div>
      </div>

      {/* Paper document */}
      <div className="rounded-xl border border-bd-subtle bg-bg-surface shadow-xl shadow-black/20">
        <div className="flex items-start gap-0">
          {/* Sticky sidebar ToC */}
          <aside className="hidden w-44 shrink-0 lg:block print:hidden">
            <div className="sticky top-4 px-4 py-6">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-text-muted">
                Contents
              </p>
              <nav className="space-y-0.5">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded px-2 py-1 text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
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
                <span className="font-mono text-[12px] text-text-muted">{paper.paper_id}</span>
                <span className="font-mono text-[12px] text-text-muted">· v{paper.version}</span>
                <span
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: toneColor(statusTone(paper.paper_status)),
                  }}
                >
                  {paper.paper_status === 'WORKING_PAPER' ? 'Working Paper' : 'Finalized'}
                </span>
                {meta.final_verdict && (
                  <span
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-wider"
                    style={{
                      background: 'var(--bg-elevated)',
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

              <p className="text-[13px] text-text-muted">
                {meta.strategy_code} · {meta.instrument} · {meta.interval_name}
                {meta.n_iterations > 0 && ` · ${meta.n_iterations} iterations`}
                {paper.created_by && ` · ${paper.created_by}`}
                {` · ${formatDate(parseIsoUtc(paper.created_time))}`}
              </p>
            </header>

            <PaperChapters
              paper={paper}
              chartData={chartData}
              chartLoading={chartLoading}
              chartError={chartError}
              equityPoints={equityPoints}
              hasAdditional={hasAdditional}
              hasParams={hasParams}
              hasSlippage={hasSlippage}
              hasRegime={hasRegime}
              hasAuditNotes={hasAuditNotes}
              hasJournal={hasJournal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
