'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  getSpecTrace,
  listSpecTraces,
  type ListSpecTraceParams,
  type SpecTraceRow,
  type SpecTraceRule,
} from '@/lib/api/spec-trace';

const PAGE_SIZE = 50;

interface SpecTraceViewerProps {
  backtestRunId?: string;
  accountStrategyId?: string;
  strategyCode?: string;
  initialErrorsOnly?: boolean;
}

export function SpecTraceViewer({
  backtestRunId,
  accountStrategyId,
  strategyCode,
  initialErrorsOnly = false,
}: SpecTraceViewerProps) {
  const [decision, setDecision] = useState<string>('');
  const [errorsOnly, setErrorsOnly] = useState(initialErrorsOnly);
  const [page, setPage] = useState(0);

  const params: ListSpecTraceParams = {
    backtestRunId,
    accountStrategyId,
    strategyCode,
    decision: decision || undefined,
    errorsOnly,
    page,
    size: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: ['spec-trace', params],
    queryFn: () => listSpecTraces(params),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    enabled: Boolean(backtestRunId || accountStrategyId),
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  if (!backtestRunId && !accountStrategyId) {
    return (
      <div className="rounded-md border border-bd-subtle bg-bg-surface px-6 py-8 text-center text-sm text-text-secondary">
        Provide a backtest run or account strategy to load engine traces.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-bd-subtle bg-bg-surface px-3 py-2">
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          <span className="text-[11px] uppercase tracking-widest text-text-muted">
            Decision
          </span>
          <select
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setPage(0);
            }}
            className="rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] text-text-primary"
          >
            <option value="">Any</option>
            <option value="OPEN_LONG">OPEN_LONG</option>
            <option value="OPEN_SHORT">OPEN_SHORT</option>
            <option value="CLOSE">CLOSE</option>
            <option value="NO_TRADE">NO_TRADE</option>
            <option value="UPDATE_POSITION_MANAGEMENT">UPDATE_POSITION_MANAGEMENT</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => {
              setErrorsOnly(e.target.checked);
              setPage(0);
            }}
          />
          <span>Errors only</span>
        </label>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {totalElements} {totalElements === 1 ? 'trace' : 'traces'}
        </span>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-8 text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-bd-subtle bg-bg-surface px-6 py-8 text-center text-sm text-text-secondary">
          No traces match the current filters.
        </div>
      ) : (
        <ul className="divide-y divide-bd-subtle rounded-md border border-bd-subtle bg-bg-surface">
          {rows.map((r) => (
            <SpecTraceRowItem key={r.traceId} row={r} />
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
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Prev
          </button>
          <span className="font-mono text-[11px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SpecTraceRowItem({ row }: { row: SpecTraceRow }) {
  const [expanded, setExpanded] = useState(false);
  const meta = decisionMeta(row.decision, row.errorClass);
  const Icon = meta.icon;

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex flex-wrap items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg-hover"
      >
        <span aria-hidden="true" className="inline-flex">
          {expanded ? (
            <ChevronDown size={12} strokeWidth={1.7} className="text-text-muted" />
          ) : (
            <ChevronRight size={12} strokeWidth={1.7} className="text-text-muted" />
          )}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon size={11} strokeWidth={1.75} />
        </span>
        <span
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: meta.fg }}
        >
          {row.decision}
        </span>
        <span className="font-mono text-[11px] text-text-secondary">{row.phase}</span>
        <span className="font-mono text-[12px] text-text-primary">{row.strategyCode}</span>
        {row.decisionReason && (
          <span className="truncate font-mono text-[11px] text-text-secondary">
            {row.decisionReason}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {row.evalLatencyUs != null && (
            <span className="font-mono text-[10px] text-text-muted">
              {row.evalLatencyUs}µs
            </span>
          )}
          <span className="font-mono text-[10px] text-text-muted">{row.barTime ?? '—'}</span>
        </span>
      </button>
      {expanded && <SpecTraceDetailPanel traceId={row.traceId} />}
    </li>
  );
}

function SpecTraceDetailPanel({ traceId }: { traceId: string }) {
  const query = useQuery({
    queryKey: ['spec-trace', traceId],
    queryFn: () => getSpecTrace(traceId),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="border-t border-bd-subtle bg-bg-base px-4 py-3 text-text-secondary">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="border-t border-bd-subtle bg-bg-base px-4 py-3 text-[12px] text-text-secondary">
        Failed to load trace detail.
      </div>
    );
  }

  const { rules, specSnapshot, errorClass, errorMessage } = query.data;

  return (
    <div className="flex flex-col gap-3 border-t border-bd-subtle bg-bg-base px-4 py-3">
      {errorClass && (
        <div className="rounded-sm border border-[var(--color-loss)] bg-[rgba(255,77,106,0.08)] px-3 py-2 font-mono text-[11px]">
          <div className="text-[var(--color-loss)]">{errorClass}</div>
          {errorMessage && (
            <div className="mt-1 whitespace-pre-wrap text-text-secondary">{errorMessage}</div>
          )}
        </div>
      )}

      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Rules
        </div>
        {rules && rules.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {rules.map((rule, i) => (
              <RuleRow key={i} rule={rule} fallbackIndex={i} />
            ))}
          </ul>
        ) : (
          <div className="font-mono text-[11px] text-text-secondary">—</div>
        )}
      </div>

      <details className="rounded-sm border border-bd-subtle bg-bg-surface">
        <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Spec snapshot
        </summary>
        <pre className="overflow-x-auto px-3 pb-3 font-mono text-[10px] leading-relaxed text-text-secondary">
          {JSON.stringify(specSnapshot ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function RuleRow({ rule, fallbackIndex }: { rule: SpecTraceRule; fallbackIndex: number }) {
  const passed = rule.result === true;
  const failed = rule.result === false;
  const idx = typeof rule.index === 'number' ? rule.index : fallbackIndex;
  const type = typeof rule.type === 'string' ? rule.type : '(unnamed)';
  const value = rule.value;

  return (
    <li className="flex items-baseline gap-2 font-mono text-[11px]">
      <span className="w-5 text-right text-text-muted">{idx}</span>
      <span
        aria-hidden="true"
        style={{
          color: passed
            ? 'var(--color-profit)'
            : failed
              ? 'var(--color-loss)'
              : 'var(--text-muted)',
        }}
      >
        {passed ? '✓' : failed ? '✗' : '·'}
      </span>
      <span className="text-text-primary">{type}</span>
      {value !== undefined && (
        <span className="text-text-secondary">
          = {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </span>
      )}
    </li>
  );
}

function decisionMeta(
  decision: string,
  errorClass: string | null,
): { icon: React.ElementType; fg: string; bg: string } {
  if (errorClass) {
    return {
      icon: AlertTriangle,
      fg: 'var(--color-warning)',
      bg: 'rgba(245,166,35,0.15)',
    };
  }
  if (decision === 'OPEN_LONG' || decision === 'OPEN_SHORT') {
    return {
      icon: CheckCircle2,
      fg: 'var(--color-profit)',
      bg: 'rgba(0,200,150,0.15)',
    };
  }
  if (decision === 'CLOSE') {
    return {
      icon: CheckCircle2,
      fg: 'var(--color-info)',
      bg: 'rgba(78,158,255,0.12)',
    };
  }
  return {
    icon: XCircle,
    fg: 'var(--text-secondary)',
    bg: 'rgba(136,146,164,0.10)',
  };
}
