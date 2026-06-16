'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/formatters';
import type { ResearchRegistryEntry } from '@/types/research';
import { statusStyle, verdictStyle, shortWf, fmtDsr, fmtPct, fmtInt } from './registryBadges';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-base px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums text-[13px] text-text-primary">{value}</div>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-28 shrink-0 text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="break-all font-mono text-[11px] text-text-secondary">{value}</span>
    </div>
  );
}

export function RegistryDetailDialog({
  entry,
  onClose,
}: {
  entry: ResearchRegistryEntry | null;
  onClose: () => void;
}) {
  const ts = entry?.updatedTime ? new Date(entry.updatedTime).getTime() : null;
  const sv = entry ? statusStyle(entry.lifecycleStatus) : null;
  const vv = entry ? verdictStyle(entry.verdictTag) : null;

  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-bd-default bg-bg-surface text-text-primary">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-text-primary">
                <span className="font-mono text-[12px] text-text-muted">#{entry.rank ?? '—'}</span>
                {entry.displayName}
              </DialogTitle>
              <DialogDescription className="text-text-secondary">{entry.thesis}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              {sv && (
                <span
                  className="rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-widest"
                  style={{ background: sv.bg, color: sv.fg }}
                >
                  {sv.label}
                </span>
              )}
              {vv && (
                <span
                  className="rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-widest"
                  style={{ background: vv.bg, color: vv.fg }}
                >
                  {vv.label}
                </span>
              )}
              {entry.signalFamily && (
                <span className="rounded-sm bg-bg-base px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {entry.signalFamily}
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] text-text-muted">
                {entry.strategyCode ?? '—'}
                {entry.symbol ? ` · ${entry.symbol}` : ''}
                {entry.intervalName ? ` · ${entry.intervalName}` : ''}
              </span>
            </div>

            {entry.divergence.flag && (
              <div
                className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
                style={{ background: 'var(--tint-warning)', color: 'var(--color-warning)' }}
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{entry.divergence.reason}</span>
              </div>
            )}

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-text-muted">
                Live metrics{' '}
                {entry.live.resolvedFrom ? (
                  <span className="text-text-muted">({entry.live.resolvedFrom})</span>
                ) : (
                  <span className="text-text-muted">(not yet run)</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <Metric label="DSR" value={fmtDsr(entry.live.dsr)} />
                <Metric label="PSR" value={fmtDsr(entry.live.psr)} />
                <Metric label="Ann %" value={fmtPct(entry.live.annualizedReturnPct)} />
                <Metric label="Sharpe" value={fmtDsr(entry.live.sharpeAnnualized)} />
                <Metric label="Trades" value={fmtInt(entry.live.nTrades)} />
                <Metric label="PF" value={fmtDsr(entry.live.profitFactor)} />
                <Metric label="Walk-forward" value={shortWf(entry.live.walkForwardVerdict)} />
                <Metric label="Live" value={entry.live.isLive ? 'YES' : 'no'} />
              </div>
            </div>

            {entry.detail && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-text-muted">
                  Detail
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                  {entry.detail}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-bd-subtle pt-3">
              <EvidenceRow label="Iteration" value={entry.evidence.iterationId} />
              <EvidenceRow label="Walk-forward" value={entry.evidence.walkForwardId} />
              <EvidenceRow label="Backtest run" value={entry.evidence.backtestRunId ?? entry.live.backtestRunId} />
              <EvidenceRow label="Journal" value={entry.evidence.journalId} />
              <EvidenceRow label="Memory" value={entry.memoryRef} />
              {ts && (
                <div className="mt-1 font-mono text-[10px] text-text-muted">
                  updated {formatDate(ts)}
                  {entry.updatedBy ? ` · ${entry.updatedBy}` : ''}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
