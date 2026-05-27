'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toneColor } from '@/lib/tones';
import type {
  BestIteration,
  ChartData,
  PaperDetail,
  PaperSection,
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

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface PaperChaptersProps {
  paper: PaperDetail;
  chartData: ChartData | undefined;
  chartLoading: boolean;
  chartError: boolean;
  equityPoints: BacktestEquityPoint[];
  hasAdditional: boolean;
  hasParams: boolean;
  hasSlippage: boolean;
  hasRegime: boolean;
  hasAuditNotes: boolean;
  hasJournal: boolean;
}

export function PaperChapters({
  paper,
  chartData,
  chartLoading,
  chartError,
  equityPoints,
  hasAdditional,
  hasParams,
  hasSlippage,
  hasRegime,
  hasAuditNotes,
  hasJournal,
}: PaperChaptersProps) {
  const sections = paper.sections;
  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;
  const meta = paper.metadata;
  const hasWf = !!chartData?.wf_equity_curve?.length;

  const resultsIdx = sections.findIndex((s) => s.title.toLowerCase().includes('result'));
  const chartsAfterIdx = resultsIdx !== -1 ? resultsIdx : sections.length - 1;

  return (
    <div className="space-y-10">
      {paper.abstract && (
        <div id="abstract" className="rounded-sm border border-bd-subtle bg-bg-base p-4">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Abstract
          </p>
          <p className="text-[13px] italic leading-relaxed text-text-secondary">{paper.abstract}</p>
          {meta.hypothesis && (
            <blockquote className="mt-3 border-l-2 border-bd-subtle pl-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Hypothesis
              </p>
              <p className="mt-1 text-[12px] italic leading-relaxed text-text-secondary">
                {meta.hypothesis}
              </p>
            </blockquote>
          )}
        </div>
      )}

      {sections.map((section, idx) => (
        <div key={section.chapter} id={`chapter-${section.chapter}`}>
          <ChapterSection section={section} />
          {idx === chartsAfterIdx && (
            <ChartsBlock
              meta={meta}
              chartData={chartData}
              chartLoading={chartLoading}
              chartError={chartError}
              equityPoints={equityPoints}
              hasWf={hasWf}
            />
          )}
        </div>
      ))}

      {hasAdditional && (
        <AdditionalInfo
          paper={paper}
          best={best}
          hasParams={hasParams}
          hasSlippage={hasSlippage}
          hasRegime={hasRegime}
          hasAuditNotes={hasAuditNotes}
          hasJournal={hasJournal}
        />
      )}

      {paper.citations.length > 0 && (
        <div id="references">
          <h2 className="mb-4 font-display text-[17px] font-semibold tracking-tight text-text-primary">
            References
          </h2>
          <ol className="list-inside list-decimal space-y-2">
            {paper.citations.map((c) => (
              <li key={c.key} className="text-[12px] leading-relaxed text-text-secondary">
                {c.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterSection
// ---------------------------------------------------------------------------

function ChapterSection({ section }: { section: PaperSection }) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-[18px] font-semibold tracking-tight text-text-primary">
        {section.chapter}. {section.title}
      </h2>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-text-primary">
          {para}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartsBlock
// ---------------------------------------------------------------------------

interface ChartsBlockProps {
  meta: PaperDetail['metadata'];
  chartData: ChartData | undefined;
  chartLoading: boolean;
  chartError: boolean;
  equityPoints: BacktestEquityPoint[];
  hasWf: boolean;
}

function chartPlaceholder(
  loading: boolean,
  error: boolean,
  hasData: boolean,
  empty: string,
): string {
  if (loading) return 'Awaiting chart data…';
  if (error) return 'Chart data failed to load.';
  if (hasData) return empty;
  return 'Chart data not yet available.';
}

function ChartsBlock({
  meta,
  chartData,
  chartLoading,
  chartError,
  equityPoints,
  hasWf,
}: ChartsBlockProps) {
  let figNum = 0;
  const nextFig = () => `Figure ${++figNum}.`;
  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="mb-1.5 text-center font-mono text-[11px] text-text-muted">
          {nextFig()} Normalised equity curve (base 100) · {meta.instrument} {meta.interval_name}
        </p>
        {chartLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : chartData?.equity_curve.length ? (
          <PaperEquityCurveChart curve={chartData.equity_curve} height={240} gradientId="ch-is" />
        ) : (
          <div className="flex h-60 items-center justify-center text-[12px] text-text-muted">
            {chartPlaceholder(false, chartError, !!chartData, 'No equity data.')}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-center font-mono text-[11px] text-text-muted">
          {nextFig()} Monthly return heatmap (in-sample)
        </p>
        {chartLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : equityPoints.length >= 2 ? (
          <BacktestMonthlyReturns points={equityPoints} />
        ) : (
          <div className="flex h-32 items-center justify-center text-[12px] text-text-muted">
            {chartPlaceholder(false, chartError, !!chartData, 'Not enough data points.')}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-center font-mono text-[11px] text-text-muted">
          {nextFig()} Per-trade P&amp;L (%) — chronological order
        </p>
        {chartLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : chartData?.trades.length ? (
          <PaperTradeHistogram trades={chartData.trades} height={200} />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-text-muted">
            {chartPlaceholder(false, chartError, !!chartData, 'No trade data.')}
          </div>
        )}
      </div>

      {chartLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : hasWf ? (
        <div>
          <p className="mb-1.5 text-center font-mono text-[11px] text-text-muted">
            {nextFig()} In-sample equity (green) vs walk-forward out-of-sample (blue)
          </p>
          <PaperEquityCurveChart
            curve={chartData!.equity_curve}
            wfCurve={chartData!.wf_equity_curve}
            height={240}
            gradientId="ch-wf"
          />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdditionalInfo
// ---------------------------------------------------------------------------

interface AdditionalInfoProps {
  paper: PaperDetail;
  best: BestIteration | null;
  hasParams: boolean;
  hasSlippage: boolean;
  hasRegime: boolean;
  hasAuditNotes: boolean;
  hasJournal: boolean;
}

function AdditionalInfo({
  paper,
  best,
  hasParams,
  hasSlippage,
  hasRegime,
  hasAuditNotes,
  hasJournal,
}: AdditionalInfoProps) {
  const [open, setOpen] = useState(true);

  return (
    <div id="additional-info" className="print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-sm border border-bd-subtle bg-bg-base px-4 py-3 text-left transition-colors hover:bg-bg-hover"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Additional Information
        </span>
        {open ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-6 rounded-sm border border-bd-subtle bg-bg-base p-6">
          <AdditionalSection title="Statistical Gate Results">
            <GatesTable gate={paper.verdict_gate} />
          </AdditionalSection>

          {hasParams && (
            <AdditionalSection
              title={`Best Parameters · iteration #${best!.iteration_number ?? '—'}`}
            >
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(best!.params).map(([k, v]) => (
                    <tr key={k} className="border-b border-bd-subtle last:border-0">
                      <td className="py-1 pr-4 font-mono text-text-secondary">{k}</td>
                      <td className="py-1 font-mono tabular-nums text-text-primary">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdditionalSection>
          )}

          {paper.top_iterations.length > 0 && (
            <AdditionalSection
              title={`Top Iterations · ${paper.top_iterations.length} configs ranked by CAGR`}
            >
              <TopIterTable rows={paper.top_iterations} />
            </AdditionalSection>
          )}

          {(hasSlippage || hasRegime) && (
            <AdditionalSection title="Robustness">
              {hasSlippage && (
                <div className="mb-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Slippage sensitivity
                  </p>
                  <ObjectTable data={paper.robustness.slippage_sensitivity} />
                </div>
              )}
              {hasRegime && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Regime breakdown
                  </p>
                  <ObjectTable data={paper.robustness.regime_breakdown} />
                </div>
              )}
            </AdditionalSection>
          )}

          {(hasAuditNotes || hasJournal) && (
            <AdditionalSection title="Research Notes">
              {hasAuditNotes && (
                <p className="whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                  {best!.quant_audit_notes}
                </p>
              )}
              {hasJournal && (
                <div className="mt-3 space-y-3">
                  {paper.journal_entries.map((e) => (
                    <div key={e.journal_id} className="border-l-2 border-bd-subtle pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {e.entry_type}
                      </p>
                      {e.title && (
                        <p className="text-[12px] font-semibold text-text-primary">{e.title}</p>
                      )}
                      {e.content && (
                        <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                          {e.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AdditionalSection>
          )}
        </div>
      )}
    </div>
  );
}

function AdditionalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GatesTable
// ---------------------------------------------------------------------------

interface GateRow {
  label: string;
  value: string;
  pass: boolean;
}

function buildGateRows(gate: VerdictGate): GateRow[] {
  return [
    {
      label: 'n trades',
      value: String(gate.n_trades_value),
      pass: gate.n_trades_ok,
    },
    {
      label: 'pf ci low',
      value: gate.pf_ci_low != null ? fmt(gate.pf_ci_low) : '—',
      pass: gate.pf_ci_ok,
    },
    {
      label: 'dsr',
      value: gate.dsr_value != null ? fmt(gate.dsr_value, 4) : '—',
      pass: gate.dsr_ok,
    },
    {
      label: 'stat verdict',
      value: gate.stat_verdict ?? '—',
      pass: gate.stat_verdict_ok,
    },
    {
      label: 'cagr',
      value: gate.cagr_value != null ? fmt(gate.cagr_value, 1, '%') : '—',
      pass: gate.cagr_ok,
    },
  ];
}

function GatesTable({ gate }: { gate: VerdictGate }) {
  const rows = buildGateRows(gate);
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-bd-subtle">
          {['Gate', 'Value', 'Result'].map((h) => (
            <th
              key={h}
              className="pb-1 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted last:text-right"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-bd-subtle last:border-0">
            <td className="py-1 font-mono text-text-secondary">{row.label}</td>
            <td className="py-1 font-mono tabular-nums text-text-primary">{row.value}</td>
            <td className="py-1 text-right">
              {row.pass ? (
                <CheckCircle2
                  size={13}
                  className="ml-auto"
                  style={{ color: 'var(--color-profit)' }}
                />
              ) : (
                <XCircle size={13} className="ml-auto" style={{ color: 'var(--color-loss)' }} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// TopIterTable
// ---------------------------------------------------------------------------

function TopIterTable({ rows }: { rows: TopIteration[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle">
            {['#', 'CAGR', 'PF', 'DSR', 'DD', 'Trades', 'Verdict'].map((h) => (
              <th
                key={h}
                className="pb-1 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted first:text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.iteration_number ?? idx} className="border-b border-bd-subtle last:border-0">
              <td className="py-1 font-mono text-text-secondary">{r.iteration_number ?? '—'}</td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.cagr, 1, '%')}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.profit_factor)}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.dsr, 4)}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.max_drawdown_pct, 1, '%')}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {r.trade_count ?? '—'}
              </td>
              <td
                className="py-1 text-right font-mono text-[10px]"
                style={{
                  color: toneColor(
                    r.statistical_verdict === 'SIGNIFICANT_EDGE'
                      ? 'profit'
                      : r.statistical_verdict === 'MARGINAL'
                        ? 'warning'
                        : 'muted',
                  ),
                }}
              >
                {(r.statistical_verdict ?? '—').replace(/_/g, ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectTable
// ---------------------------------------------------------------------------

function ObjectTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="text-[11px] text-text-muted">No data.</p>;
  return (
    <table className="w-full text-[11px]">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-bd-subtle last:border-0">
            <td className="py-1 pr-4 font-mono text-text-secondary">{k.replace(/_/g, ' ')}</td>
            <td className="py-1 font-mono tabular-nums text-text-primary">
              {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
