'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { toneColor, type Tone } from '@/lib/tones';
import type { PaperRow } from '@/types/papers';

interface PaperCardProps {
  paper: PaperRow;
}

function statusTone(status: string): Tone {
  return status === 'FINALIZED' ? 'profit' : 'warning';
}

function verdictTone(verdict: string | null): Tone {
  if (!verdict) return 'muted';
  if (verdict === 'SIGNIFICANT_EDGE' || verdict === 'PASS') return 'profit';
  if (verdict === 'MARGINAL' || verdict === 'ITERATE') return 'warning';
  if (verdict === 'NO_EDGE' || verdict === 'DISCARD') return 'loss';
  return 'muted';
}

export function PaperCard({ paper }: PaperCardProps) {
  const annRet = paper.annualized_return_pct != null ? Number(paper.annualized_return_pct) : null;

  return (
    <Link
      href={`/research/papers/${paper.paper_id}`}
      className="hover:border-[var(--accent-primary)]/40 group flex flex-col gap-3 rounded-xl border border-bd-subtle bg-bg-surface p-5 transition-colors hover:bg-bg-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText size={12} className="shrink-0 text-text-muted" strokeWidth={1.75} />
          <span className="truncate font-mono text-[10px] text-text-muted">{paper.paper_id}</span>
          <span className="shrink-0 font-mono text-[10px] text-text-muted">v{paper.version}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
            style={{
              background: 'rgba(0,0,0,0.25)',
              color: toneColor(statusTone(paper.paper_status)),
            }}
          >
            {paper.paper_status === 'WORKING_PAPER' ? 'Working' : 'Finalized'}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-text-muted">
            {formatDate(parseIsoUtc(paper.created_time))}
          </span>
        </div>
      </div>

      <h2 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug tracking-tight text-text-primary transition-colors group-hover:text-[var(--accent-primary)]">
        {paper.title}
      </h2>

      {paper.abstract && (
        <p className="line-clamp-3 text-[12px] leading-relaxed text-text-secondary">
          {paper.abstract}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag>{paper.strategy_code}</Tag>
          <Tag>{paper.instrument}</Tag>
          <Tag>{paper.interval_name}</Tag>
          {paper.total_iterations != null && (
            <span className="font-mono text-[10px] text-text-muted">
              {paper.total_iterations} iter
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {annRet != null && (
            <span
              className="font-mono text-[11px] font-semibold tabular-nums"
              style={{
                color:
                  annRet >= 10
                    ? toneColor('profit')
                    : annRet < 0
                      ? toneColor('loss')
                      : toneColor('muted'),
              }}
            >
              {annRet >= 0 ? '+' : ''}
              {annRet.toFixed(1)}%/yr
            </span>
          )}
          {paper.final_verdict && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
              style={{
                background: 'rgba(0,0,0,0.25)',
                color: toneColor(verdictTone(paper.final_verdict)),
              }}
            >
              {paper.final_verdict.replace(/_/g, ' ')}
            </span>
          )}
          <span className="text-[11px] font-semibold text-[var(--accent-primary)] opacity-0 transition-opacity group-hover:opacity-100">
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border border-bd-subtle bg-bg-base px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
      {children}
    </span>
  );
}
