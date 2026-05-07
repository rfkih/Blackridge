'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowUpCircle,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDate } from '@/lib/formatters';
import {
  getStrategyDefinitionHistory,
  listStrategyDefinitionHistory,
  type SpecOperation,
  type StrategyDefinitionHistoryRow,
} from '@/lib/api/strategy-definition-history';

const PAGE_SIZE = 50;

export default function StrategyHistoryPage() {
  const isAdmin = useIsAdmin();
  const [strategyCode, setStrategyCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['strategy-definition-history', appliedCode, page],
    queryFn: () =>
      listStrategyDefinitionHistory({
        strategyCode: appliedCode,
        page,
        size: PAGE_SIZE,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: isAdmin && Boolean(appliedCode),
  });

  if (!isAdmin) {
    return (
      <div className="px-6 py-12 text-center text-text-secondary">
        Admin access required.
      </div>
    );
  }

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Strategy spec history
        </h1>
        <p className="text-sm text-text-secondary">
          Append-only audit of every spec mutation. Each revision can be
          expanded to see the spec snapshot and the diff against the prior
          revision for the same strategy.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            strategy_code
          </span>
          <input
            type="text"
            value={strategyCode}
            onChange={(e) => setStrategyCode(e.target.value)}
            placeholder="e.g. LSR"
            className="w-[200px] rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] text-text-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setAppliedCode(strategyCode.trim());
            setPage(0);
          }}
          className="mm-pill"
          style={{ padding: '8px 14px', fontSize: 12 }}
        >
          Load
        </button>
        {appliedCode && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {totalElements} {totalElements === 1 ? 'revision' : 'revisions'}
          </span>
        )}
      </div>

      {!appliedCode ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          Enter a strategy code to load its revision history.
        </div>
      ) : query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No revisions found for <span className="font-mono">{appliedCode}</span>.
        </div>
      ) : (
        <ul className="divide-y divide-bd-subtle rounded-xl border border-bd-subtle bg-bg-surface">
          {rows.map((r) => (
            <RevisionRow
              key={r.historyId}
              row={r}
              priorId={r.priorHistoryId ?? undefined}
            />
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

function RevisionRow({
  row,
  priorId,
}: {
  row: StrategyDefinitionHistoryRow;
  priorId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'snapshot' | 'diff'>(
    priorId ? 'diff' : 'snapshot',
  );
  const meta = operationMeta(row.operation);
  const Icon = meta.icon;
  const ts = row.changedAt ? new Date(row.changedAt).getTime() : null;

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex flex-wrap items-baseline gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-hover"
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
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <span
          className="font-mono text-[11px] uppercase tracking-widest"
          style={{ color: meta.fg }}
        >
          {row.operation}
        </span>
        <span className="font-mono text-[12px] text-text-primary">
          {row.archetype}
        </span>
        <span className="font-mono text-[10px] text-text-muted">
          v{row.archetypeVersion} · schema v{row.specSchemaVersion}
        </span>
        {row.changeReason && (
          <span className="truncate text-[12px] text-text-secondary">
            {row.changeReason}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-text-muted">
          {ts ? formatDate(ts) : '—'}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-bd-subtle bg-bg-base px-4 py-3">
          <div className="mb-3 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode('snapshot')}
              className="rounded-sm px-2 py-1 text-[12px] transition-colors"
              style={{
                background:
                  mode === 'snapshot' ? 'var(--bg-hover)' : 'transparent',
                color:
                  mode === 'snapshot'
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                border: '1px solid',
                borderColor:
                  mode === 'snapshot'
                    ? 'var(--border-default)'
                    : 'transparent',
              }}
            >
              Snapshot
            </button>
            <button
              type="button"
              onClick={() => setMode('diff')}
              disabled={!priorId}
              className="rounded-sm px-2 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: mode === 'diff' ? 'var(--bg-hover)' : 'transparent',
                color:
                  mode === 'diff'
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                border: '1px solid',
                borderColor:
                  mode === 'diff' ? 'var(--border-default)' : 'transparent',
              }}
              title={priorId ? 'Diff vs previous revision' : 'No prior revision'}
            >
              Diff vs prev
            </button>
          </div>
          {mode === 'snapshot' ? (
            <SnapshotPanel historyId={row.historyId} />
          ) : (
            <DiffPanel currentId={row.historyId} priorId={priorId!} />
          )}
        </div>
      )}
    </li>
  );
}

function SnapshotPanel({ historyId }: { historyId: string }) {
  const query = useQuery({
    queryKey: ['strategy-definition-history', historyId],
    queryFn: () => getStrategyDefinitionHistory(historyId),
    staleTime: 60_000,
  });
  if (query.isLoading) {
    return (
      <div className="text-text-secondary">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="text-[12px] text-text-secondary">
        Failed to load revision detail.
      </div>
    );
  }
  return (
    <pre className="max-h-[400px] overflow-auto rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-text-primary">
      {JSON.stringify(query.data.specJsonb ?? {}, null, 2)}
    </pre>
  );
}

function DiffPanel({
  currentId,
  priorId,
}: {
  currentId: string;
  priorId: string;
}) {
  const current = useQuery({
    queryKey: ['strategy-definition-history', currentId],
    queryFn: () => getStrategyDefinitionHistory(currentId),
    staleTime: 60_000,
  });
  const prior = useQuery({
    queryKey: ['strategy-definition-history', priorId],
    queryFn: () => getStrategyDefinitionHistory(priorId),
    staleTime: 60_000,
  });

  const diff = useMemo(() => {
    if (!current.data || !prior.data) return null;
    return computeSpecDiff(prior.data.specJsonb ?? {}, current.data.specJsonb ?? {});
  }, [current.data, prior.data]);

  if (current.isLoading || prior.isLoading) {
    return (
      <div className="text-text-secondary">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }
  if (!diff) {
    return (
      <div className="text-[12px] text-text-secondary">
        Failed to load both revisions.
      </div>
    );
  }
  if (diff.length === 0) {
    return (
      <div className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 font-mono text-[11px] text-text-secondary">
        No spec field changes — operation may be metadata-only (archetype
        upgrade, soft-delete, etc.).
      </div>
    );
  }

  return (
    <ul className="divide-y divide-bd-subtle rounded-sm border border-bd-subtle bg-bg-surface">
      {diff.map((d) => (
        <li key={d.path} className="flex flex-col gap-1 px-3 py-2 font-mono text-[11px]">
          <div className="flex items-baseline gap-2">
            <span style={{ color: changeColor(d.kind) }}>{changeGlyph(d.kind)}</span>
            <span className="text-text-primary">{d.path}</span>
            <span className="text-[9px] uppercase tracking-widest text-text-muted">
              {d.kind}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-5">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-text-muted">
                before
              </div>
              <div className="whitespace-pre-wrap break-all text-text-secondary">
                {formatVal(d.before)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-text-muted">
                after
              </div>
              <div className="whitespace-pre-wrap break-all text-text-primary">
                {formatVal(d.after)}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

type ChangeKind = 'added' | 'removed' | 'changed';
interface SpecDiffEntry {
  path: string;
  kind: ChangeKind;
  before: unknown;
  after: unknown;
}

function computeSpecDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): SpecDiffEntry[] {
  const out: SpecDiffEntry[] = [];
  walk('', before, after, out);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function walk(
  prefix: string,
  before: unknown,
  after: unknown,
  out: SpecDiffEntry[],
) {
  if (deepEqual(before, after)) return;
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    );
    for (const k of keys) {
      const path = prefix ? `${prefix}.${k}` : k;
      walk(path, before[k], after[k], out);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i++) {
      const path = `${prefix}[${i}]`;
      walk(path, before[i], after[i], out);
    }
    return;
  }
  if (before === undefined) {
    out.push({ path: prefix || '(root)', kind: 'added', before, after });
    return;
  }
  if (after === undefined) {
    out.push({ path: prefix || '(root)', kind: 'removed', before, after });
    return;
  }
  out.push({ path: prefix || '(root)', kind: 'changed', before, after });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function formatVal(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

function changeGlyph(kind: ChangeKind): string {
  return kind === 'added' ? '+' : kind === 'removed' ? '−' : '~';
}

function changeColor(kind: ChangeKind): string {
  return kind === 'added'
    ? 'var(--color-profit)'
    : kind === 'removed'
      ? 'var(--color-loss)'
      : 'var(--color-warning)';
}

function operationMeta(op: SpecOperation): {
  icon: React.ElementType;
  fg: string;
  bg: string;
} {
  switch (op) {
    case 'INSERT':
      return {
        icon: Plus,
        fg: 'var(--color-profit)',
        bg: 'rgba(22,179,100,0.15)',
      };
    case 'UPDATE':
      return {
        icon: Pencil,
        fg: 'var(--color-warning)',
        bg: 'rgba(245,166,35,0.15)',
      };
    case 'DELETE':
      return {
        icon: Trash2,
        fg: 'var(--color-loss)',
        bg: 'rgba(229,72,77,0.15)',
      };
    case 'UPGRADE':
      return {
        icon: ArrowUpCircle,
        fg: 'var(--color-info)',
        bg: 'rgba(59,130,246,0.12)',
      };
    default:
      return {
        icon: GitBranch,
        fg: 'var(--text-secondary)',
        bg: 'rgba(136,146,164,0.12)',
      };
  }
}
