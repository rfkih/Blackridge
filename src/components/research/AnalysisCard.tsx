'use client';

import { AlertCircle, Microscope } from 'lucide-react';
import { useBacktestAnalysis } from '@/hooks/useResearch';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatters';
import type {
  AnalysisReport,
  BucketRow,
  Headline,
  MfeCapture,
  TradeSnapshot,
} from '@/types/research';

interface AnalysisCardProps {
  runId: string;
}

/**
 * Renders the backend research analysis for a given backtest run:
 * headline metrics → feature-bucket breakdown → MFE capture → best/worst 5.
 *
 * Lives on the `/backtest/[id]` page under the metrics grid. Does nothing
 * visible while the analysis is unavailable (still-running runs, runs
 * completed before the analyzer shipped).
 */
export function AnalysisCard({ runId }: AnalysisCardProps) {
  const { data, isLoading, isError } = useBacktestAnalysis(runId);

  if (isLoading) {
    return (
      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <CardHeader />
        <div className="p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <CardHeader />
        <div className="flex items-center gap-2 p-6 text-sm text-text-muted">
          <AlertCircle size={14} />
          Analysis not yet available — run may still be in progress.
        </div>
      </section>
    );
  }

  const mfe = data.mfeCapture;
  // The backend serializes with Jackson NON_NULL, so empty reports (zero-trade
  // runs) come back missing `buckets` / `bestTrades` / `worstTrades`. Default
  // every collection before touching it.
  const buckets = data.buckets ?? {};
  const bestTrades = data.bestTrades ?? [];
  const worstTrades = data.worstTrades ?? [];
  const headline = data.headline ?? null;

  if (!headline || (data.tradeCount ?? 0) === 0) {
    return (
      <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
        <CardHeader version={data.strategyVersion} asset={data.asset} interval={data.interval} />
        <div className="p-6 text-sm text-text-muted">
          No trades produced — nothing to diagnose. Widen entry filters or the backtest
          window.
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <CardHeader version={data.strategyVersion} asset={data.asset} interval={data.interval} />

      <div className="space-y-5 p-4 md:p-5">
        <HeadlineRow h={headline} />

        {Object.keys(buckets).length > 0 && (
          <div className="space-y-3">
            <SectionLabel>Feature buckets</SectionLabel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Object.entries(buckets).map(([key, rows]) => (
                <BucketTable key={key} bucketKey={key} rows={rows ?? []} />
              ))}
            </div>
          </div>
        )}

        {mfe && (mfe.winnerCaptureAvg != null || mfe.loserMaeMedian != null) && (
          <div className="space-y-2">
            <SectionLabel>MFE capture / MAE (losers)</SectionLabel>
            <MfeBlock mfe={mfe} />
          </div>
        )}

        {(bestTrades.length > 0 || worstTrades.length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TradesList label="Best 5" trades={bestTrades} tone="profit" />
            <TradesList label="Worst 5" trades={worstTrades} tone="loss" />
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CardHeader({
  version,
  asset,
  interval,
}: {
  version?: string | null;
  asset?: string;
  interval?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
      <h3 className="inline-flex items-center gap-2 font-display text-[13px] font-semibold text-text-primary">
        <Microscope size={14} strokeWidth={1.75} className="text-[var(--accent-primary)]" />
        Research Analysis
      </h3>
      {(version || asset || interval) && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {[version, asset, interval].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="label-caps">
      {children}
    </div>
  );
}

function HeadlineRow({ h }: { h: Headline }) {
  const wrPct = (h.winRate * 100).toFixed(1);
  const avgR = h.avgR.toFixed(2);
  const rTone = h.avgR > 0 ? 'profit' : h.avgR < 0 ? 'loss' : 'neutral';
  const pfStr = h.profitFactor == null ? '∞' : h.profitFactor.toFixed(2);
  const pfTone = h.profitFactor == null || h.profitFactor >= 1 ? 'profit' : 'loss';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
      <Stat label="Trades" value={String(h.tradeCount)} />
      <Stat label="Win rate" value={`${wrPct}%`} tone={h.winRate >= 0.5 ? 'profit' : 'loss'} />
      <Stat label="Profit factor" value={pfStr} tone={pfTone} />
      <Stat label="Avg R" value={avgR} tone={rTone} />
      <Stat label="Net PnL" value={formatSignedUsdt(h.netPnl)} tone={h.netPnl >= 0 ? 'profit' : 'loss'} />
      <Stat label="Max DD" value={formatSignedUsdt(h.maxDrawdown)} tone="loss" />
      <Stat label="Avg win" value={formatSignedUsdt(h.avgWin)} tone="profit" />
      <Stat
        label="Consec losses"
        value={String(h.maxConsecutiveLosses)}
        tone={h.maxConsecutiveLosses >= 5 ? 'loss' : 'neutral'}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss' | 'neutral';
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div
      className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2"
      style={{ minWidth: 0 }}
    >
      <div className="label-caps !text-[9px]">{label}</div>
      <div
        className="num mt-0.5 truncate text-[14px] font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Bucket table ───────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  entry_adx: 'Entry ADX',
  bias_adx: 'Bias (4H) ADX',
  entry_rsi: 'Entry RSI',
  entry_clv: 'Close Location Value',
  entry_rvol: 'Relative Volume',
};

function BucketTable({ bucketKey, rows }: { bucketKey: string; rows: BucketRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-elevated">
      <div className="border-b border-bd-subtle px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
        {BUCKET_LABELS[bucketKey] ?? bucketKey}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
        <div className="label-caps !text-[9px]">Range</div>
        <div className="label-caps !text-[9px] text-right">n</div>
        <div className="label-caps !text-[9px] text-right">WR</div>
        <div className="label-caps !text-[9px] text-right">Total</div>
        {rows.map((row, idx) => {
          const wr = row.winRate * 100;
          const wrColor = row.winRate >= 0.5 ? 'var(--color-profit)' : 'var(--color-loss)';
          const pnlColor =
            row.totalPnl > 0
              ? 'var(--color-profit)'
              : row.totalPnl < 0
                ? 'var(--color-loss)'
                : 'var(--text-muted)';
          return (
            <div key={idx} className="contents font-mono tabular-nums">
              <div className="text-text-secondary">
                [{row.low}, {row.high})
              </div>
              <div className="text-right text-text-primary">{row.count}</div>
              <div className="text-right" style={{ color: wrColor }}>
                {wr.toFixed(0)}%
              </div>
              <div className="text-right" style={{ color: pnlColor }}>
                {row.totalPnl > 0 ? '+' : ''}
                {row.totalPnl.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MFE / MAE ──────────────────────────────────────────────────────────────

function MfeBlock({ mfe }: { mfe: MfeCapture }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <MfeStat
        label="Winner capture avg"
        value={mfe.winnerCaptureAvg != null ? `${(mfe.winnerCaptureAvg * 100).toFixed(0)}%` : '—'}
      />
      <MfeStat
        label="Winner capture min"
        value={mfe.winnerCaptureMin != null ? `${(mfe.winnerCaptureMin * 100).toFixed(0)}%` : '—'}
      />
      <MfeStat
        label="Winner capture max"
        value={mfe.winnerCaptureMax != null ? `${(mfe.winnerCaptureMax * 100).toFixed(0)}%` : '—'}
      />
      <MfeStat
        label="Winner MFE avg"
        value={mfe.winnerMfeAvg != null ? mfe.winnerMfeAvg.toFixed(2) : '—'}
      />
      <MfeStat
        label="Loser MAE avg"
        value={mfe.loserMaeAvg != null ? mfe.loserMaeAvg.toFixed(2) : '—'}
      />
      <MfeStat
        label="Loser MAE median"
        value={mfe.loserMaeMedian != null ? mfe.loserMaeMedian.toFixed(2) : '—'}
      />
    </div>
  );
}

function MfeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-2">
      <div className="label-caps !text-[9px]">{label}</div>
      <div className="num mt-0.5 text-[13px] font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  );
}

// ─── Best / worst trades ────────────────────────────────────────────────────

function TradesList({
  label,
  trades,
  tone,
}: {
  label: string;
  trades: TradeSnapshot[];
  tone: 'profit' | 'loss';
}) {
  if (!trades.length) return null;
  const headerColor = tone === 'profit' ? 'var(--color-profit)' : 'var(--color-loss)';
  return (
    <div className="rounded-sm border border-bd-subtle bg-bg-elevated">
      <div
        className="border-b border-bd-subtle px-3 py-2 font-mono text-[10px] uppercase tracking-wider"
        style={{ color: headerColor }}
      >
        {label}
      </div>
      <div className="divide-y divide-bd-subtle">
        {trades.map((t) => (
          <TradeRow key={t.tradeId} t={t} />
        ))}
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: TradeSnapshot }) {
  const pnlColor = t.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  return (
    <div className="px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-text-muted">
          {t.entryTime != null ? formatDate(Date.parse(t.entryTime)) : '—'}
        </span>
        <span className="font-mono tabular-nums" style={{ color: pnlColor }}>
          {t.pnl >= 0 ? '+' : ''}
          {t.pnl.toFixed(2)} · {t.r != null ? `${t.r.toFixed(2)} R` : '—'}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono tabular-nums text-text-muted">
        {t.entryAdx != null && <span>ADX {t.entryAdx.toFixed(1)}</span>}
        {t.biasAdx != null && <span>bADX {t.biasAdx.toFixed(1)}</span>}
        {t.entryRsi != null && <span>RSI {t.entryRsi.toFixed(1)}</span>}
        {t.entryClv != null && <span>CLV {t.entryClv.toFixed(2)}</span>}
        {t.entryRvol != null && <span>rvol {t.entryRvol.toFixed(2)}</span>}
        {t.mfeR != null && <span>MFE {t.mfeR.toFixed(2)}</span>}
        {t.maeR != null && <span>MAE {t.maeR.toFixed(2)}</span>}
        {t.exitReason && <span>{t.exitReason}</span>}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSignedUsdt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(2)}`;
}
