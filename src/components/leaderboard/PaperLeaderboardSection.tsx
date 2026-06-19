'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RequestApprovalDialog,
  type ApprovalTarget,
} from '@/components/leaderboard/RequestApprovalDialog';
import { getPaper } from '@/lib/api/researchPapers';
import { toNumOrNull } from '@/lib/api/coerce';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { isHedging } from '@/lib/strategyKind';
import { KindBadge } from '@/components/leaderboard/KindBadge';
import type { BestIteration, PaperRow } from '@/types/papers';

interface PaperLeaderboardSectionProps {
  papers: PaperRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * Parse the strategy code out of a canonical paper id. Documented format:
 * `BH-{CODE}-{SYMBOL}-{INTERVAL}-{hash}`, e.g. `BH-DCB-ETHUSDT-1H-aa657443`
 * → `DCB`. Returns null when the id doesn't match (caller falls back to the
 * row's own `strategy_code`, then disables approval if both are missing).
 */
export function paperCodeFromId(paperId: string): string | null {
  if (!paperId) return null;
  const parts = paperId.split('-');
  // Need at least BH / CODE / SYMBOL / INTERVAL / hash.
  if (parts.length < 5) return null;
  if (parts[0].toUpperCase() !== 'BH') return null;
  const code = parts[1];
  return code && /^[A-Za-z0-9_]+$/.test(code) ? code.toUpperCase() : null;
}

// PaperRow metric fields are TYPED number|null but arrive as strings off the
// orchestrator (Postgres NUMERIC → JSON string), so coerce before toFixed —
// otherwise "12.34".toFixed crashes the render (the working PaperCard does the
// same Number() coercion). Accept number|string|null and run through toNumOrNull.
function fmtPct(v: number | string | null | undefined, digits = 1): string {
  const n = toNumOrNull(v);
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  const n = toNumOrNull(v);
  if (n == null) return '—';
  return n.toFixed(digits);
}

function isBestIteration(v: BestIteration | Record<string, never>): v is BestIteration {
  return 'backtest_run_id' in v;
}

export function PaperLeaderboardSection({
  papers,
  isLoading,
  isError,
  onRetry,
}: PaperLeaderboardSectionProps) {
  const [target, setTarget] = useState<ApprovalTarget | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function handleRequestApproval(paper: PaperRow) {
    const code = paper.strategy_code || paperCodeFromId(paper.paper_id);
    if (!code) {
      toast.error({
        title: 'Cannot request approval',
        description: 'Could not determine the strategy code for this paper.',
      });
      return;
    }
    setResolvingId(paper.paper_id);
    try {
      const detail = await getPaper(paper.paper_id);
      const best = detail.best_iteration;
      const runId = isBestIteration(best) ? best.backtest_run_id : null;
      if (!runId) {
        toast.error({
          title: 'No pinned backtest run',
          description:
            'This paper has no pinned backtest run — open the paper to promote manually.',
        });
        return;
      }
      setTarget({
        symbol: paper.instrument,
        strategyCode: code,
        interval: paper.interval_name,
        backtestRunId: runId,
        params: isBestIteration(best) ? best.params : {},
      });
    } catch (err) {
      toast.error({
        title: 'Could not load paper',
        description: normalizeError(err),
      });
    } finally {
      setResolvingId(null);
    }
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load research papers"
        description="The papers endpoint returned an error."
        action={
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No research papers yet"
        description="Generated research papers appear here as approval candidates."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-1">
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Research papers · candidates (not deployable)
        </span>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-panel">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--border-subtle)] hover:bg-transparent">
              <TableHead className="w-10 text-[var(--text-muted)]">#</TableHead>
              <TableHead className="text-[var(--text-muted)]">Paper</TableHead>
              <TableHead className="text-[var(--text-muted)]">Symbol</TableHead>
              <TableHead className="text-[var(--text-muted)]">Interval</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Ann.Return</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Max DD</TableHead>
              <TableHead
                className="text-right text-[var(--text-muted)]"
                title="Return ÷ Max Drawdown — primary ranking metric for hedging strategies"
              >
                Calmar
              </TableHead>
              <TableHead
                className="text-right text-[var(--text-muted)]"
                title="Profit factor — trading strategies only; not applicable to hedging"
              >
                PF
              </TableHead>
              <TableHead
                className="text-right text-[var(--text-muted)]"
                title="Sharpe ratio — trading strategies only; not applicable to hedging"
              >
                Sharpe
              </TableHead>
              <TableHead
                className="text-right text-[var(--text-muted)]"
                title="Number of trades; for hedging strategies this counts rebalance events"
              >
                Trades
              </TableHead>
              <TableHead className="text-[var(--text-muted)]">Status</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers.map((paper, idx) => {
              const code = paper.strategy_code || paperCodeFromId(paper.paper_id);
              const resolving = resolvingId === paper.paper_id;
              const hedging = isHedging(paper.strategy_kind);
              // Calmar = annualized_return_pct / |max_drawdown_pct|
              const calmarN = toNumOrNull(paper.annualized_return_pct);
              const ddN = toNumOrNull(paper.max_drawdown_pct);
              const calmarStr =
                calmarN != null && ddN != null && ddN !== 0
                  ? fmtNum(calmarN / Math.abs(ddN))
                  : '—';
              return (
                <TableRow
                  key={paper.paper_id}
                  className="hover:bg-[var(--bg-elevated)]/40 border-[var(--border-subtle)]"
                >
                  <TableCell className="font-mono tabular-nums text-[var(--text-muted)]">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="flex items-center gap-2">
                      {code && <StrategyBadge code={code} size="sm" />}
                      <div className="min-w-0">
                        <div
                          className="truncate text-[14px] text-[var(--text-primary)]"
                          title={paper.title}
                        >
                          {paper.title}
                        </div>
                        <div className="truncate font-mono text-[12px] text-[var(--text-muted)]">
                          {paper.paper_id}
                        </div>
                      </div>
                      <KindBadge strategyKind={paper.strategy_kind} />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-[var(--text-primary)]">
                    {paper.instrument}
                  </TableCell>
                  <TableCell className="font-mono text-[var(--text-secondary)]">
                    {paper.interval_name}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[var(--color-profit)]">
                    {fmtPct(paper.annualized_return_pct)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[var(--color-loss)]">
                    {fmtPct(paper.max_drawdown_pct)}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono tabular-nums"
                    style={{ color: hedging ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    title={
                      hedging
                        ? 'Calmar — primary ranking metric for hedging strategies'
                        : 'Calmar — shown for reference; trading rows ranked by DSR'
                    }
                  >
                    {calmarStr}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono tabular-nums"
                    style={{ color: hedging ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    title={
                      hedging ? 'Profit factor — not applicable to hedging strategies' : undefined
                    }
                  >
                    {hedging ? <span className="opacity-40">{fmtNum(paper.profit_factor)}</span> : fmtNum(paper.profit_factor)}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono tabular-nums"
                    style={{ color: hedging ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    title={
                      hedging ? 'Sharpe ratio — not applicable to hedging strategies' : undefined
                    }
                  >
                    {hedging ? <span className="opacity-40">{fmtNum(paper.sharpe_ratio)}</span> : fmtNum(paper.sharpe_ratio)}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono tabular-nums text-[var(--text-primary)]"
                    title={hedging ? 'Rebalance events (allocation tilts have very few trades)' : undefined}
                  >
                    {paper.n_trades ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-[var(--border-default)] text-[12px]">
                      {paper.paper_status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/research/papers/${encodeURIComponent(paper.paper_id)}`}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <ExternalLink size={11} />
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRequestApproval(paper)}
                        disabled={!code || resolving}
                        title={
                          !code
                            ? 'No pinned backtest run — open the paper to promote manually.'
                            : 'Request approval for this paper'
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resolving ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={11} />
                        )}
                        Request
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RequestApprovalDialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        target={target}
      />
    </div>
  );
}
